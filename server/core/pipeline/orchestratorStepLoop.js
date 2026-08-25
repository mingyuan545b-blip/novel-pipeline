const logger = require('../../shared/logger');
const { checkWordCountHardLimit } = require('../../services/pipeline/pipelineHelpers');
const { AGENT_ROLE_NAMES } = require('../../services/fileOutput');
const { checkStopped, clearDownstreamOutputs, persistPipelineLog } = require('./orchestratorHelpers');
const { executeStep, handleFinalEditorResult, handleReviewResult } = require('./orchestratorStepHandlers');
const { handleStepError, buildRetryContext } = require('./orchestratorRoundHelpers');
const { getChapterIntentPlanner } = require('../../services/chapterIntent');
const { getHookBudgetForProject } = require('../../services/hookBudget');
const { STATUS_VALUES } = require('../../services/chapterStatus');
const store = require('../../store');

/**
 * 检测流水线是否已停止；若停止则重置章节状态、持久化日志并返回done结果，否则返回null。
 */
async function handlePipelineStopped(params, round) {
    const { projectId, chapterId, chapter, abortController, pipelineLog } = params;
    if (!checkStopped(projectId, chapter.chapterNumber, abortController)) return null;
    chapter.status = STATUS_VALUES.OUTLINED; delete chapter.skipUntil;
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapterId, chapter);
    await persistPipelineLog(chapterId, projectId, pipelineLog);
    return { done: true, result: { success: false, rounds: round, log: pipelineLog, message: '流水线已停止' } };
}

/**
 * 构建当前步骤的执行上下文，可能将 writer 升级为 reviser。
 * 返回 { step, context }。
 */
async function prepareStepContext(params, stepIn, round, currentFeedback, currentMaterialGuidance) {
    const { projectId, chapter, config, mode, rejectionTracker, allFeedbackParts, chapterIntent } = params;
    let step = stepIn;
    const context = buildRetryContext(round, step, chapter, rejectionTracker, allFeedbackParts, currentFeedback, mode);

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

    return { step, context };
}

/**
 * 更新反馈列表：同标题已存在则覆盖，否则追加。
 */
function upsertFeedbackPart(allFeedbackParts, header, feedback) {
    const idx = allFeedbackParts.findIndex(p => p.startsWith(header));
    if (idx >= 0) allFeedbackParts[idx] = header + '\n' + feedback;
    else allFeedbackParts.push(header + '\n' + feedback);
}

/**
 * final-editor 结果处理：成功则自动校验素材深度（陷阱#72防御）并收尾，本轮失败则记录反馈。
 * 返回 { done, result } / { roundFailed, ... } / { currentMaterialGuidance }（继续循环）。
 */
async function handleFinalEditorOutcome(params, stepResult, round) {
    const { projectId, chapterId, chapter, pipelineLog, onStep, runStepFn, options, chapterIntent, genre, mode, abortController, rejectionTracker, allFeedbackParts } = params;
    const materialGuidance = stepResult.materialGuidance || '';
    const feResult = await handleFinalEditorResult(stepResult, chapterId, projectId, chapter, round, pipelineLog, onStep, runStepFn, materialGuidance, options, chapterIntent, genre, mode, abortController);
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
        upsertFeedbackPart(allFeedbackParts, feResult.feedbackHeader, feResult.lastFeedback);
        return { roundFailed: true, currentFeedback: feResult.lastFeedback, currentMaterialGuidance: materialGuidance };
    }
    return { currentMaterialGuidance: materialGuidance };
}

/**
 * 审核步骤（一审/二审/快审）结果处理：不通过则记录反馈并标记本轮失败。
 */
async function handleReviewOutcome(params, step, stepResult, round) {
    const { chapterId, projectId, chapter, config, project, pipelineLog, rejectionTracker, circuitBreaker, allFeedbackParts } = params;
    const rvResult = await handleReviewResult(step, stepResult, chapterId, projectId, chapter, round, config, project, pipelineLog, rejectionTracker, circuitBreaker);
    if (!rvResult.passed) {
        upsertFeedbackPart(allFeedbackParts, rvResult.feedbackHeader, rvResult.lastFeedback);
        return { roundFailed: true, currentFeedback: rvResult.lastFeedback };
    }
    return {};
}

/**
 * Execute one round of the pipeline step loop.
 * Returns { done, result } where done=true means the pipeline should return.
 */
async function executeStepLoop(params) {
    const { projectId, chapterId, steps, round, project, mode, pipelineLog, onStep, runStepFn, abortController, allFeedbackParts, lastFeedback, materialGuidance } = params;

    let currentFeedback = lastFeedback;
    let currentMaterialGuidance = materialGuidance;

    for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
        let step = steps[stepIdx];

        const stopped = await handlePipelineStopped(params, round);
        if (stopped) return stopped;

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
            const prepared = await prepareStepContext(params, step, round, currentFeedback, currentMaterialGuidance);
            step = prepared.step;

            logger.info('pipeline', `Round ${round}, Step: ${step}`);
            const { result: stepResult } = await executeStep(projectId, chapterId, step, round, prepared.context, pipelineLog, onStep, runStepFn, abortController);

            const stoppedAfter = await handlePipelineStopped(params, round);
            if (stoppedAfter) return stoppedAfter;

            if (step === 'writer' && !stepResult.passed) {
                currentFeedback = stepResult.feedback?.summary || '执笔人输出不达标';
                upsertFeedbackPart(allFeedbackParts, '【执笔人反馈】', currentFeedback);
                await clearDownstreamOutputs(chapterId, 'writer');
                return { done: false, roundFailed: true, currentFeedback, currentMaterialGuidance };
            }

            if (step === 'final-editor') {
                const feOutcome = await handleFinalEditorOutcome(params, stepResult, round);
                if (feOutcome.done) return feOutcome;
                if (feOutcome.roundFailed) {
                    return { done: false, roundFailed: true, currentFeedback: feOutcome.currentFeedback, currentMaterialGuidance: feOutcome.currentMaterialGuidance };
                }
                currentMaterialGuidance = feOutcome.currentMaterialGuidance;
            }

            if (['first-review', 'fast-review', 'second-review'].includes(step)) {
                const rvOutcome = await handleReviewOutcome(params, step, stepResult, round);
                if (rvOutcome.roundFailed) {
                    return { done: false, roundFailed: true, currentFeedback: rvOutcome.currentFeedback, currentMaterialGuidance };
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
