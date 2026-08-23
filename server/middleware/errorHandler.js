const logger = require('../shared/logger');
const { AppError } = require('../shared/errors');
const { getTraceId } = require('../shared/traceContext');
const { extractRequestContext } = require('./errorContextHelper');

/**
 * 统一错误响应 shape 构造器
 * @param {string} message - 错误消息
 * @param {string} code - 错误码（语义化字符串，如 'VALIDATION_ERROR'）
 * @param {*} details - 附加细节（可选）
 * @returns {Object} 统一错误响应体
 */
function buildErrorBody(message, code, details = null) {
    const body = {
        success: false,
        error: message,
        code: code || 'INTERNAL_ERROR',
        traceId: getTraceId(),
        timestamp: new Date().toISOString()
    };
    if (details) body.details = details;
    return body;
}

function errorHandler(err, req, res, _next) {
    const context = extractRequestContext(req);

    if (err instanceof AppError) {
        logger.warn('api', `${req.method} ${req.path} → ${err.code}`, {
            code: err.code,
            statusCode: err.statusCode,
            message: err.message,
            stack: err.stack,
            context
        });
        const body = buildErrorBody(err.message, err.code, err.field || null);
        return res.status(err.statusCode).json(body);
    }

    if (err.type === 'entity.parse.failed') {
        logger.warn('api', `Invalid JSON: ${req.method} ${req.path}`, { context });
        return res.status(400).json(buildErrorBody('Invalid JSON body', 'PARSE_ERROR'));
    }

    if (err.type === 'entity.too.large') {
        logger.warn('api', `Payload too large: ${req.method} ${req.path}`, { context });
        return res.status(413).json(buildErrorBody('Payload too large', 'PAYLOAD_TOO_LARGE'));
    }

    logger.error('api', `Unhandled error: ${req.method} ${req.path}`, {
        error: err.message,
        stack: err.stack,
        context
    });

    const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
    res.status(500).json(buildErrorBody(message, 'INTERNAL_ERROR'));
}

/**
 * asyncHandler：将 async 路由的 reject 转为 next(err)，
 * 统一交由 errorHandler 中间件处理，避免错误响应 shape 分裂
 */
function asyncHandler(fn) {
    return function (req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = { errorHandler, asyncHandler, buildErrorBody };
