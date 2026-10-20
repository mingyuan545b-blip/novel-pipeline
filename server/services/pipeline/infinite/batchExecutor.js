const store = require("../../../store");
const { broadcastToProject } = require("../../websocket");
const { getState, deleteState, persistState, STATE_CLEANUP_DELAY_MS } = require("./stateManager");
const { initializePipeline, generateInitialOutlines, setRunPipelineStepRef: initSetStepRef } = require("./pipelineInit");
const { resetCooledChapters, fixStuckChapters, selectNextChapter } = require("./chapterScheduler");
const { executeChapter, setRunFullPipelineRef, setRunPipelineStepRef: execSetStepRef, getRunPipelineStep } = require("./chapterExecutor");
const { assertChapterReady, computeWaitMs } = require("../materialGate");
const { supplementOutlines } = require("./outlineSupplementor");
const { checkStopConditions } = require("./stopConditions");
const { LLM_DEFAULTS } = require("../../../config/systemConfig");
const logger = require("../../../shared/logger");
const { STUCK_STATUSES, STATUS_VALUES } = require("../../chapterStatus");

/** P1-4a/P1-E 门槛处置：先补跑可修复缺口；仍缺则给本章打 skipUntil 后跳过并推进（杜绝活锁）。
 *  @returns {Promise<boolean>} true=可开工（含带债放行）；false=本章本轮跳过 */
async function enforceChapterGate(projectId, ch, addLog) {
    const n = ch.chapterNumber;
    const gate = await assertChapterReady({ projectId, chapterNumber: n, runPipelineStep: getRunPipelineStep() });
    if (gate.ready) {
        if (gate.debt) addLog(`⚠️ 第${n}章带债放行：${gate.debt.reason}（缺口 ${gate.debt.blockedChapters.join('、')} 未修复）`, { gateDebt: true, chapterNumber: n });
        else if (gate.repaired.length > 0) addLog(`🔧 门槛补跑：${gate.repaired.map(r => `第${r.chapterNumber}章${r.ok ? '已归档' : '仍缺'}`).join('、')}`);
        return true;
    }
    addLog(`🚧 第${n}章暂不开工 — ${gate.report}`, { gateBlocked: true, chapterNumber: n, blockedBy: gate.blockedBy });
    broadcastToProject(projectId, 'pipeline:material-gate', { chapterNumber: n, blockedBy: gate.blockedBy, report: gate.report, repaired: gate.repaired, at: Date.now() });
    // P1-E：标记本章暂缓，调度器本轮跳过它；杜绝同章活锁
    ch.skipUntil = Date.now() + computeWaitMs(gate);
    ch.updatedAt = new Date().toISOString();
    await store.setItem('chapters', ch.id, ch);
    return false;
}

