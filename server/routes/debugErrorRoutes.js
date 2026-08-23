'use strict';

/**
 * 错误检索路由（方向 F：错误栈追踪）
 *
 * 提供错误级别日志的专门检索端点，便于快速定位错误：
 * 1. GET /errors — 列出最近的 error 级别日志（含 stack + context）
 * 2. GET /errors/stats — 按错误码聚合统计
 *
 * 挂载点：/api/debug（在 routeRegistration.js 中注册）
 * 文件位置：server/routes/debugErrorRoutes.js
 */

const express = require('express');
const { logStore } = require('../shared/logStore');
const { debugPersister } = require('../shared/debugPersister');
const { parseLimit } = require('../middleware/validators');

const router = express.Router();

const STATS_TRACE_LIMIT = 500;

function extractErrorEntries(traceId, record) {
    if (!record || !record.logs) return [];
    return record.logs
        .filter(e => e.level === 'error' || e.level === 'warn')
        .map(e => {
            const ctx = e.context || {};
            return {
                traceId,
                timestamp: e.timestamp,
                level: e.level,
                module: e.module,
                message: e.message,
                code: ctx.code || null,
                stack: ctx.stack || null,
                context: ctx.context || null
            };
        });
}

router.get('/errors', (req, res) => {
    const limit = parseLimit(req.query.limit);
    const traces = logStore.listRecentTraces({ limit: STATS_TRACE_LIMIT });
    const errors = [];
    for (const t of traces) {
        const hasErrorOrWarn = (t.levelCounts?.error || 0) > 0 || (t.levelCounts?.warn || 0) > 0;
        if (!hasErrorOrWarn) continue;
        const record = logStore.getByTraceId(t.traceId);
        errors.push(...extractErrorEntries(t.traceId, record));
    }
    errors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const sliced = errors.slice(0, limit);
    res.apiOk(sliced, { total: errors.length, returned: sliced.length });
});

router.get('/errors/stats', (req, res) => {
    const traces = logStore.listRecentTraces({ limit: STATS_TRACE_LIMIT });
    const byCode = {};
    const byModule = {};
    let total = 0;
    for (const t of traces) {
        const hasErrorOrWarn = (t.levelCounts?.error || 0) > 0 || (t.levelCounts?.warn || 0) > 0;
        if (!hasErrorOrWarn) continue;
        const record = logStore.getByTraceId(t.traceId);
        const entries = extractErrorEntries(t.traceId, record);
        for (const e of entries) {
            total++;
            const code = e.code || 'UNKNOWN';
            byCode[code] = (byCode[code] || 0) + 1;
            byModule[e.module] = (byModule[e.module] || 0) + 1;
        }
    }
    const topCodes = Object.entries(byCode)
        .sort((a, b) => b[1] - a[1])
        .map(([code, count]) => ({ code, count }));
    const topModules = Object.entries(byModule)
        .sort((a, b) => b[1] - a[1])
        .map(([mod, count]) => ({ module: mod, count }));
    res.apiOk({ total, topCodes, topModules });
});

module.exports = router;
