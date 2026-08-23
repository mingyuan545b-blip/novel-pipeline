const logger = require('../../shared/logger');
const { LLM_DEFAULTS } = require('../../config/systemConfig');
const store = require('../../store');
const { DomainError } = require('../../shared/errors');
const { classifyError } = require('./errorRecovery');
const { checkStopped, clearDownstreamOutputs, persistPipelineLog } = require('./orchestratorHelpers');
const { AGENT_ROLE_NAMES } = require('../../services/fileOutput');

/**
 * Handle a stopped pipeline — update chapter status and persist log.
 */
async function handleStopped(projectId, chapterId, chapterNumber, chapter, pipelineLog, abortController) {
    chapter.status = 'outlined';
    delete chapter.skipUntil;
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapterId, chapter);
    await persistPipelineLog(chapterId, projectId, pipelineLog);
    return { success: false, rounds: 0, log: pipelineLog, message: '流水线已停止' };
}

/**
 * Clear downstream outputs for a new round.
 */
async function clearRoundOutputs(chapter, chapterId, round, startRound) {
    if (round > 1 || startRound === 1) {
        // 审核结果(firstReviewOutput/secondReviewOutput)由对应review步骤管理，不在每轮开始时清除
        // 避免Pipeline在reviser执行后被终止时审核结果丢失
        const clearFields = ['finalEditorOutput', 'reviserOutput', 'materialManagerOutput', 'polisherOutput'];
        let cleared = false;
        const clearedFields = [];
        for (const f of clearFields) { if (chapter[f]) { clearedFields.push(`${f}=${chapter[f].substring(0, 30)}...`); delete chapter[f]; cleared = true; } }
        if (cleared) {
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
            logger.debug('pipeline', `clearRoundOutputs: round=${round}, startRound=${startRound}, chapterId=${chapterId}, cleared: ${clearedFields.join(', ') || '(none)'}`);
        }
    }
}

/**
 * Check alert loop and circuit breaker.
 */
async function checkCircuitBreaker(projectId, round, circuitBreaker, pipelineLog, chapterId, projectIdRef) {
    const alertResult = await require('../../services/pipeline/pipelineUtils').checkAlertLoop(projectId);
    if (alertResult) {
        logger.error('pipeline', `Alert loop triggered at round ${round}`);
        const isTripped = await circuitBreaker.isTripped();
        if (isTripped && round >= 5) {
            await persistPipelineLog(chapterId, projectIdRef, pipelineLog);
            return { tripped: true, alertResult };
        }
    }
    return { tripped: false };
}

/**
 * Handle step execution error — classify, update chapter status, retry or fail.
 */
async function handleStepError(error, step, round, chapterId, projectId, pipelineLog, retryCount) {
    logger.error('pipeline', `Error in round ${round}, step ${step}`, { error: error.message, stack: error.stack });
    const { isOverloaded, isContextErr, isTimeout, errorDetail } = classifyError(error, step);
    pipelineLog.push({ step, error: errorDetail, passed: false, isOverloaded, isTimeout, isContextErr, timestamp: new Date().toISOString() });

    try {
        const errChapter = await store.getItem('chapters', chapterId);
        if (errChapter) {
            const reviewSteps = ['first-review', 'second-review', 'fast-review', 'writer', 'reviser'];
            if (reviewSteps.includes(step)) errChapter.status = 'written';
            else if (isContextErr) { errChapter.status = 'context-error'; errChapter.skipUntil = Date.now() + LLM_DEFAULTS.contextErrorCooldownMs; }
            else errChapter.status = 'pipeline-failed';
            errChapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, errChapter);
        }
    } catch (saveErr) { logger.warn('pipeline', 'Failed to update chapter status after error', { error: saveErr.message }); }

    if (isOverloaded || isTimeout) {
        const waitMs = isOverloaded ? LLM_DEFAULTS.overloadedWaitMs : LLM_DEFAULTS.timeoutWaitMs;
        logger.info('pipeline', `${isOverloaded ? 'API繁忙' : '超时'}，等待${waitMs/1000}秒后重试当前步骤 ${step}`);
        await new Promise(r => setTimeout(r, waitMs));
        retryCount++;
        if (retryCount > 3) {
            await persistPipelineLog(chapterId, projectId, pipelineLog);
            return { action: 'fail', retryCount, error: errorDetail, isOverloaded };
        }
        return { action: 'retry', retryCount };
    }

    await persistPipelineLog(chapterId, projectId, pipelineLog);
    return { action: 'fail', retryCount, error: errorDetail, isOverloaded: false };
}

/**
 * Build writer context for retry rounds.
 */
function buildRetryContext(round, step, chapter, rejectionTracker, allFeedbackParts, lastFeedback, mode) {
    let context = { mode };
    if (round > 1 && step === 'writer') {
        const multipleRejected = Object.values(rejectionTracker).filter(Boolean).length >= 2;
        const feedbackToUse = multipleRejected && allFeedbackParts.length > 1
            ? '【⚠ 多位审核者意见汇总】\n\n' + allFeedbackParts.join('\n\n')
            : allFeedbackParts.join('\n\n') || lastFeedback;
        context = { reviewFeedback: feedbackToUse.substring(0, 3000), mode };
    }
    return context;
}

module.exports = {
    handleStopped,
    clearRoundOutputs,
    checkCircuitBreaker,
    handleStepError,
    buildRetryContext
};
