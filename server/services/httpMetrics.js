'use strict';

/**
 * httpMetrics.js — HTTP 请求耗时指标聚合（M2）
 *
 * 按 method+path 聚合 HTTP 请求指标：
 * - 请求计数与失败计数（4xx/5xx）
 * - 耗时统计（totalMs/avgMs/maxMs/p95Ms）
 * - 慢请求计数（>= SLOW_REQUEST_MS）
 * - 最近请求历史（含耗时）
 *
 * 数据源：由 httpMetricsMiddleware 在 res.on('finish') 时调用 recordRequest
 *
 * 文件位置：server/services/httpMetrics.js
 */

const { percentile } = require('../utils/percentile');

const MAX_HISTORY = 200;
const SLOW_REQUEST_MS = 3000; // HTTP 慢请求阈值（3 秒）

const routeStats = new Map();

/**
 * 规范化路径：将 /api/projects/123 归一化为 /api/projects/:id
 * 避免每个 ID 占用独立 key 导致聚合失效
 */
function normalizePath(path) {
    if (!path || typeof path !== 'string') return 'UNKNOWN';
    return path
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
        .replace(/\/\d+/g, '/:id');
}

/**
 * 构建聚合 key
 */
function buildKey(method, path) {
    return `${method || 'UNKNOWN'} ${normalizePath(path)}`;
}

/**
 * 记录一次 HTTP 请求
 * @param {string} method - HTTP 方法
 * @param {string} path - 请求路径（原始值，内部会归一化）
 * @param {number} status - HTTP 状态码
 * @param {number} durationMs - 耗时（毫秒）
 */
function recordRequest(method, path, status, durationMs) {
    const key = buildKey(method, path);
    if (!routeStats.has(key)) {
        routeStats.set(key, {
            totalMs: 0, count: 0, failureCount: 0, slowCount: 0,
            maxMs: 0, lastRequests: []
        });
    }

    const stats = routeStats.get(key);
    stats.count += 1;
    stats.totalMs += durationMs;
    if (durationMs > stats.maxMs) stats.maxMs = durationMs;
    if (status >= 400) stats.failureCount += 1;
    if (durationMs >= SLOW_REQUEST_MS) stats.slowCount += 1;

    stats.lastRequests.push({
        timestamp: new Date().toISOString(),
        status,
        durationMs
    });
    if (stats.lastRequests.length > MAX_HISTORY) {
        stats.lastRequests.shift();
    }
}

/**
 * 计算 p95 分位数（复用 percentile 工具）
 */
function computeP95(stats) {
    const durations = stats.lastRequests.map(r => r.durationMs);
    return percentile(durations, 0.95);
}

function getRouteMetrics(method, path) {
    const key = buildKey(method, path);
    const stats = routeStats.get(key);
    if (!stats) return null;
    return {
        route: key,
        count: stats.count,
        failureCount: stats.failureCount,
        slowCount: stats.slowCount,
        avgMs: stats.count > 0 ? Math.round(stats.totalMs / stats.count) : 0,
        maxMs: stats.maxMs,
        p95Ms: computeP95(stats),
        recentRequests: stats.lastRequests.slice(-20)
    };
}

function getAllMetrics() {
    const result = {};
    for (const [key, stats] of routeStats) {
        result[key] = {
            count: stats.count,
            failureCount: stats.failureCount,
            slowCount: stats.slowCount,
            avgMs: stats.count > 0 ? Math.round(stats.totalMs / stats.count) : 0,
            maxMs: stats.maxMs,
            p95Ms: computeP95(stats),
            recentRequests: stats.lastRequests.slice(-20)
        };
    }
    return result;
}

/**
 * 获取慢请求 top N（按 p95 降序）
 */
function getSlowRoutes(limit = 10) {
    const all = [];
    for (const [key, stats] of routeStats) {
        if (stats.count === 0) continue;
        all.push({
            route: key,
            count: stats.count,
            p95Ms: computeP95(stats),
            avgMs: stats.count > 0 ? Math.round(stats.totalMs / stats.count) : 0,
            slowCount: stats.slowCount
        });
    }
    all.sort((a, b) => b.p95Ms - a.p95Ms);
    return all.slice(0, limit);
}

function resetMetrics() {
    routeStats.clear();
}

module.exports = {
    recordRequest,
    getRouteMetrics,
    getAllMetrics,
    getSlowRoutes,
    resetMetrics,
    normalizePath,
    SLOW_REQUEST_MS
};
