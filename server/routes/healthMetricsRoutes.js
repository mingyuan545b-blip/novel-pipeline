/**
 * healthMetricsRoutes.js — 健康检查路由的指标子模块
 *
 * 从 health.js 拆出，负责所有 /metrics* 路由：
 * - GET /metrics: 获取Pipeline+LLM+懒加载路由指标
 * - GET /metrics/snapshots: 加载历史快照
 * - GET /metrics/quota-prediction: 配额耗尽预测
 * - POST /metrics/snapshot: 手动持久化快照
 */
const router = require('express').Router();
const pipelineMetrics = require('../services/pipelineMetrics');
const llmMetrics = require('../services/llmMetrics');
const httpMetrics = require('../services/httpMetrics');
const metricsPersistence = require('../services/metricsPersistence');
const { getLoadedRoutes } = require('../utils/lazyRoute');
const { ERROR_CODES } = require('../shared/errorCodes');
const { parseLimit } = require('../middleware/validators');

const { VALIDATION_ERROR } = ERROR_CODES;

router.get('/', (req, res) => {
    const pipeline = pipelineMetrics.getAllMetrics();
    const llm = llmMetrics.getAllProviderMetrics();
    const http = httpMetrics.getAllMetrics();
    const lazyRoutes = getLoadedRoutes();
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        pipeline: {
            steps: pipeline,
            summary: {
                totalSteps: Object.values(pipeline).reduce((s, v) => s + v.count, 0),
                totalFailures: Object.values(pipeline).reduce((s, v) => s + v.failures, 0),
                totalMs: Object.values(pipeline).reduce((s, v) => s + v.totalMs, 0)
            },
            // M3：最慢步骤排行（按 p95 降序）
            slowestSteps: pipelineMetrics.getSlowestSteps(5)
        },
        llm: {
            providers: llm,
            summary: {
                totalRequests: Object.values(llm).reduce((s, v) => s + v.requestCount, 0),
                totalTokens: Object.values(llm).reduce((s, v) => s + v.totalTokens, 0),
                totalFailures: Object.values(llm).reduce((s, v) => s + v.failureCount, 0),
                // M1：耗时汇总
                totalSlowRequests: Object.values(llm).reduce((s, v) => s + (v.slowRequestCount || 0), 0),
                maxLatencyMs: Object.values(llm).reduce((s, v) => Math.max(s, v.maxLatencyMs || 0), 0)
            }
        },
        // M2：HTTP 请求耗时指标
        http: {
            routes: http,
            summary: {
                totalRequests: Object.values(http).reduce((s, v) => s + v.count, 0),
                totalFailures: Object.values(http).reduce((s, v) => s + v.failureCount, 0),
                totalSlowRequests: Object.values(http).reduce((s, v) => s + v.slowCount, 0),
                slowRoutes: httpMetrics.getSlowRoutes(5)
            }
        },
        lazyRoutes
    });
});

router.get('/snapshots', async (req, res) => {
    const snapshots = await metricsPersistence.loadHistoricalSnapshots();
    const limit = parseLimit(req.query.limit, 24, 200);
    res.json({ success: true, count: snapshots.length, snapshots: snapshots.slice(-limit) });
});

router.get('/quota-prediction', (req, res) => {
    const { hourlyTokenRate, quotaLimit } = req.query;
    if (!hourlyTokenRate || !quotaLimit) {
        return res.apiError(VALIDATION_ERROR.statusCode, 'hourlyTokenRate and quotaLimit required', VALIDATION_ERROR.code);
    }
    const prediction = metricsPersistence.predictQuotaExhaustion(
        parseFloat(hourlyTokenRate), parseFloat(quotaLimit)
    );
    res.json({ success: true, prediction });
});

router.post('/snapshot', async (req, res) => {
    await metricsPersistence.persistSnapshot();
    res.json({ success: true, message: 'Snapshot persisted' });
});

module.exports = router;
