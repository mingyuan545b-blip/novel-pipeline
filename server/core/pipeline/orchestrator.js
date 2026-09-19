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
const { clearRoundOutputs, checkCircuitBreaker } = require('./orchestratorRoundHelpers');
const { executeStepLoop } = require('./orchestratorStepLoop');

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
                    chapter.status = STATUS_VALUES.OUTLINED;
                    delete chapter.skipUntil;
                    chapter.updatedAt = new Date().toISOString();
                    await store.setItem('chapters', chapterId, chapter);
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

                const loopResult = await executeStepLoop({
                    projectId, chapterId, steps, round, chapter, config, project, mode,
                    pipelineLog, onStep, runStepFn: this._getRunPipelineStep(),
                    abortController, rejectionTracker, allFeedbackParts, lastFeedback,
                    materialGuidance, chapterIntent, genre, circuitBreaker, options, retryCount
                });

                retryCount = loopResult.retryCount ?? retryCount;
                if (loopResult.done) { if (loopResult.result) tagLogMeta(loopResult.result.log, chapterNumber, startRound); return loopResult.result; }
                if (loopResult.currentFeedback) lastFeedback = loopResult.currentFeedback;
                if (loopResult.currentMaterialGuidance) materialGuidance = loopResult.currentMaterialGuidance;
            }

            const lastLog = pipelineLog.length > 0 ? pipelineLog[pipelineLog.length - 1] : null;
            const isWordCountFailure = lastLog && lastLog.feedback?.issues?.some(i => i.desc && i.desc.includes('字数') && i.desc.includes('低于最低要求'));
            const failedChapter = await store.getItem('chapters', chapterId);
            if (failedChapter) {
                failedChapter.status = STATUS_VALUES.OUTLINED;
                delete failedChapter.skipUntil;
                failedChapter.updatedAt = new Date().toISOString();
                await store.setItem('chapters', chapterId, failedChapter);
            }

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

module.exports = { PipelineOrchestrator };
