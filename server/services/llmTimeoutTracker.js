/**
 * llmTimeoutTracker — LLM 超时/慢请求计数与快照（供健康检查与看门狗预警）
 *
 * 背景（2026-09-21 20章E2E）：一次 final-editor 调用在网关侧挂住 13 分钟，
 * 任务状态永远 running，前端/脚本一直空转轮询。事后只能翻日志才发现。
 * 这里把"超时/慢请求"做成可查询指标，健康检查直接暴露，避免再次靠翻日志定位。
 */
const logger = require('../shared/logger');

const MAX_RECENT = 20;

const state = {
    timeouts: 0,
    slowRequests: 0,
    totalRequests: 0,
    consecutiveTimeouts: 0,
    lastTimeout: null,
    lastSlow: null,
    recent: []
};

function _push(entry) {
    state.recent.push(entry);
    if (state.recent.length > MAX_RECENT) state.recent.shift();
}

function recordRequest() {
    state.totalRequests++;
}

function record(provider, model, durationMs, timeoutMs) {
    state.timeouts++;
    state.consecutiveTimeouts++;
    state.lastTimeout = { provider, model, durationMs, timeoutMs, at: new Date().toISOString() };
    _push({ kind: 'timeout', provider, model, durationMs, timeoutMs, at: state.lastTimeout.at });
    if (state.consecutiveTimeouts >= 3) {
        logger.error('llm', `[LLM] 连续 ${state.consecutiveTimeouts} 次请求超时，疑似供应商网关异常，建议检查网络/切换供应商`, {
            consecutiveTimeouts: state.consecutiveTimeouts, provider, model, errorCode: 'LLM_TIMEOUT_STREAK'
        });
    }
}

function recordSlow(provider, model, durationMs) {
    state.slowRequests++;
    state.lastSlow = { provider, model, durationMs, at: new Date().toISOString() };
    _push({ kind: 'slow', provider, model, durationMs, at: state.lastSlow.at });
}

function recordSuccess() {
    state.consecutiveTimeouts = 0;
}

function snapshot() {
    return {
        totalRequests: state.totalRequests,
        timeouts: state.timeouts,
        slowRequests: state.slowRequests,
        consecutiveTimeouts: state.consecutiveTimeouts,
        lastTimeout: state.lastTimeout,
        lastSlow: state.lastSlow,
        recent: state.recent.slice(-5),
        degraded: state.consecutiveTimeouts >= 3
    };
}

function reset() {
    state.timeouts = 0; state.slowRequests = 0; state.totalRequests = 0;
    state.consecutiveTimeouts = 0; state.lastTimeout = null; state.lastSlow = null; state.recent = [];
}

module.exports = { record, recordSlow, recordRequest, recordSuccess, snapshot, reset };
