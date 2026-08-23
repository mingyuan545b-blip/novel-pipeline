/**
 * Trace ID 前端工具
 *
 * 职责：
 * 1. 从 axios 响应头/错误响应体提取 traceId
 * 2. 存储最近一次请求的 traceId（便于用户反馈）
 * 3. 提供格式化错误消息（含 traceId 反馈指引）
 *
 * 与后端 traceIdMiddleware.js 配套：
 * - 后端在响应头写入 X-Trace-Id
 * - 后端在错误响应体写入 traceId 字段
 * - 前端在此处统一提取，不依赖响应来源
 *
 * 文件位置：client/src/services/api/traceIdHelper.js
 */

const TRACE_ID_HEADER = 'x-trace-id';
const MAX_HISTORY = 20;

// 最近请求的 traceId 历史（便于用户反馈最后一次错误）
const _traceIdHistory = [];

/**
 * 从 axios 响应对象提取 traceId
 * 优先级：响应头 > 响应体字段
 * 注意：axios 会将响应头名称转为小写，因此统一用小写 key 读取
 * @param {Object} response - axios 响应对象
 * @returns {string|null}
 */
function extractTraceIdFromResponse(response) {
    if (!response) return null;

    // 优先从响应头提取（axios 自动将 header name 转为小写）
    const headerTraceId = response.headers?.[TRACE_ID_HEADER];
    if (headerTraceId) return headerTraceId;

    // 兜底从错误响应体提取（errorHandler 路径才有）
    const bodyTraceId = response.data?.traceId;
    return bodyTraceId || null;
}

/**
 * 从 axios 错误对象提取 traceId
 * @param {Object} error - axios 错误对象
 * @returns {string|null}
 */
function extractTraceIdFromError(error) {
    if (!error) return null;

    // 1. 错误响应对象（HTTP 4xx/5xx）
    if (error.response) {
        return extractTraceIdFromResponse(error.response);
    }

    // 2. 请求已发出但无响应（网络错误/超时）- 无 traceId
    // 3. 请求配置阶段错误 - 无 traceId
    return null;
}

/**
 * 记录 traceId 到历史
 * @param {string} traceId
 */
function recordTraceId(traceId) {
    if (!traceId) return;
    _traceIdHistory.unshift({ traceId, timestamp: Date.now() });
    if (_traceIdHistory.length > MAX_HISTORY) {
        _traceIdHistory.length = MAX_HISTORY;
    }
}

/**
 * 获取最近一次 traceId
 * @returns {string|null}
 */
function getLastTraceId() {
    return _traceIdHistory[0]?.traceId || null;
}

/**
 * 获取 traceId 历史
 * @returns {Array<{traceId: string, timestamp: number}>}
 */
function getTraceIdHistory() {
    return [..._traceIdHistory];
}

/**
 * 格式化错误消息（含 traceId 反馈指引）
 * @param {string} message - 原始错误消息
 * @param {string|null} traceId - traceId（可选）
 * @returns {string}
 */
function formatErrorMessage(message, traceId) {
    if (!traceId) return message;
    return `${message}\n\n错误追踪码：${traceId}\n（反馈此码可帮助快速定位问题）`;
}

/**
 * 清空 traceId 历史
 */
function clearTraceIdHistory() {
    _traceIdHistory.length = 0;
}

export {
    extractTraceIdFromResponse,
    extractTraceIdFromError,
    recordTraceId,
    getLastTraceId,
    getTraceIdHistory,
    formatErrorMessage,
    clearTraceIdHistory,
    TRACE_ID_HEADER
};