async function runInfinitePipeline(projectId, options = {}) {
    const initResult = await initializePipeline(projectId, options);
    if (!initResult.success) return initResult;

    const { state, addLog, waitWithStop, maxRounds } = initResult;
    const { maxChapters = 999, stopAfterChapter = null } = options;

    const project = await (await require("../../dataContext").getDataContext(projectId)).getProject();
    // Schema-First：归一化读取targetChapters，兼容targetChapterCount历史字段名
    const { normalizeTargetChapters } = require("../../../config/targetChaptersNormalizer");
    const targetChapterCount = normalizeTargetChapters(project);
    const targetWordCount = project?.targetWordCount || null;
    const effectiveStopChapter = stopAfterChapter || targetChapterCount || null;
    broadcastToProject(projectId, 'pipeline:status', { running: true, stopped: false, completedChapters: state.completedChapters, phase: 'init' });

    try {
        const outlineResult = await generateInitialOutlines(projectId, addLog);
        if (!outlineResult.success) {
            addLog(`初始化失败: ${outlineResult.error}`);
            state.running = false;
            return { success: false, completedChapters: 0, logs: state.logs, lastError: outlineResult.error };
        }

        let iteration = 0;
        while (!state.stopped) {
            iteration++;
            state.phase = 'scheduling';
            let chapters = (await store.queryItems('chapters', { projectId })).sort((a, b) => a.chapterNumber - b.chapterNumber);

            const cooled = resetCooledChapters(chapters, addLog);
            for (const { chapter: ch } of cooled) { await store.setItem('chapters', ch.id, ch); }
            if (cooled.length > 0) chapters = (await store.queryItems('chapters', { projectId })).sort((a, b) => a.chapterNumber - b.chapterNumber);

            const fixed = fixStuckChapters(chapters, addLog);
            for (const { chapter: ch } of fixed) { await store.setItem('chapters', ch.id, ch); }
            if (fixed.length > 0) chapters = (await store.queryItems('chapters', { projectId })).sort((a, b) => a.chapterNumber - b.chapterNumber);

            const { outlinedChapters, failedSkippedChapters, cooldownChapters } = selectNextChapter(chapters, addLog);

            const stopCheck = await checkStopConditions(projectId, chapters, state, addLog, { effectiveStopChapter, targetWordCount, maxChapters });
            if (stopCheck.shouldStop) break;

            if (outlinedChapters.length === 0) {
                const supplementResult = await supplementOutlines(projectId, chapters, state, addLog, maxChapters, waitWithStop);
                if (supplementResult.shouldStop) break;
                if (supplementResult.newChapterCount > 0) continue;

                // P1-E：可开工章节全被门槛暂缓 → 等到最早可重试时间（不空转、不误判"完成"）
                const gateBlocked = chapters.filter(c => c.status === STATUS_VALUES.OUTLINED && c.skipUntil && c.skipUntil > Date.now());
                if (gateBlocked.length > 0) {
                    const waitMs = Math.min(Math.max(Math.min(...gateBlocked.map(c => c.skipUntil)) - Date.now(), 5000), 120000);
                    addLog(`🚧 全部可开工章节被素材门槛暂缓（${gateBlocked.map(c => `第${c.chapterNumber}章`).join('、')}），等待${Math.round(waitMs / 1000)}秒后重试`);
                    await waitWithStop(waitMs); continue;
                }

                if (failedSkippedChapters.length > 0) {
                    const earliestCoolEnd = Math.min(...failedSkippedChapters.map(c => c.skipUntil));
                    const waitMs = Math.max(earliestCoolEnd - Date.now(), 5000);
                    addLog(`所有章节冷却中，等待${Math.round(waitMs / 1000)}秒...`);
                    await waitWithStop(Math.min(waitMs, 120000));
                    continue;
                }

                addLog('没有可处理的章节，Pipeline完成');
                break;
            }

            const ch = outlinedChapters[0];

            // P1-4a 门槛：前序章节素材未归档 → 本章不开工
            if (!(await enforceChapterGate(projectId, ch, addLog))) continue;

            const execResult = await executeChapter(projectId, ch, state, addLog, maxRounds, waitWithStop);

            if (execResult.stopped) break;

            if (execResult.overloaded) {
                state._consecutiveOverloadFails = (state._consecutiveOverloadFails || 0) + 1;
                if (state._consecutiveOverloadFails >= LLM_DEFAULTS.consecutiveOverloadThreshold) {
                    addLog(`⚠️ 连续${state._consecutiveOverloadFails}章限流失败，暂停${LLM_DEFAULTS.overloadPauseMs/1000}秒等待配额恢复...`);
                    await waitWithStop(LLM_DEFAULTS.overloadPauseMs);
                    state._consecutiveOverloadFails = 0;
                } else {
                    addLog(`API服务繁忙/限流(${state._consecutiveOverloadFails}/${LLM_DEFAULTS.consecutiveOverloadThreshold})，等待${LLM_DEFAULTS.overloadedWaitMs/1000}秒后继续...`);
                    await waitWithStop(LLM_DEFAULTS.overloadedWaitMs);
                }
            } else if (execResult.success) {
                state._consecutiveOverloadFails = 0;
                broadcastToProject(projectId, 'pipeline:chapter-approved', { chapterNumber: ch.chapterNumber });
            }

            if (iteration % 10 === 0) {
                try { await persistState(projectId, state); } catch (e) { logger.warn('infinitePipeline', 'Periodic persist failed', { eMessage: e.message }); }  // DEGRADE: 影响=persistState 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
            }
        }

        state.running = false;
        addLog(`Pipeline结束，共完成${state.completedChapters}章`);
        try { await persistState(projectId, state); } catch (e) { logger.warn('infinitePipeline', 'Final persist failed', { eMessage: e.message }); }  // DEGRADE: 影响=persistState 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
        broadcastToProject(projectId, 'pipeline:status', { running: false, stopped: false, completedChapters: state.completedChapters, phase: 'stopped' });
        broadcastToProject(projectId, 'pipeline:complete', { completedChapters: state.completedChapters });
        return { success: true, completedChapters: state.completedChapters, logs: state.logs };
    } catch (outerErr) {
        logger.error('infinitePipeline', 'Fatal error in infinite pipeline:', { outerErrMessage: outerErr.message });
        state.running = false;
        state.lastError = outerErr.message;
        try { await persistState(projectId, state); } catch (e) { /* silent */ }
        return { success: false, completedChapters: state.completedChapters || 0, logs: state.logs || [], lastError: outerErr.message };
    } finally {
        if (state._clearHeartbeat) state._clearHeartbeat();
        setTimeout(async () => {
            await deleteState(projectId);
            logger.info('infinitePipeline', 'Cleaned up state for project', { projectId });
        }, STATE_CLEANUP_DELAY_MS);
    }
}

