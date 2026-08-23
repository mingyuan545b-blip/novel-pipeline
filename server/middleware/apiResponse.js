const { filterApiResponse } = require('./sensitiveFilter');
const { getTraceId } = require('../shared/traceContext');
const logger = require('../shared/logger');
const { extractRequestContext } = require('./errorContextHelper');

/**
 * API 响应中间件
 *
 * 职责：
 * 1. 通过 filterApiResponse 对响应体进行敏感数据过滤
 * 2. 挂载 res.apiOk / res.apiList / res.apiError 便捷方法
 * 3. res.apiError 返回与 errorHandler 一致的统一 shape（含 traceId/timestamp）
 * 4. res.apiError 在 4xx/5xx 时记录错误日志到 logStore（方向 F：错误栈追踪）
 *
 * 注意：本中间件不提供 asyncHandler，统一使用 errorHandler.asyncHandler
 * 文件位置：server/middleware/apiResponse.js
 */
function apiResponse(req, res, next) {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (body && typeof body === 'object') {
            originalJson(filterApiResponse(body));
        } else {
            originalJson(body);
        }
    };

    /**
     * 成功响应便捷方法
     * @param {*} data - 响应数据
     * @param {Object} [meta] - 可选元信息（如分页）
     * @param {number} [status=200] - HTTP 状态码（如 201 创建场景）
     */
    res.apiOk = (data, meta, status = 200) => {
        const body = { success: true, data };
        if (meta) body.meta = meta;
        res.status(status).json(body);
    };

    res.apiList = (items, meta) => {
        const body = { success: true, data: items };
        if (meta) body.meta = meta;
        else if (Array.isArray(items)) body.meta = { total: items.length };
        res.json(body);
    };

    /**
     * 统一错误响应方法
     * @param {number} status - HTTP 状态码
     * @param {string} error - 错误消息
     * @param {string} code - 错误码（语义化字符串，如 'VALIDATION_ERROR'）
     * @param {*} details - 附加细节（可选）
     */
    res.apiError = (status, error, code, details = null) => {
        const body = {
            success: false,
            error,
            code: code || `HTTP_${status}`,
            traceId: getTraceId(),
            timestamp: new Date().toISOString()
        };
        if (details) body.details = details;

        // 方向 F：4xx/5xx 记录错误日志到 logStore，便于错误检索
        const errCode = code || `HTTP_${status}`;
        const logContext = {
            code: errCode,
            statusCode: status,
            message: error,
            context: extractRequestContext(req)
        };
        if (status >= 500) {
            logger.error('api', `${req.method} ${req.path} → ${errCode}`, logContext);
        } else if (status >= 400) {
            logger.warn('api', `${req.method} ${req.path} → ${errCode}`, logContext);
        }

        res.status(status).json(body);
    };

    next();
}

module.exports = { apiResponse };
