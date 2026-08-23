'use strict';

/**
 * HTTP 请求耗时指标中间件（M2）
 *
 * 职责：
 * 1. 记录每个 HTTP 请求的耗时
 * 2. 调用 httpMetrics.recordRequest 按 method+path 聚合
 * 3. 慢请求（>= 3s）写入 logStore 便于检索
 *
 * 挂载位置：在 traceIdMiddleware 之后、路由之前
 *
 * 文件位置：server/middleware/httpMetricsMiddleware.js
 */

const httpMetrics = require('../services/httpMetrics');
const logger = require('../shared/logger');

// 不记录指标的路径前缀（静态资源、健康检查等高频低价值请求）
const SKIP_PATH_PREFIXES = [
    '/output/',
    '/api/health',
    '/api/version'
];

function shouldSkip(path) {
    return SKIP_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
}

function httpMetricsMiddleware(req, res, next) {
    const startTime = Date.now();

    res.on('finish', () => {
        const reqPath = req.originalUrl || req.path || '';
        if (shouldSkip(reqPath)) return;

        const duration = Date.now() - startTime;
        const status = res.statusCode;
        const method = req.method || 'UNKNOWN';

        httpMetrics.recordRequest(method, reqPath, status, duration);

        // 慢请求写入日志，便于在调试页面检索
        if (duration >= httpMetrics.SLOW_REQUEST_MS) {
            logger.warn('httpMetrics', `SLOW ${method} ${reqPath} ${status} ${duration}ms`, {
                method,
                path: reqPath,
                status,
                durationMs: duration,
                slow: true
            });
        }
    });

    next();
}

module.exports = { httpMetricsMiddleware };
