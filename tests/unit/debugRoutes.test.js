'use strict';

/**
 * debugRoutes 单元测试（方向 H3）
 *
 * 覆盖核心端点：
 * 1. GET /trace-ids — limit/level/includeArchive 参数
 * 2. GET /logs — traceId 必填校验 + 内存命中 + 内存未命中 PG 回退 + 全未命中 404
 * 3. GET /stats — 综合统计
 * 4. DELETE /logs — 清空
 * 5. GET /aggregations — limit/minCount
 * 6. GET /alerts — 告警列表
 * 7. POST /alerts/:id/acknowledge — 确认告警 + 不存在 404
 * 8. POST /alerts/evaluate — 手动评估
 * 9. GET /alerts/rules — 规则列表
 *
 * 策略：mock logStore/logAggregator/alertEngine/debugPersister，直接调用路由处理函数
 *
 * 文件位置：tests/unit/debugRoutes.test.js
 */

jest.mock('../../server/shared/logStore', () => {
    const store = {
        listRecentTraces: jest.fn(),
        getByTraceId: jest.fn(),
        clear: jest.fn(),
        getStats: jest.fn()
    };
    return { logStore: store, LogStore: jest.fn(() => store) };
});

jest.mock('../../server/shared/logAggregator', () => ({
    logAggregator: {
        getAggregations: jest.fn(),
        clear: jest.fn(),
        getStats: jest.fn()
    }
}));

jest.mock('../../server/shared/alertRules', () => ({
    alertEngine: {
        getAlerts: jest.fn(),
        acknowledge: jest.fn(),
        evaluate: jest.fn(),
        getRules: jest.fn(),
        getStats: jest.fn(),
        clear: jest.fn()
    }
}));

jest.mock('../../server/shared/debugPersister', () => ({
    debugPersister: {
        listArchivedTraces: jest.fn(),
        getArchivedByTraceId: jest.fn(),
        getStats: jest.fn()
    }
}));

const { logStore } = require('../../server/shared/logStore');
const { logAggregator } = require('../../server/shared/logAggregator');
const { alertEngine } = require('../../server/shared/alertRules');
const { debugPersister } = require('../../server/shared/debugPersister');
const router = require('../../server/routes/debugRoutes');

function findRouteHandler(method, path) {
    const target = router.stack.find(layer => {
        if (!layer.route) return false;
        return layer.route.path === path && layer.route.methods[method.toLowerCase()];
    });
    if (!target) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
    return target.route.stack[0].handle;
}

function createMockReqRes(query = {}, params = {}) {
    const res = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        apiOk(data, meta) {
            this.body = { success: true, data, meta };
            return this;
        },
        apiError(status, error, code) {
            this.body = { success: false, error, code };
            return this;
        },
        json(body) { this.body = body; return this; }
    };
    return { req: { query, params }, res, next: jest.fn() };
}

