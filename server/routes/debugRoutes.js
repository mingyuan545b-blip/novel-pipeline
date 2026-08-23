'use strict';

/**
 * 调试日志路由
 *
 * 职责：
 * 1. GET /api/debug/trace-ids — 列出最近 traceId（含时间、级别统计、错误标记，支持 includeArchive 合并 PG 归档）
 * 2. GET /api/debug/logs?traceId=xxx — 按 traceId 检索日志详情（内存未命中自动回退 PG 归档）
 * 3. GET /api/debug/stats — 获取 logStore/aggregator/alerts/persister 综合统计
 * 4. DELETE /api/debug/logs — 清空日志存储（开发期调试用）
 * 5. GET /api/debug/aggregations — 获取错误聚合数据（按 module/level/code 聚合）
 * 6. GET /api/debug/alerts — 获取活跃告警列表
 * 7. POST /api/debug/alerts/:id/acknowledge — 确认告警
 * 8. POST /api/debug/alerts/evaluate — 手动触发告警评估（调试用）
 * 9. GET /api/debug/alerts/rules — 获取告警规则列表
 *
 * 安全性：仅查询内存数据，无敏感信息泄露风险；生产环境可通过 REQUEST_SECRET 鉴权保护
 *
 * 文件位置：server/routes/debugRoutes.js
 */

const express = require('express');
const { logStore } = require('../shared/logStore');
const { logAggregator } = require('../shared/logAggregator');
const { alertEngine } = require('../shared/alertRules');
const { debugPersister } = require('../shared/debugPersister');
const { ERROR_CODES } = require('../shared/errorCodes');
const { parseLimit } = require('../middleware/validators');

const { VALIDATION_ERROR, NOT_FOUND } = ERROR_CODES;

const router = express.Router();

/**
 * GET /api/debug/trace-ids
 * 查询参数：
 *   - limit: 返回条数上限（默认 50，最大 200）
 *   - level: 仅返回包含该级别日志的 traceId（debug/info/warn/error）
 *   - includeArchive: 是否合并 PG 归档数据（默认 false）
 */
router.get('/trace-ids', async (req, res) => {
    const limit = parseLimit(req.query.limit);
    const level = req.query.level;
    const includeArchive = req.query.includeArchive === 'true';
    const items = logStore.listRecentTraces({ limit, level });

    if (includeArchive) {
        try {
            const archived = await debugPersister.listArchivedTraces({ limit, level });
            // 合并去重（内存优先）
            const seen = new Set(items.map(i => i.traceId));
            for (const a of archived) {
                if (!seen.has(a.traceId)) items.push(a);
            }
            items.sort((a, b) => b.updatedAt - a.updatedAt);
            items.splice(limit);
        } catch (e) {
            // PG 查询失败不阻塞
        }
    }

    res.json({ success: true, data: items, meta: { total: items.length, limit } });
});

/**
 * GET /api/debug/logs?traceId=xxx
 * 查询参数：
 *   - traceId: 必填，追踪 ID
 *   - level: 可选，按级别过滤（debug/info/warn/error）
 *
 * 查询策略：先查内存 logStore，未命中回退到 PG 归档（debugPersister）
 */
router.get('/logs', async (req, res) => {
    const { traceId } = req.query;
    if (!traceId) {
        return res.apiError(VALIDATION_ERROR.statusCode, 'traceId is required', VALIDATION_ERROR.code);
    }
    const level = req.query.level;
    const record = logStore.getByTraceId(traceId, level ? { level } : {});
    if (record) {
        return res.json({ success: true, data: record });
    }
    // 内存未命中：回退到 PG 归档
    try {
        const archived = await debugPersister.getArchivedByTraceId(traceId, level ? { level } : {});
        if (archived) {
            return res.json({ success: true, data: archived });
        }
    } catch (e) {
        // PG 查询失败不阻塞，继续返回 404
    }
    return res.apiError(NOT_FOUND.statusCode, `No logs found for traceId: ${traceId}`, NOT_FOUND.code);
});

/**
 * GET /api/debug/stats
 * 返回 logStore + aggregator + alert + persister 综合统计
 */
router.get('/stats', (req, res) => {
    res.json({
        success: true,
        data: {
            logStore: logStore.getStats(),
            aggregator: logAggregator.getStats(),
            alerts: alertEngine.getStats(),
            persister: debugPersister.getStats()
        }
    });
});

/**
 * DELETE /api/debug/logs
 * 清空日志存储 + 聚合数据 + 告警（开发期调试用）
 */
router.delete('/logs', (req, res) => {
    logStore.clear();
    logAggregator.clear();
    alertEngine.clear();
    res.json({ success: true, data: { cleared: true } });
});

/**
 * GET /api/debug/aggregations
 * 查询参数：
 *   - limit: 返回条数上限（默认 50，最大 200）
 *   - minCount: 最小计数阈值（默认 1）
 */
router.get('/aggregations', (req, res) => {
    const limit = parseLimit(req.query.limit);
    const minCount = parseInt(req.query.minCount, 10) || 1;
    const items = logAggregator.getAggregations({ limit, minCount });
    res.json({ success: true, data: items, meta: { total: items.length, limit } });
});

/**
 * GET /api/debug/alerts
 * 返回活跃告警列表（按严重程度 + 触发时间排序）
 */
router.get('/alerts', (req, res) => {
    const items = alertEngine.getAlerts();
    res.json({ success: true, data: items, meta: { total: items.length } });
});

/**
 * POST /api/debug/alerts/:id/acknowledge
 * 确认告警（标记为已处理）
 */
router.post('/alerts/:id/acknowledge', (req, res) => {
    const ok = alertEngine.acknowledge(req.params.id);
    if (!ok) {
        return res.apiError(NOT_FOUND.statusCode, `Alert not found: ${req.params.id}`, NOT_FOUND.code);
    }
    res.json({ success: true, data: { acknowledged: true } });
});

/**
 * POST /api/debug/alerts/evaluate
 * 手动触发告警评估（调试用，避免等待 30 秒定时器）
 */
router.post('/alerts/evaluate', (req, res) => {
    const newAlerts = alertEngine.evaluate();
    res.json({ success: true, data: { newAlerts, count: newAlerts.length } });
});

/**
 * GET /api/debug/alerts/rules
 * 返回告警规则列表
 */
router.get('/alerts/rules', (req, res) => {
    res.json({ success: true, data: alertEngine.getRules() });
});

module.exports = router;
