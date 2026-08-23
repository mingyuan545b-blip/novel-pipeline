'use strict';

/**
 * G4 测试：healthMetricsRoutes 路由 e2e
 *
 * 覆盖：
 *   - GET / — 返回 pipeline/llm/http/lazyRoutes 字段（含 G1 暴露的 http 字段）
 *   - GET /snapshots — parseLimit 处理（G3 统一工具）
 *   - GET /quota-prediction — 参数校验
 *   - POST /snapshot — 持久化
 *
 * 策略：mock metrics 模块，直接调用路由处理函数
 *
 * 文件位置：tests/unit/healthMetricsRoutes.test.js
 */

jest.mock('../../server/services/pipelineMetrics', () => ({
    getAllMetrics: jest.fn(() => ({ writer: { count: 5, totalMs: 1000, failures: 0 } })),
    getSlowestSteps: jest.fn(() => [{ stepName: 'writer', p95Ms: 5000 }])
}));

jest.mock('../../server/services/llmMetrics', () => ({
    getAllProviderMetrics: jest.fn(() => ({
        aliyun: { requestCount: 10, failureCount: 1, totalTokens: 1000, slowRequestCount: 0, maxLatencyMs: 2000 }
    }))
}));

jest.mock('../../server/services/httpMetrics', () => ({
    getAllMetrics: jest.fn(() => ({
        'GET:/api/projects': { count: 50, failureCount: 0, slowCount: 1 }
    })),
    getSlowRoutes: jest.fn(() => [{ route: 'GET:/api/projects', p95Ms: 3500 }])
}));

jest.mock('../../server/services/metricsPersistence', () => ({
    loadHistoricalSnapshots: jest.fn(),
    predictQuotaExhaustion: jest.fn(),
    persistSnapshot: jest.fn()
}));

jest.mock('../../server/utils/lazyRoute', () => ({
    getLoadedRoutes: jest.fn(() => ['/api/health'])
}));

const metricsPersistence = require('../../server/services/metricsPersistence');
const router = require('../../server/routes/healthMetricsRoutes');

function findRouteHandler(method, path) {
    const target = router.stack.find(layer => {
        if (!layer.route) return false;
        return layer.route.path === path && layer.route.methods[method.toLowerCase()];
    });
    if (!target) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
    return target.route.stack[0].handle;
}

function mockReqRes(query = {}) {
    const res = {
        statusCode: 200, body: null,
        status(code) { this.statusCode = code; return this; },
        apiError(status, error, code) {
            this.body = { success: false, error, code };
            return this;
        },
        json(body) { this.body = body; return this; }
    };
    return { req: { query }, res };
}

describe('G4: healthMetricsRoutes', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('GET /', () => {
        const handler = findRouteHandler('get', '/');

        test('应返回 pipeline/llm/http/lazyRoutes 字段', () => {
            const { req, res } = mockReqRes();
            handler(req, res);
            expect(res.body.success).toBe(true);
            expect(res.body.pipeline).toBeDefined();
            expect(res.body.pipeline.steps.writer.count).toBe(5);
            expect(res.body.pipeline.slowestSteps).toHaveLength(1);
            expect(res.body.llm).toBeDefined();
            expect(res.body.llm.providers.aliyun.requestCount).toBe(10);
            // G1: http 字段
            expect(res.body.http).toBeDefined();
            expect(res.body.http.routes['GET:/api/projects'].count).toBe(50);
            expect(res.body.http.summary.slowRoutes).toHaveLength(1);
            expect(res.body.lazyRoutes).toEqual(['/api/health']);
        });

        test('pipeline.summary 应聚合 totalSteps/totalFailures/totalMs', () => {
            const { req, res } = mockReqRes();
            handler(req, res);
            expect(res.body.pipeline.summary.totalSteps).toBe(5);
            expect(res.body.pipeline.summary.totalFailures).toBe(0);
        });

        test('llm.summary 应聚合 totalSlowRequests/maxLatencyMs（M1）', () => {
            const { req, res } = mockReqRes();
            handler(req, res);
            expect(res.body.llm.summary.totalSlowRequests).toBe(0);
            expect(res.body.llm.summary.maxLatencyMs).toBe(2000);
        });
    });

    describe('GET /snapshots', () => {
        const handler = findRouteHandler('get', '/snapshots');

        test('应返回历史快照列表', async () => {
            const snaps = [{ ts: '2026-01-01' }, { ts: '2026-01-02' }];
            metricsPersistence.loadHistoricalSnapshots.mockResolvedValue(snaps);
            const { req, res } = mockReqRes();
            await handler(req, res);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(2);
            expect(res.body.snapshots).toEqual(snaps);
        });

        test('limit 参数应限制返回数量（G3 parseLimit 默认 24）', async () => {
            const snaps = Array.from({ length: 30 }, (_, i) => ({ ts: `t${i}` }));
            metricsPersistence.loadHistoricalSnapshots.mockResolvedValue(snaps);
            const { req, res } = mockReqRes({});
            await handler(req, res);
            // 默认 limit=24，slice(-24) 返回最后 24 条
            expect(res.body.snapshots.length).toBe(24);
        });

        test('limit=5 应返回最后 5 条', async () => {
            const snaps = Array.from({ length: 30 }, (_, i) => ({ ts: `t${i}` }));
            metricsPersistence.loadHistoricalSnapshots.mockResolvedValue(snaps);
            const { req, res } = mockReqRes({ limit: '5' });
            await handler(req, res);
            expect(res.body.snapshots.length).toBe(5);
        });

        test('limit 非法值应走默认 24', async () => {
            const snaps = Array.from({ length: 30 }, (_, i) => ({ ts: `t${i}` }));
            metricsPersistence.loadHistoricalSnapshots.mockResolvedValue(snaps);
            const { req, res } = mockReqRes({ limit: 'abc' });
            await handler(req, res);
            expect(res.body.snapshots.length).toBe(24);
        });
    });

    describe('GET /quota-prediction', () => {
        const handler = findRouteHandler('get', '/quota-prediction');

        test('缺少 hourlyTokenRate 应返回 400', () => {
            const { req, res } = mockReqRes({ quotaLimit: '1000' });
            handler(req, res);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });

        test('缺少 quotaLimit 应返回 400', () => {
            const { req, res } = mockReqRes({ hourlyTokenRate: '100' });
            handler(req, res);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });

        test('参数齐全应返回预测结果', () => {
            metricsPersistence.predictQuotaExhaustion.mockReturnValue({
                hoursRemaining: 10, exhaustAt: '2026-01-02'
            });
            const { req, res } = mockReqRes({ hourlyTokenRate: '100', quotaLimit: '1000' });
            handler(req, res);
            expect(res.body.success).toBe(true);
            expect(res.body.prediction.hoursRemaining).toBe(10);
        });
    });

    describe('POST /snapshot', () => {
        const handler = findRouteHandler('post', '/snapshot');

        test('应调用 persistSnapshot 并返回成功', async () => {
            metricsPersistence.persistSnapshot.mockResolvedValue();
            const { req, res } = mockReqRes();
            await handler(req, res);
            expect(metricsPersistence.persistSnapshot).toHaveBeenCalled();
            expect(res.body.success).toBe(true);
        });
    });
});