describe('debugRoutes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /trace-ids', () => {
        const handler = findRouteHandler('get', '/trace-ids');

        test('应返回 trace 列表', async () => {
            const items = [{ traceId: 't1', updatedAt: Date.now() }];
            logStore.listRecentTraces.mockReturnValue(items);
            const { req, res } = createMockReqRes({});
            await handler(req, res);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBe(items);
        });

        test('includeArchive=true 应合并 PG 归档数据', async () => {
            const memItems = [{ traceId: 't1', updatedAt: 2000 }];
            const archItems = [{ traceId: 't2', updatedAt: 1000 }];
            logStore.listRecentTraces.mockReturnValue(memItems);
            debugPersister.listArchivedTraces.mockResolvedValue(archItems);
            const { req, res } = createMockReqRes({ includeArchive: 'true' });
            await handler(req, res);
            expect(debugPersister.listArchivedTraces).toHaveBeenCalled();
            expect(res.body.data).toHaveLength(2);
        });

        test('includeArchive=true 时 PG 失败不应阻塞', async () => {
            logStore.listRecentTraces.mockReturnValue([{ traceId: 't1', updatedAt: 1 }]);
            debugPersister.listArchivedTraces.mockRejectedValue(new Error('PG down'));
            const { req, res } = createMockReqRes({ includeArchive: 'true' });
            await handler(req, res);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
        });
    });

    describe('GET /logs', () => {
        const handler = findRouteHandler('get', '/logs');

        test('缺少 traceId 应返回 400', async () => {
            const { req, res } = createMockReqRes({});
            await handler(req, res);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });

        test('内存命中应返回记录', async () => {
            const record = { traceId: 't1', logs: [] };
            logStore.getByTraceId.mockReturnValue(record);
            const { req, res } = createMockReqRes({ traceId: 't1' });
            await handler(req, res);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBe(record);
            // 内存命中不应调用 PG
            expect(debugPersister.getArchivedByTraceId).not.toHaveBeenCalled();
        });

        test('内存未命中应回退 PG', async () => {
            logStore.getByTraceId.mockReturnValue(null);
            const archRecord = { traceId: 't2', logs: [{ level: 'info' }] };
            debugPersister.getArchivedByTraceId.mockResolvedValue(archRecord);
            const { req, res } = createMockReqRes({ traceId: 't2' });
            await handler(req, res);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBe(archRecord);
        });

        test('内存与 PG 均未命中应返回 404', async () => {
            logStore.getByTraceId.mockReturnValue(null);
            debugPersister.getArchivedByTraceId.mockResolvedValue(null);
            const { req, res } = createMockReqRes({ traceId: 'missing' });
            await handler(req, res);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('NOT_FOUND');
        });

        test('PG 查询异常应回退到 404', async () => {
            logStore.getByTraceId.mockReturnValue(null);
            debugPersister.getArchivedByTraceId.mockRejectedValue(new Error('PG error'));
            const { req, res } = createMockReqRes({ traceId: 'err' });
            await handler(req, res);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('NOT_FOUND');
        });
    });

    describe('GET /stats', () => {
        const handler = findRouteHandler('get', '/stats');

        test('应返回综合统计', () => {
            logStore.getStats.mockReturnValue({ totalTraces: 5 });
            logAggregator.getStats.mockReturnValue({ totalKeys: 10 });
            alertEngine.getStats.mockReturnValue({ active: 2 });
            debugPersister.getStats.mockReturnValue({ totalLogs: 100 });
            const { req, res } = createMockReqRes({});
            handler(req, res);
            expect(res.body.data.logStore.totalTraces).toBe(5);
            expect(res.body.data.aggregator.totalKeys).toBe(10);
            expect(res.body.data.alerts.active).toBe(2);
            expect(res.body.data.persister.totalLogs).toBe(100);
        });
    });

    describe('DELETE /logs', () => {
        const handler = findRouteHandler('delete', '/logs');

        test('应清空 logStore + aggregator + alertEngine', () => {
            const { req, res } = createMockReqRes({});
            handler(req, res);
            expect(logStore.clear).toHaveBeenCalled();
            expect(logAggregator.clear).toHaveBeenCalled();
            expect(alertEngine.clear).toHaveBeenCalled();
            expect(res.body.data.cleared).toBe(true);
        });
    });

    describe('GET /aggregations', () => {
        const handler = findRouteHandler('get', '/aggregations');

        test('应返回聚合数据', () => {
            const items = [{ key: 'level:error', count: 5 }];
            logAggregator.getAggregations.mockReturnValue(items);
            const { req, res } = createMockReqRes({});
            handler(req, res);
            expect(res.body.data).toBe(items);
        });

        test('应传递 minCount 参数', () => {
            logAggregator.getAggregations.mockReturnValue([]);
            const { req, res } = createMockReqRes({ minCount: '3' });
            handler(req, res);
            expect(logAggregator.getAggregations).toHaveBeenCalledWith(expect.objectContaining({ minCount: 3 }));
        });
    });

    describe('GET /alerts', () => {
        const handler = findRouteHandler('get', '/alerts');

        test('应返回告警列表', () => {
            const alerts = [{ id: 'a1', severity: 'critical' }];
            alertEngine.getAlerts.mockReturnValue(alerts);
            const { req, res } = createMockReqRes({});
            handler(req, res);
            expect(res.body.data).toBe(alerts);
        });
    });

    describe('POST /alerts/:id/acknowledge', () => {
        const handler = findRouteHandler('post', '/alerts/:id/acknowledge');

        test('确认成功应返回 acknowledged:true', () => {
            alertEngine.acknowledge.mockReturnValue(true);
            const { req, res } = createMockReqRes({}, { id: 'a1' });
            handler(req, res);
            expect(res.body.data.acknowledged).toBe(true);
        });

        test('告警不存在应返回 404', () => {
            alertEngine.acknowledge.mockReturnValue(false);
            const { req, res } = createMockReqRes({}, { id: 'missing' });
            handler(req, res);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('NOT_FOUND');
        });
    });

    describe('POST /alerts/evaluate', () => {
        const handler = findRouteHandler('post', '/alerts/evaluate');

        test('应返回新告警列表与计数', () => {
            const newAlerts = [{ id: 'n1' }, { id: 'n2' }];
            alertEngine.evaluate.mockReturnValue(newAlerts);
            const { req, res } = createMockReqRes({});
            handler(req, res);
            expect(res.body.data.newAlerts).toBe(newAlerts);
            expect(res.body.data.count).toBe(2);
        });
    });

    describe('GET /alerts/rules', () => {
        const handler = findRouteHandler('get', '/alerts/rules');

        test('应返回规则列表', () => {
            const rules = [{ name: 'error-rate', threshold: 0.3 }];
            alertEngine.getRules.mockReturnValue(rules);
            const { req, res } = createMockReqRes({});
            handler(req, res);
            expect(res.body.data).toBe(rules);
        });
    });
});
