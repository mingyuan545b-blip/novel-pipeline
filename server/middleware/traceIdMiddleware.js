'use strict';

/**
 * Trace ID 中间件
 *
 * 职责：
 * 1. 从请求头 X-Trace-Id 读取（前端可传入用于关联）
 * 2. 无传入时生成新 traceId
 * 3. 注入 AsyncLocalStorage 上下文，使后续所有同步/异步代码可读取
 * 4. 在响应头回写 X-Trace-Id，前端可记录并反馈用于排查
 * 5. 请求完成时记录 summary 日志到 logStore（消除成功响应盲点）
 *
 * 必须在 apiResponse、errorHandler、所有路由之前注册
 *
 * 文件位置：server/middleware/traceIdMiddleware.js
 */

const { generateTraceId, runWithTraceId } = require('../shared/traceContext');
const logger = require('../shared/logger');

const TRACE_ID_HEADER = 'x-trace-id';

// 不记录 summary 日志的路径前缀（静态资源、高频健康检查）
const SKIP_PATH_PREFIXES = [
    '/output/',
    '/api/health',
    '/api/version'
];

/**
 * 判断是否应跳过 summary 日志记录
 */
function shouldSkipSummary(path) {
    return SKIP_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
}

function traceIdMiddleware(req, res, next) {
    // 优先使用前端传入的 traceId（便于跨端关联），否则生成新 ID
    const traceId = (req.headers[TRACE_ID_HEADER] || generateTraceId()).slice(0, 64);

    // 挂载到 req 供非 logger 场景使用（如错误响应体）
    req.traceId = traceId;

    // 回写响应头，前端可记录用于反馈
    res.setHeader('X-Trace-Id', traceId);

    // 记录请求开始时间，用于计算耗时
    const startTime = Date.now();

    // 请求完成后记录 summary 日志
    // 注意：res.on('finish') 是事件回调，可能不在 AsyncLocalStorage 上下文内
    // 因此用 runWithTraceId 重新进入上下文，确保 logger 能读取 traceId
    res.on('finish', () => {
        const reqPath = req.originalUrl || req.path;
        if (shouldSkipSummary(reqPath)) return;

        runWithTraceId(traceId, () => {
            const duration = Date.now() - startTime;
            const status = res.statusCode;
            const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
            const message = `${req.method} ${reqPath} ${status} ${duration}ms`;

            logger[level]('request', message, {
                method: req.method,
                path: reqPath,
                status,
                duration
            });
        });
    });

    // 进入 AsyncLocalStorage 上下文，后续 next() 链路内的所有代码均可读取 traceId
    runWithTraceId(traceId, next);
}

module.exports = { traceIdMiddleware, TRACE_ID_HEADER };
