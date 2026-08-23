const { broadcastToProject } = require("../../websocket");
const { persistState, MAX_IN_MEMORY_LOGS } = require("./stateManager");
const logger = require("../../../shared/logger");

const PERSIST_INTERVAL_MS = 30000;

function createPipelineLogger(projectId, state) {
    let _lastPersistMs = Date.now();

    async function addLog(msg, structuredData) {
        let auto = {};
        if (!structuredData) {
            const chMatch = msg.match(/第(\d+)章/);
            const chapterNumber = chMatch ? parseInt(chMatch[1]) : undefined;
            if (msg.includes('开始完整流水线')) {
                auto = { step: 'pipeline-start', passed: true, chapterNumber };
            } else if (msg.includes('完成 ✅')) {
                auto = { step: 'pipeline-done', passed: true, chapterNumber };
            } else if (msg.includes('异常 ❌')) {
                auto = { step: 'pipeline-error', passed: false, chapterNumber };
            } else if (msg.includes('字数不达标') || msg.includes('字数连续')) {
                auto = { step: 'word-count-fail', passed: false, chapterNumber };
            } else if (msg.includes('审核未通过')) {
                auto = { step: 'review-fail', passed: false, chapterNumber };
            } else if (msg.includes('永久跳过')) {
                auto = { step: 'chapter-skip', passed: false, chapterNumber };
            } else if (msg.includes('素材更新')) {
                auto = { step: 'material-update', chapterNumber };
            } else if (msg.includes('补充') && msg.includes('大纲')) {
                auto = { step: 'outline-supplement' };
            } else if (msg.includes('冷却')) {
                auto = { step: 'cooldown', chapterNumber };
            } else if (msg.includes('停止')) {
                auto = { step: 'pipeline-stop' };
            } else if (chapterNumber) {
                auto = { step: 'chapter-status', chapterNumber };
            }
        }
        const entry = {
            time: new Date().toISOString(),
            msg,
            ...auto,
            ...(structuredData || {})
        };
        state.logs.push(entry);
        if (state.logs.length > MAX_IN_MEMORY_LOGS) state.logs = state.logs.slice(-Math.floor(MAX_IN_MEMORY_LOGS * 0.6));
        logger.info('infinitePipeline', '[INFINITE] {msg}', { msg });
        const nowMs = Date.now();
        const isChapterComplete = msg.includes('完成 ✅') || msg.includes('异常 ❌');
        if (isChapterComplete || (nowMs - _lastPersistMs) >= PERSIST_INTERVAL_MS) {
            _lastPersistMs = nowMs;
            try {
                await persistState(projectId, state, { logs: state.logs.slice(-200) });
            } catch (persistErr) {
                logger.warn('infinitePipeline', '[INFINITE] Failed to persist state:', { persistErrMessage: persistErr.message });
            }
        }
        broadcastToProject(projectId, 'pipeline:log', entry);
        if (isChapterComplete) {
            broadcastToProject(projectId, 'pipeline:chapter-complete', {
                chapterNumber: entry.chapterNumber,
                success: msg.includes('完成 ✅'),
                msg
            });
        }
    }

    return { addLog };
}

module.exports = { createPipelineLogger };