async function stopInfinitePipeline(projectId) {
    const state = getState(projectId);
    if (!state) return { success: true, message: 'No running pipeline (already stopped)' };

    state.stopped = true;
    state.running = false;
    if (state._clearHeartbeat) state._clearHeartbeat();

    try {
        const persisted = await store.getItem('infinite-pipeline-state', projectId);
        if (persisted) {
            persisted.running = false;
            persisted.stopped = true;
            persisted.phase = 'stopped';
            await store.setItem('infinite-pipeline-state', projectId, persisted);
        }
    } catch (persistErr) { logger.warn('infinitePipeline', 'Stop persist failed', { persistErrMessage: persistErr.message }); }  // DEGRADE: 影响=store.getItem 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    const RESET_STATUSES = ['failed-skipped', 'timeout-skipped', 'context-error', 'cooldown-waiting', 'pipeline-failed'];
    try {
        const chapters = await store.queryItems('chapters', { projectId });
        for (const ch of chapters) {
            const needsReset = STUCK_STATUSES.includes(ch.status) || RESET_STATUSES.includes(ch.status);
            if (needsReset) {
                ch.status = STATUS_VALUES.OUTLINED;
                delete ch.skipUntil;
                ch._pipelineRetries = 0;
                ch._wordCountRetry = 0;
                delete ch._skipReason;
                ch.updatedAt = new Date().toISOString();
                await store.setItem('chapters', ch.id, ch);
            }
        }
    } catch (e) { logger.warn('infinitePipeline', 'Stop cleanup failed', { eMessage: e.message }); }  // DEGRADE: 影响=批次内章节落库 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    setTimeout(async () => {
        await deleteState(projectId);
        logger.info('infinitePipeline', 'Cleaned up state after stop', { projectId });
    }, STATE_CLEANUP_DELAY_MS);

    broadcastToProject(projectId, 'pipeline:status', { running: false, stopped: true, phase: 'stopped' });
    return { success: true, message: 'Stop signal sent. Stuck chapters cleaned up.' };
}

function setRunPipelineStepFn(fn) {
    initSetStepRef(fn);
    execSetStepRef(fn);
}

module.exports = { runInfinitePipeline, stopInfinitePipeline, setRunPipelineStepFn };
