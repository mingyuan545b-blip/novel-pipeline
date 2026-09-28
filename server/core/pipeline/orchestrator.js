const { LLM_DEFAULTS } = require('../../config/systemConfig');
const store = require('../../store');
const { resolveConfig } = require('../../config');
const { resolveGenreFromProject } = require('../../services/genreConfig');
const { getDataContext } = require('../../services/dataContext');
const pipelineRegistry = require('../../services/pipelineRegistry');
const characterStateCache = require('../../services/characterStateCache');
const { getCircuitBreaker } = require('../../services/reviewCircuitBreaker');
const { summarizeDegradations, drainDegradations } = require('../../services/pipeline/degradationTracker');
const { STATUS_VALUES } = require('../../services/chapterStatus');
const logger = require('../../shared/logger');
const { DomainError } = require('../../shared/errors');
const { checkStopped, getSteps, persistPipelineLog, tagLogMeta } = require('./orchestratorHelpers');
const { runPreflightChecks, handleChapterIntent, syncHooksAndRules } = require('./orchestratorPreflight');
const { assertChapterReady, buildGateError } = require('../../services/pipeline/materialGate');
const { refreshNearOutline } = require('../../services/pipeline/chapterPlanRefresh');
const { clearRoundOutputs, checkCircuitBreaker } = require('./orchestratorRoundHelpers');
const { executeStepLoop } = require('./orchestratorStepLoop');
const { runWithContext } = require('../../shared/runContext');

class PipelineOrchestrator {
    constructor(config = {}) {
        this.config = config;
        this._runPipelineStepFn = null;
    }

    setRunPipelineStepFn(fn) {
        this._runPipelineStepFn = fn;
        pipelineRegistry.registerStepFn(fn);
    }

    _getRunPipelineStep() {
        if (typeof this._runPipelineStepFn === 'function') return this._runPipelineStepFn;
        try {
            this._runPipelineStepFn = pipelineRegistry.getStepFn();
            return this._runPipelineStepFn;
        } catch (e) {
            throw new DomainError('runPipelineStep is not available', 'STEP_FN_MISSING');
        }
    }

