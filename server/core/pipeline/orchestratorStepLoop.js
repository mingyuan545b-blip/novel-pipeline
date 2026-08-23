const logger = require('../../shared/logger');
const { checkWordCountHardLimit } = require('../../services/pipeline/pipelineHelpers');
const { AGENT_ROLE_NAMES } = require('../../services/fileOutput');
const { checkStopped, clearDownstreamOutputs, persistPipelineLog } = require('./orchestratorHelpers');
const { executeStep, handleFinalEditorResult, handleReviewResult } = require('./orchestratorStepHandlers');
const { handleStepError, buildRetryContext } = require('./orchestratorRoundHelpers');
const { getChapterIntentPlanner } = require('../../services/chapterIntent');
const { getHookBudgetForProject } = require('../../services/hookBudget');
const store = require('../../store');

/**
 * Execute one round of the pipeline step loop.
 * Returns { done, result } where done=true means the pipeline should return.
 */
async function executeStepLoop(params) {
    const { projectId, chapterId, steps, round, chapter, config, project, mode, pipelineLog, onStep, runStepFn, abortController, rejectionTracker, allFeedbackParts, lastFeedback, materialGuidance, chapterIntent, genre, circuitBreaker, options } = params;

    let currentFeedback = lastFeedback;
    let currentMaterialGuidance = materialGuidance;

    for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
        let step = steps[stepIdx];
        if (checkStopped(projectId, chapter.chapterNumber, abortController)) {
            chapter.status = 'outlined'; delete chapter.skipUntil;
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
            await persistPipelineLog(chapterId, projectId, pipelineLog);
            return { done: true, result: { success: false, rounds: round, log: pipelineLog, message: '流水线已停止' } };
        }

        if (step === 'second-review' && pipelineLog.find(l => l.step === 'first-review' && l.result?.feedback?._criticalBlocker)) {
            logger.info('pipeline', 'Skipping second-review due to critical blocker');
            continue;
        }

        const wcCheck = await checkWordCountHardLimit(step, chapterId, project, mode);
        if (wcCheck.blocked) {
            pipelineLog.push(wcCheck.stepResult);
            if (onStep) onStep({ step, round, passed: false, roleName: AGENT_ROLE_NAMES[step] || step, feedback: wcCheck.stepResult.feedback });
            await clearDownstreamOutputs(chapterId, step);
            return { done: false, roundFailed: true, currentFeedback, currentMaterialGuidance };
        }

        try {
            let context = buildRetryContext(round, step, chapter, rejectionTracker, allFeedbackParts, currentFeedback, mode);

            if (round > 1 && step === 'writer') {
                const currentWordCount = (chapter.content || '').length;
                if (currentWordCount >= config.word.rejectMin) {
                    logger.info('pipeline', `Word count OK (${currentWordCount}), using reviser`);
                    step = 'reviser';
                }
            }

            if (step === 'writer' && chapterIntent) {
                const intentPlanner = getChapterIntentPlanner(projectId);
                context.chapterIntent = await intentPlanner.formatIntentForPrompt(chapter.chapterNumber);
            }
            // 审核步骤也需要知道意图规划的Must Keep/Avoid约束，避免误判
            if (['first-review', 'second-review', 'fast-review'].includes(step) && chapterIntent) {
                const intentPlanner = getChapterIntentPlanner(projectId);
                context.chapterIntent = await intentPlanner.formatIntentForPrompt(chapter.chapterNumber);
            }
            if (step === 'writer') {
                try { const hookBudget = getHookBudgetForProject(projectId); context.hookAgenda = await hookBudget.formatHookAgendaForPrompt(chapter.chapterNumber); } catch (e) { logger.warn('orchestrator', e.message || e); }
            }
            if (step === 'material-manager' && currentMaterialGuidance) context.materialGuidance = currentMaterialGuidance;

            logger.info('pipeline', `Round ${round}, Step: ${step}`);
            const { result: stepResult } = await executeStep(projectId, chapterId, step, round, context, pipelineLog, onStep, runStepFn, abortController);

            if (checkStopped(projectId, chapter.chapterNumber, abortController)) {
                chapter.status = 'outlined'; delete chapter.skipUntil;
                chapter.updatedAt = new Date().toISOString();
                await store.setItem('chapters', chapterId, chapter);
                await persistPipelineLog(chapterId, projectId, pipelineLog);
                return { done: true, result: { success: false, rounds: round, log: pipelineLog, message: '流水线已停止' } };
            }

            if (step === 'writer' && !stepResult.passed) {
                currentFeedback = stepResult.feedback?.summary || '执笔人输出不达标';
                const idx = allFeedbackParts.findIndex(p => p.startsWith('【执笔人反馈】'));
                if (idx >= 0) allFeedbackParts[idx] = '【执笔人反馈】\n' + currentFeedback;
                else allFeedbackParts.push('【执笔人反馈】\n' + currentFeedback);
                await clearDownstreamOutputs(chapterId, 'writer');
                return { done: false, roundFailed: true, currentFeedback, currentMaterialGuidance };
            }

            if (step === 'final-editor') {
                currentMaterialGuidance = stepResult.materialGuidance || '';
                const feResult = await handleFinalEditorResult(stepResult, chapterId, projectId, chapter, round, pipelineLog, onStep, runStepFn, currentMaterialGuidance, options, chapterIntent, genre, mode, abortController);
                if (feResult.success) {
                    // 陷阱#72防御：pipeline成功后自动校验4类素材深度，异常自动告警
                    // 避免问题累积到多章后才发现（ch1-5 MO输出全无的教训）
                    try {
                        const { verifyAndAlert } = require('../../services/pipeline/materialDepthChecker');
                        await verifyAndAlert(projectId, chapter.chapterNumber);
                    } catch (checkErr) {
                        logger.warn('pipeline', `Material depth auto-check failed: ${checkErr.message}`);
                    }
                    return { done: true, result: feResult };
                }
                if (feResult.roundFailed) {
                    rejectionTracker['final-editor'] = true;
                    currentFeedback = feResult.lastFeedback;
                    const idx2 = allFeedbackParts.findIndex(p => p.startsWith(feResult.feedbackHeader));
                    if (idx2 >= 0) allFeedbackParts[idx2] = feResult.feedbackHeader + '\n' + feResult.lastFeedback;
                    else allFeedbackParts.push(feResult.feedbackHeader + '\n' + feResult.lastFeedback);
                    return { done: false, roundFailed: true, currentFeedback, currentMaterialGuidance };
                }
            }

            if (['first-review', 'fast-review', 'second-review'].includes(step)) {
                const rvResult = await handleReviewResult(step, stepResult, chapterId, projectId, chapter, round, config, project, pipelineLog, rejectionTracker, circuitBreaker);
                if (!rvResult.passed) {
                    currentFeedback = rvResult.lastFeedback;
                    const idx3 = allFeedbackParts.findIndex(p => p.startsWith(rvResult.feedbackHeader));
                    if (idx3 >= 0) allFeedbackParts[idx3] = rvResult.feedbackHeader + '\n' + rvResult.lastFeedback;
                    else allFeedbackParts.push(rvResult.feedbackHeader + '\n' + rvResult.lastFeedback);
                    return { done: false, roundFailed: true, currentFeedback, currentMaterialGuidance };
                }
            }

        } catch (error) {
            const errResult = await handleStepError(error, step, round, chapterId, projectId, pipelineLog, params.retryCount || 0);
            if (errResult.action === 'retry') {
                params.retryCount = errResult.retryCount;
                stepIdx--;
                continue;
            }
            await persistPipelineLog(chapterId, projectId, pipelineLog);
            return { done: true, result: { success: false, rounds: round, log: pipelineLog, error: errResult.error, isOverloaded: errResult.isOverloaded, message: errResult.error }, retryCount: errResult.retryCount };
        }
    }
    return { done: false, roundFailed: false, currentFeedback, currentMaterialGuidance };
}

module.exports = { executeStepLoop };
