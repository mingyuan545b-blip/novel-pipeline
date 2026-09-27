const logger = require('../../shared/logger');
const { LLM_DEFAULTS } = require('../../config/systemConfig');
const store = require('../../store');
const { DomainError } = require('../../shared/errors');
const { classifyError } = require('./errorRecovery');
const { checkStopped, clearDownstreamOutputs, persistPipelineLog } = require('./orchestratorHelpers');
const { AGENT_ROLE_NAMES } = require('../../services/fileOutput');
const { STATUS_VALUES } = require('../../services/chapterStatus');

/**
 * Handle a stopped pipeline — update chapter status and persist log.
 */
async function handleStopped(projectId, chapterId, chapterNumber, chapter, pipelineLog, abortController) {
    chapter.status = STATUS_VALUES.OUTLINED;
    delete chapter.skipUntil;
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapterId, chapter);
    await persistPipelineLog(chapterId, projectId, pipelineLog);
    return { success: false, rounds: 0, log: pipelineLog, message: '流水线已停止' };
}

/**
 * 记录"字数硬门槛拦截"的审查留痕。
 *
 * 背景（bug 修复）：checkWordCountHardLimit 在 first-review 之前就 blocked 返回，
 * 只 push 进内存 pipelineLog（刷新即丢）+ 只保留最后一次运行的持久化日志，
 * 于是这些轮次在"执行日志"里完全没有记录 —— 用户看到的就是"只有 R3 以后，没有 R1/R2"。
 * 这里补一条 reviews 行，让每一轮都有可追溯的结论。
 */
async function recordBlockedRound(projectId, chapterId, step, round, stepResult, reviewer = 'word-count-gate') {
    try {
        const feedback = stepResult?.feedback || {};
        const now = new Date().toISOString();
        const revId = `${chapterId}_${step}_blocked_r${round}`;
        await store.setItem('reviews', revId, {
            id: revId, chapterId, projectId,
            step, type: step, reviewer,
            result: { passed: false, summary: feedback.summary, issues: feedback.issues || [] },
            passed: false,
            content: feedback.summary || '字数硬门槛拦截',
            issues: feedback.issues || [],
            suggestions: feedback.suggestions || [],
            round,
            createdAt: now
        });
    } catch (e) {
        logger.warn('pipeline', '[wc-block] 写入审查留痕失败: ' + (e.message || e));
    }
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
async function checkCircuitBreaker(projectId, round, circuitBreaker, pipelineLog, chapterId, projectIdRef, startRound = 1) {
    const alertResult = await require('../../services/pipeline/pipelineUtils').checkAlertLoop(projectId);
    if (alertResult) {
        logger.error('pipeline', `Alert loop triggered at round ${round}`);
        const isTripped = await circuitBreaker.isTripped();
        // 相对轮次：round是跨run累计的绝对值（startRound=chapter.round+1），
        // 用绝对值比较会导致续跑章节（round≥5起步）首个告警即熔断（2026-09-06实测）
        if (isTripped && (round - startRound + 1) >= 5) {
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
        // round随context下传：扩写指令按轮次递增标记，保证每轮prompt不同（打破同prompt→同补全死循环）
        context = { reviewFeedback: feedbackToUse.substring(0, 3000), mode, round };
    }
    return context;
}

module.exports = {
    handleStopped,
    clearRoundOutputs,
    recordBlockedRound,
    checkCircuitBreaker,
    handleStepError,
    buildRetryContext
};