    async run(projectId, chapterId, maxRounds = 5, options = {}) {
        const _orchCtx = await getDataContext(projectId);
        const project = await _orchCtx.getProject();
        const genre = resolveGenreFromProject(project);
        const config = resolveConfig(genre, project);
        const mode = project?.mode || options.mode || 'novel';
        const onStep = options.onStep || null;
        let chapterNumber = 0;
        const pipelineLog = [];

        const abortController = new AbortController();
        this._activeAbortController = abortController;

        try {
            const steps = getSteps(config);
            const effectiveMaxRounds = Math.min(maxRounds, config.chapter.maxRounds);
            let materialGuidance = '';
            let lastFeedback = '';
            const allFeedbackParts = [];
            const rejectionTracker = {};
            steps.forEach(s => { rejectionTracker[s] = false; });

            await runPreflightChecks(projectId, chapterId, pipelineLog, onStep, this._getRunPipelineStep());

            let chapter = await store.getItem('chapters', chapterId);
            chapterNumber = chapter?.chapterNumber || 0;

            // P1-4a 章节因果门槛：前序章节素材未归档 → 本章不开工（不罚本章重试）
            await enforceChapterGate(projectId, chapterNumber, this._getRunPipelineStep());

            // P1-4b 就近细纲：开写前用"此刻已归档素材"把远景粗纲细化为本章计划（幂等，失败不阻断）
            await refreshNearOutline(projectId, chapterNumber, { chapterId, onStep });

            // 细纲刷新后重读：下游（章节意图/执笔）必须用细化后的正文计划，不能用又将过期的粗纲
            chapter = (await store.getItem('chapters', chapterId)) || chapter;
            const chapterOutline = chapter?.outline || '';

            characterStateCache.startSession(projectId, chapterNumber);

            if (chapter.content && chapter.status === STATUS_VALUES.OUTLINED) {
                const contentWc = chapter.content.replace(/\s/g, '').length;
                if (contentWc > 500) chapter.status = STATUS_VALUES.WRITTEN;
                else { chapter.content = ''; chapter.wordCount = 0; }
                chapter.updatedAt = new Date().toISOString();
                await store.setItem('chapters', chapterId, chapter);
            }

            const chapterIntent = await handleChapterIntent(projectId, chapterId, chapterNumber, chapterOutline, options, pipelineLog, onStep);
            await syncHooksAndRules(projectId);

            const circuitBreaker = getCircuitBreaker(projectId);
            const cbConfig = circuitBreaker.getAdjustedConfig();
            if (cbConfig.message) logger.info('pipeline', `Circuit breaker: ${cbConfig.message}`);

            const startRound = (chapter.round && chapter.round > 0) ? chapter.round + 1 : 1;
            let retryCount = 0;

            for (let round = startRound; round <= effectiveMaxRounds + startRound - 1; round++) {
                await new Promise(r => setImmediate(r));
                chapter = await store.getItem('chapters', chapterId) || chapter;

                if (checkStopped(projectId, chapterNumber, abortController)) {
                    await resetChapterToOutlined(chapterId);
                    await persistPipelineLog(chapterId, projectId, pipelineLog);
                    return { success: false, rounds: round, log: tagLogMeta(pipelineLog, chapterNumber, startRound), message: '流水线已停止' };
                }

                const beforeClear = await store.getItem('chapters', chapterId);
                const hadDraft = Boolean(beforeClear?.finalEditorOutput || beforeClear?.reviserOutput);
                await clearRoundOutputs(chapter, chapterId, round, startRound);
                if (hadDraft) {
                    const note = '第' + (startRound ? round - startRound + 1 : round) + '轮开始：清理上一轮的定稿/返修/素材输出，准备重跑审核链';
                    pipelineLog.push({ step: 'round-start', status: 'info', summary: note, timestamp: new Date().toISOString() });
                    if (typeof onStep === 'function') onStep({ step: 'round-start', round, passed: true, roleName: '轮次', feedback: { summary: note } });
                }

                if (round > 1) {
                    const cbResult = await checkCircuitBreaker(projectId, round, circuitBreaker, pipelineLog, chapterId, projectId, startRound);
                    if (cbResult.tripped) return { success: false, rounds: round, log: tagLogMeta(pipelineLog, chapterNumber, startRound), message: '流水线熔断暂停', alertLoopReport: cbResult.alertResult };
                }

                // 运行上下文：把 startRound 透传到步骤内部（reviews 写入时补 runRound，供 UI 显示"第x轮(累计y)"）
                const loopResult = await runWithContext({
                    projectId, chapterId, startRound, round,
                    // 末轮标记：审核链内部（first-review 硬性检测等）据此对"轻微字数不足"降级处理，
                    // 否则 hardBlock 不可覆盖 → 末轮宽限形同虚设（20章E2E ch6 实测）
                    isLastRound: round >= startRound + effectiveMaxRounds - 1
                }, () => executeStepLoop({
                    projectId, chapterId, steps, round, chapter, config, project, mode,
                    pipelineLog, onStep, runStepFn: this._getRunPipelineStep(),
                    abortController, rejectionTracker, allFeedbackParts, lastFeedback,
                    materialGuidance, chapterIntent, genre, circuitBreaker, options, retryCount,
                    startRound, effectiveMaxRounds
                }));

                retryCount = loopResult.retryCount ?? retryCount;
                if (loopResult.done) { if (loopResult.result) tagLogMeta(loopResult.result.log, chapterNumber, startRound); return loopResult.result; }
                if (loopResult.currentFeedback) lastFeedback = loopResult.currentFeedback;
                if (loopResult.currentMaterialGuidance) materialGuidance = loopResult.currentMaterialGuidance;
            }

            const lastLog = pipelineLog.length > 0 ? pipelineLog[pipelineLog.length - 1] : null;
            const isWordCountFailure = lastLog && lastLog.feedback?.issues?.some(i => i.desc && i.desc.includes('字数') && i.desc.includes('低于最低要求'));
            await resetChapterToOutlined(chapterId);

            await persistPipelineLog(chapterId, projectId, pipelineLog);
            const lastFailedStep = pipelineLog.length > 0 ? pipelineLog[pipelineLog.length - 1].step : 'unknown';
            return { success: false, rounds: effectiveMaxRounds, log: tagLogMeta(pipelineLog, chapterNumber, startRound), message: `Pipeline经${effectiveMaxRounds}轮审核仍未通过（最后失败步骤：${lastFailedStep}）`, lastFeedback, failureType: isWordCountFailure ? 'word-count' : 'review' };
        } finally {
            // 安全网：确保Pipeline日志总是持久化，无论通过哪个路径退出
            if (pipelineLog.length > 0) {
                try { await persistPipelineLog(chapterId, projectId, pipelineLog); }
                catch (e) { logger.warn('pipeline', 'Failed to persist pipeline log in finally block', { error: e.message }); }
            }
            // 辅助系统降级汇总上报
            const degradSummary = summarizeDegradations(`chapter-${chapterNumber}`);
            if (degradSummary) {
                logger.warn('pipeline', degradSummary);
                drainDegradations();
            }
            characterStateCache.endSession(projectId, chapterNumber);
            this._activeAbortController = null;
        }
    }
}

/**
 * P1-4a 章节因果门槛：前序章节素材未归档（material-updated）→ 本章不开工。
 * 抛 GATE_ERROR_CODE 让 chapterErrorHandler 识别（不计重试/不进冷却），
 * 避免把"前章缺素材"记到本章头上；带债放行则 ERROR 告警但继续。
 */
async function enforceChapterGate(projectId, chapterNumber, runPipelineStep) {
    const gate = await assertChapterReady({ projectId, chapterNumber, runPipelineStep });
    if (!gate.ready) {
        logger.error('pipeline', `[materialGate] 第${chapterNumber}章被门槛拦下：${gate.report}`, { blockedBy: gate.blockedBy });
        throw buildGateError(gate.report);
    }
    if (gate.debt) {
        logger.error('pipeline', `[materialGate] 第${chapterNumber}章带债放行：${gate.debt.reason}`, { materialDebt: gate.debt });
    }
    return gate;
}

/** 把章节置回 outlined（停止/失败路径共用）：清 skipUntil 并落盘 */
async function resetChapterToOutlined(chapterId) {
    const chapter = await store.getItem('chapters', chapterId);
    if (!chapter) return;
    chapter.status = STATUS_VALUES.OUTLINED;
    delete chapter.skipUntil;
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapterId, chapter);
}

module.exports = { PipelineOrchestrator };
