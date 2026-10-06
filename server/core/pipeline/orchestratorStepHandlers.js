const store = require('../../store');
const { shouldOverrideReviewRejection } = require('../../services/pipeline/reviewOverride');
const { AGENT_ROLE_NAMES } = require('../../services/fileOutput');
const { checkWordCountHardLimit, formatFeedbackText, runPostApproval } = require('../../services/pipeline/pipelineHelpers');
const { getChapterIntentPlanner } = require('../../services/chapterIntent');
const { getHookBudgetForProject } = require('../../services/hookBudget');
const characterStateCache = require('../../services/characterStateCache');
const { getCircuitBreaker } = require('../../services/reviewCircuitBreaker');
const { classifyError } = require('./errorRecovery');
const { clearDownstreamOutputs, generateOverrideOutput, persistPipelineLog } = require('./orchestratorHelpers');
const { onPostApproval } = require('../../services/pipelineModuleRegistry');
const pipelineMetrics = require('../../services/pipelineMetrics');
const logger = require('../../shared/logger');
const { STATUS_VALUES } = require('../../services/chapterStatus');
const { handleFinalEditorResult } = require('./orchestratorFinalEditorHandler');

// 审核通过后的状态推进（单一源：不再手写 first-reviewed/second-reviewed 字面量）
const REVIEWED_MAP = { 'first-review': STATUS_VALUES.FIRST_REVIEWED, 'second-review': STATUS_VALUES.SECOND_REVIEWED };
const REVIEWING_MAP = { 'first-review': STATUS_VALUES.FIRST_REVIEWING, 'second-review': STATUS_VALUES.SECOND_REVIEWING };

async function markReviewPassed(step, chapterId) {
    const next = REVIEWED_MAP[step];
    if (!next) return;
    const ch = await store.getItem('chapters', chapterId);
    if (ch && ch.status === REVIEWING_MAP[step]) {
        ch.status = next;
        ch.updatedAt = new Date().toISOString();
        await store.setItem('chapters', chapterId, ch);
    }
}

async function executeStep(projectId, chapterId, step, round, context, pipelineLog, onStep, runPipelineStepFn, abortController) {
    const metricsToken = pipelineMetrics.recordStepStart(step, projectId);
    const contextWithSignal = { ...context, signal: abortController?.signal };
    let stepResult;
    try {
        stepResult = await runPipelineStepFn(projectId, chapterId, step, round, contextWithSignal);
    } catch (err) {
        pipelineMetrics.recordStepEnd(metricsToken, false);
        throw err;
    }
    const durationMs = Date.now() - metricsToken.startTime;
    pipelineMetrics.recordStepEnd(metricsToken, stepResult.passed !== false);
    // 落盘日志打轮次标：前端执行日志显示R{round}徽标依赖此字段（2026-09-06用户报告缺失）
    if (stepResult && typeof stepResult === 'object' && stepResult.round === undefined) stepResult.round = round;
    pipelineLog.push(stepResult);
    if (pipelineLog.length > 200) pipelineLog.splice(0, pipelineLog.length - 200);
    if (onStep) {
        const roleName = AGENT_ROLE_NAMES[step] || step;
        onStep({ step, round, passed: stepResult.passed, roleName, feedback: stepResult.feedback });
    }
    return { result: stepResult, durationMs };
}

