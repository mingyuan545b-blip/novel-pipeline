const { getTraceId } = require('../shared/traceContext');

/**
 * 响应格式化器
 *
 * 统一所有响应（成功/错误/分页）的 shape
 * 错误响应包含 traceId（在请求上下文内）+ timestamp
 * 文件位置：server/middleware/responseFormatter.js
 */

function success(data, message = 'ok') {
    return { success: true, message, data, timestamp: new Date().toISOString() };
}

/**
 * 错误响应格式化
 * @param {string} errorMsg - 错误消息
 * @param {string} code - 错误码（语义化字符串，如 'VALIDATION_ERROR'；默认 'INTERNAL_ERROR'）
 * @param {*} details - 附加细节（可选）
 * @returns {Object}
 */
function error(errorMsg, code = 'INTERNAL_ERROR', details = null) {
    const result = {
        success: false,
        error: errorMsg,
        code,
        timestamp: new Date().toISOString()
    };
    const traceId = getTraceId();
    if (traceId) result.traceId = traceId;
    if (details) result.details = details;
    return result;
}

function paginated(data, total, page, pageSize) {
    return {
        success: true,
        data,
        pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
        timestamp: new Date().toISOString()
    };
}

function created(data, message = 'created') {
    return { success: true, message, data, timestamp: new Date().toISOString() };
}

function noContent() {
    return { success: true, message: 'deleted', timestamp: new Date().toISOString() };
}

module.exports = { success, error, paginated, created, noContent };
