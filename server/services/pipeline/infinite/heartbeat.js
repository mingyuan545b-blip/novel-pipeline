const store = require("../../../store");
const logger = require("../../../shared/logger");
const { HEARTBEAT_INTERVAL_MS } = require("./stateManager");

const HEARTBEAT_PERSIST_INTERVAL = 3;

function startHeartbeat(projectId, state) {
    let tickCount = 0;
    const timer = setInterval(async () => {
        try {
            state.lastHeartbeat = Date.now();
            tickCount++;
            if (tickCount % HEARTBEAT_PERSIST_INTERVAL !== 0) return;
            const persisted = await store.getItem('infinite-pipeline-state', projectId);
            if (persisted) {
                persisted.lastHeartbeat = state.lastHeartbeat;
                persisted.running = true;
                persisted.stopped = state.stopped;
                persisted.currentChapter = state.currentChapter;
                persisted.phase = state.phase;
                persisted.batchProgress = state.batchProgress;
                persisted.completedChapters = state.completedChapters;
                persisted.supplementCount = state.supplementCount;
                await store.setItem('infinite-pipeline-state', projectId, persisted);
            }
        } catch (hbErr) { logger.warn('infinitePipeline', '[INFINITE] Heartbeat persist failed:', { hbErrMessage: hbErr.message }); }  // DEGRADE: 影响=心跳写库 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }, HEARTBEAT_INTERVAL_MS);
    state.lastHeartbeat = Date.now();
    state._heartbeatTimer = timer;
    return timer;
}

function clearHeartbeat(state) {
    if (state._heartbeatTimer) {
        clearInterval(state._heartbeatTimer);
        state._heartbeatTimer = null;
    }
}

module.exports = {
    startHeartbeat,
    clearHeartbeat
};