async function handleReviewOverride(step, stepResult, chapterId, projectId, chapterContent, sysWc, rejectMinWc, materials, project) {
    // 陷阱#43: override改为async，传入overrideCtx用于治理闭环
    const chapter = await store.getItem('chapters', chapterId);
    const overrideCtx = {
        projectId,
        chapterNumber: chapter?.chapterNumber,
        protagonistName: materials.find(m => m.type === 'character' && m.tags?.includes('主角'))?.name,
    };
    const overrideResult = await shouldOverrideReviewRejection(stepResult, chapterContent, sysWc, rejectMinWc, materials, project, overrideCtx);
    if (overrideResult.override) {
        logger.info('pipeline', `Review rejection overridden: ${overrideResult.reason}`);
        stepResult.passed = true;
        stepResult.feedback = stepResult.feedback || {};
        stepResult.feedback.approved = true;
        stepResult.feedback.summary = `系统覆盖通过：${overrideResult.reason}`;
        stepResult.feedback._overridden = true;
        stepResult.feedback._overrideReason = overrideResult.reason;
        const ch = await store.getItem('chapters', chapterId);
        if (ch) {
            const outputField = step === 'first-review' ? 'firstReviewOutput' : 'secondReviewOutput';
            ch[outputField] = generateOverrideOutput(overrideResult.reason, step === 'first-review' ? '初审' : '复审', stepResult.feedback);
            await store.setItem('chapters', chapterId, ch);
        }
        return true;
    }
    return false;
}

async function handleReviewResult(step, stepResult, chapterId, projectId, chapter, round, config, project, pipelineLog, rejectionTracker, circuitBreaker) {
    if (stepResult.passed) {
        await markReviewPassed(step, chapterId);
        return { passed: true };
    }

    logger.info('pipeline', `${step} failed in round ${round}`);
    rejectionTracker[step] = true;

    if (step === 'first-review' || step === 'second-review') {
        const currentContent = (await store.getItem('chapters', chapterId))?.content || '';
        const sysWc = currentContent.replace(/\s/g, '').length;
        const materials = await store.queryItems('materials', { projectId });
        await handleReviewOverride(step, stepResult, chapterId, projectId, currentContent, sysWc, config.word.rejectMin, materials, project);

        if (stepResult.passed) {
            await markReviewPassed(step, chapterId);
            return { passed: true };
        }

        if (step === 'first-review') {
            const isWordCountOnly = stepResult.feedback?.issues?.every(i => i.desc && i.desc.includes('字数') && i.desc.includes('低于最低要求'));
            if (!isWordCountOnly) circuitBreaker.recordFailure('first-review', chapter.chapterNumber);
        }
    }

    const maxRounds = config?.chapter?.maxRounds || 3;
    const hasHardBlock = stepResult.feedback?._hardBlock === true ||
        (stepResult.feedback?.issues || []).some(i => i._hardBlock === true);
    if (round >= maxRounds && !hasHardBlock && !stepResult.passed) {
        const overrideReason = `已返修${round}轮仍未通过，且无hardBlock硬性违规，系统覆盖通过（剩余问题降级为suggestion）`;
        logger.info('pipeline', `Multi-round override for ${step}: ${overrideReason}`);
        stepResult.passed = true;
        stepResult.feedback = stepResult.feedback || {};
        stepResult.feedback.approved = true;
        stepResult.feedback.summary = `系统覆盖通过：${overrideReason}`;
        stepResult.feedback._overridden = true;
        stepResult.feedback._overrideReason = overrideReason;
        const ch = await store.getItem('chapters', chapterId);
        if (ch) {
            const outputField = step === 'first-review' ? 'firstReviewOutput' : 'secondReviewOutput';
            ch[outputField] = generateOverrideOutput(overrideReason, step === 'first-review' ? '初审' : '复审', stepResult.feedback);
            await store.setItem('chapters', chapterId, ch);
        }
        await markReviewPassed(step, chapterId);
        return { passed: true };
    }

    const feedbackText = formatFeedbackText(stepResult.feedback);
    const headerMap = { 'first-review': '【初审意见】', 'fast-review': '【快审意见】', 'second-review': '【复审意见】' };
    await clearDownstreamOutputs(chapterId, step);
    return { passed: false, roundFailed: true, lastFeedback: feedbackText, feedbackHeader: headerMap[step] || `【${step}意见】` };
}

module.exports = { executeStep, handleReviewOverride, handleFinalEditorResult, handleReviewResult };
