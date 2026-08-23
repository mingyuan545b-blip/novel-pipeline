const store = require("../../../store");
const { STUCK_STATUSES } = require("../../chapterStatus");
const logger = require("../../../shared/logger");

const INFINITE_PIPELINE_STATE = {};
const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_STALE_THRESHOLD_MS = 60000;
const MAX_IN_MEMORY_LOGS = 500;
const MAX_CONCURRENT_PIPELINES = 10;
const STATE_CLEANUP_DELAY_MS = 10000;
const MAX_STATE_ENTRIES = 20;

async function getState(projectId) {
    if (INFINITE_PIPELINE_STATE[projectId]) {
        return INFINITE_PIPELINE_STATE[projectId];
    }
    const persisted = await store.getItem('infinite-pipeline-state', projectId);
    if (persisted) {
        INFINITE_PIPELINE_STATE[projectId] = _hydrateFromStore(persisted);
        return INFINITE_PIPELINE_STATE[projectId];
    }
    return null;
}

function _hydrateFromStore(persisted) {
    return {
        running: persisted.running || false,
        stopped: persisted.stopped || false,
        currentChapter: persisted.currentChapter || null,
        completedChapters: persisted.completedChapters || 0,
        supplementCount: persisted.supplementCount || 0,
        lastError: null,
        phase: persisted.phase || '',
        batchProgress: persisted.batchProgress || '',
        lastHeartbeat: persisted.lastHeartbeat || null,
        logs: persisted.logs || [],
        _heartbeatTimer: null,
        _clearHeartbeat: null
    };
}

async function setState(projectId, data) {
    INFINITE_PIPELINE_STATE[projectId] = data;
    await persistState(projectId, data);
}

async function persistState(projectId, state, overrides = {}) {
    try {
        await store.setItem('infinite-pipeline-state', projectId, {
            id: projectId,
            projectId,
            running: state.running,
            stopped: state.stopped,
            currentChapter: state.currentChapter,
            completedChapters: state.completedChapters,
            supplementCount: state.supplementCount,
            phase: state.phase,
            batchProgress: state.batchProgress,
            lastHeartbeat: state.lastHeartbeat,
            logs: (state.logs || []).slice(-200),
            updatedAt: new Date().toISOString(),
            ...overrides
        });
    } catch (persistErr) {
        logger.warn('infinitePipeline', '[INFINITE] Failed to persist state:', { persistErrMessage: persistErr.message });
    }
}

async function deleteState(projectId) {
    delete INFINITE_PIPELINE_STATE[projectId];
    try {
        await store.deleteItem('infinite-pipeline-state', projectId);
    } catch (delErr) {
        logger.warn('infinitePipeline', '[INFINITE] Failed to delete persisted state:', { delErrMessage: delErr.message });
    }
}

function getActiveCount() {
    return Object.values(INFINITE_PIPELINE_STATE).filter(s => s.running).length;
}

function cleanupStaleStateEntries() {
    const entries = Object.entries(INFINITE_PIPELINE_STATE);
    if (entries.length <= MAX_STATE_ENTRIES) return;
    for (const [pid, s] of entries) {
        if (!s.running) {
            if (s._clearHeartbeat) s._clearHeartbeat();
            delete INFINITE_PIPELINE_STATE[pid];
        }
    }
}

async function getInfinitePipelineStatus(projectId) {
    const state = await getState(projectId);
    if (!state) {
        return { running: false };
    }
    return {
        running: state.running,
        stopped: state.stopped,
        currentChapter: state.currentChapter,
        completedChapters: state.completedChapters,
        supplementCount: state.supplementCount || 0,
        lastError: state.lastError || null,
        phase: state.phase || '',
        batchProgress: state.batchProgress || '',
        logs: (state.logs || []).slice(-30)
    };
}

async function forceResetPipeline(projectId) {
    if (INFINITE_PIPELINE_STATE[projectId]) {
        if (INFINITE_PIPELINE_STATE[projectId]._clearHeartbeat) {
            INFINITE_PIPELINE_STATE[projectId]._clearHeartbeat();
        }
        INFINITE_PIPELINE_STATE[projectId].stopped = true;
        INFINITE_PIPELINE_STATE[projectId].running = false;
    }
    delete INFINITE_PIPELINE_STATE[projectId];
    try {
        const persisted = await store.getItem('infinite-pipeline-state', projectId);
        if (persisted) {
            persisted.running = false;
            persisted.stopped = false;
            persisted.updatedAt = new Date().toISOString();
            await store.setItem('infinite-pipeline-state', projectId, persisted);
        } else {
            await store.deleteItem('infinite-pipeline-state', projectId);
        }
    } catch (resetErr) {
        logger.warn('infinitePipeline', '[INFINITE] Force reset persist failed:', { resetErrMessage: resetErr.message });
        try { await store.deleteItem('infinite-pipeline-state', projectId); } catch (delErr) { logger.warn('infinitePipeline', '[INFINITE] Force delete failed:', { delErrMessage: delErr.message }); }
    }
    const projectLogs = await store.queryItems('pipeline-logs', { projectId });
    for (const l of (projectLogs || [])) {
        try { await store.deleteItem('pipeline-logs', l.id); } catch (delErr) { logger.warn('infinitePipeline', '[INFINITE] Pipeline log delete failed:', { delErrMessage: delErr.message }); }
    }
    return { success: true, message: 'Pipeline state and logs reset' };
}

async function cleanupStalePipelineStates() {
    let cleaned = 0;
    try {
        const allStates = await store.listItems('infinite-pipeline-state');
        for (const state of allStates) {
            if (!state.running) continue;
            const lastHb = state.lastHeartbeat || 0;
            const updatedAt = new Date(state.updatedAt || 0).getTime();
            const lastSignal = Math.max(lastHb, updatedAt);
            const staleMs = Date.now() - lastSignal;
            if (staleMs > HEARTBEAT_STALE_THRESHOLD_MS) {
                logger.warn('infinitePipeline', '[INFINITE] Zombie pipeline detected for project {stateProjectId}, last heartbeat {value2}s ago. Auto-resetting.', { stateProjectId: state.projectId, value2: Math.round(staleMs / 1000) });
                await forceResetPipeline(state.projectId);
                const chapters = await store.queryItems('chapters', { projectId: state.projectId });
                for (const ch of chapters) {
                    if (STUCK_STATUSES.includes(ch.status) || ch.status === 'pipeline-failed') {
                        ch.status = 'outlined';
                        delete ch.skipUntil;
                        ch._pipelineRetries = 0;
                        ch._wordCountRetry = 0;
                        ch.updatedAt = new Date().toISOString();
                        await store.setItem('chapters', ch.id, ch);
                    }
                }
                cleaned++;
            }
        }
    } catch (e) {
        logger.warn('infinitePipeline', '[INFINITE] Stale state cleanup failed:', { eMessage: e.message });
    }
    return cleaned;
}

module.exports = {
    INFINITE_PIPELINE_STATE,
    HEARTBEAT_INTERVAL_MS,
    HEARTBEAT_STALE_THRESHOLD_MS,
    MAX_IN_MEMORY_LOGS,
    MAX_CONCURRENT_PIPELINES,
    STATE_CLEANUP_DELAY_MS,
    MAX_STATE_ENTRIES,
    getState,
    setState,
    deleteState,
    getActiveCount,
    cleanupStaleStateEntries,
    persistState,
    getInfinitePipelineStatus,
    forceResetPipeline,
    cleanupStalePipelineStates
};
