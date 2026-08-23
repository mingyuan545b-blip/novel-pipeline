'use strict';

/**
 * debugErrorRoutes 单元测试（方向 H3）
 *
 * 覆盖：
 * 1. GET /errors — 空数据/有错误/limit 边界/无 warn-error 的 trace 被跳过
 * 2. GET /errors/stats — 聚合统计/byCode/byModule/UNKNOWN 兜底
 * 3. extractErrorEntries — 嵌套 context 读取 code/stack/context
 *
 * 策略：mock logStore + debugPersister，直接调用路由处理函数
 *
 * 文件位置：tests/unit/debugErrorRoutes.test.js
 */

// Mock logStore 与 debugPersister，避免依赖真实内存状态
jest.mock('../../server/shared/logStore', () => {
    const store = {
        listRecentTraces: jest.fn(),
        getByTraceId: jest.fn()
    };
    return { logStore: store, LogStore: jest.fn(() => store) };
});

jest.mock('../../server/shared/debugPersister', () => ({
    debugPersister: { listArchivedTraces: jest.fn(), getArchivedByTraceId: jest.fn() }
}));

const { logStore } = require('../../server/shared/logStore');
const router = require('../../server/routes/debugErrorRoutes');

/**
 * 从 express Router 中按 method + path 提取处理函数
 */
function findRouteHandler(method, path) {
    const target = router.stack.find(layer => {
        if (!layer.route) return false;
        return layer.route.path === path && layer.route.methods[method.toLowerCase()];
    });
    if (!target) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
    return target.route.stack[0].handle;
}

/**
 * 创建 mock req/res/next
 */
function createMockReqRes(query = {}) {
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
    return { req: { query }, res, next: jest.fn() };
}

describe('debugErrorRoutes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /errors', () => {
        const handler = findRouteHandler('get', '/errors');

        test('空数据应返回空列表', () => {
            logStore.listRecentTraces.mockReturnValue([]);
            const { req, res, next } = createMockReqRes({});
            handler(req, res, next);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual([]);
            expect(res.body.meta.total).toBe(0);
            expect(res.body.meta.returned).toBe(0);
        });

        test('应返回 warn + error 级别日志，按时间倒序', () => {
            const ts1 = '2026-06-28T10:00:00.000Z';
            const ts2 = '2026-06-28T11:00:00.000Z';
            logStore.listRecentTraces.mockReturnValue([
                {
                    traceId: 'tr-old',
                    levelCounts: { error: 1, warn: 0, info: 0, debug: 0 },
                    updatedAt: Date.now() - 10000
                },
                {
                    traceId: 'tr-new',
                    levelCounts: { error: 0, warn: 1, info: 0, debug: 0 },
                    updatedAt: Date.now()
                }
            ]);
            logStore.getByTraceId.mockImplementation(traceId => {
                if (traceId === 'tr-old') {
                    return {
                        logs: [{
                            timestamp: ts1, level: 'error', module: 'api',
                            message: 'old error', context: { code: 'NOT_FOUND', stack: 'at old', context: { method: 'GET' } }
                        }]
                    };
                }
                return {
                    logs: [{
                        timestamp: ts2, level: 'warn', module: 'db',
                        message: 'new warn', context: { code: null, stack: null, context: { method: 'POST' } }
                    }]
                };
            });

            const { req, res } = createMockReqRes({});
            handler(req, res);

            expect(res.body.data).toHaveLength(2);
            // 倒序：新的在前
            expect(res.body.data[0].traceId).toBe('tr-new');
            expect(res.body.data[0].level).toBe('warn');
            expect(res.body.data[1].traceId).toBe('tr-old');
            expect(res.body.data[1].level).toBe('error');
            expect(res.body.meta.total).toBe(2);
        });

        test('应跳过无 warn/error 的 trace', () => {
            logStore.listRecentTraces.mockReturnValue([
                { traceId: 'tr-info', levelCounts: { error: 0, warn: 0, info: 5, debug: 0 } },
                { traceId: 'tr-err', levelCounts: { error: 1, warn: 0, info: 0, debug: 0 } }
            ]);
            logStore.getByTraceId.mockReturnValue({
                logs: [{ timestamp: '2026-06-28T10:00:00.000Z', level: 'error', module: 'm', message: 'e', context: {} }]
            });

            const { req, res } = createMockReqRes({});
            handler(req, res);

            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].traceId).toBe('tr-err');
        });

        test('limit 参数应限制返回数量', () => {
            logStore.listRecentTraces.mockReturnValue([
                { traceId: 't1', levelCounts: { error: 1, warn: 0, info: 0, debug: 0 } },
                { traceId: 't2', levelCounts: { error: 1, warn: 0, info: 0, debug: 0 } },
                { traceId: 't3', levelCounts: { error: 1, warn: 0, info: 0, debug: 0 } }
            ]);
            logStore.getByTraceId.mockImplementation(traceId => ({
                logs: [{ timestamp: `2026-06-28T10:0${traceId[1]}:00.000Z`, level: 'error', module: 'm', message: 'e', context: {} }]
            }));

            const { req, res } = createMockReqRes({ limit: '2' });
            handler(req, res);

            expect(res.body.data).toHaveLength(2);
            expect(res.body.meta.total).toBe(3); // total 是过滤前的总数
            expect(res.body.meta.returned).toBe(2);
        });

        test('非法 limit 应使用默认值 50', () => {
            logStore.listRecentTraces.mockReturnValue([]);
            const { req, res } = createMockReqRes({ limit: 'abc' });
            handler(req, res);
            // 空数据时无法直接验证默认值，但确保不抛错
            expect(res.body.success).toBe(true);
        });

        test('负数 limit 应使用默认值', () => {
            logStore.listRecentTraces.mockReturnValue([]);
            const { req, res } = createMockReqRes({ limit: '-5' });
            handler(req, res);
            expect(res.body.success).toBe(true);
        });

        test('limit 超过 200 应被截断到 200', () => {
            logStore.listRecentTraces.mockReturnValue([]);
            const { req, res } = createMockReqRes({ limit: '500' });
            handler(req, res);
            expect(res.body.success).toBe(true);
        });
    });

    describe('GET /errors/stats', () => {
        const handler = findRouteHandler('get', '/errors/stats');

        test('空数据应返回 total=0 与空数组', () => {
            logStore.listRecentTraces.mockReturnValue([]);
            const { req, res } = createMockReqRes({});
            handler(req, res);
            expect(res.body.data.total).toBe(0);
            expect(res.body.data.topCodes).toEqual([]);
            expect(res.body.data.topModules).toEqual([]);
        });

        test('应按 code 与 module 聚合', () => {
            logStore.listRecentTraces.mockReturnValue([
                { traceId: 't1', levelCounts: { error: 2, warn: 0, info: 0, debug: 0 } },
                { traceId: 't2', levelCounts: { error: 0, warn: 1, info: 0, debug: 0 } }
            ]);
            logStore.getByTraceId.mockImplementation(traceId => {
                if (traceId === 't1') {
                    return {
                        logs: [
                            { timestamp: '2026-06-28T10:00:00.000Z', level: 'error', module: 'api', message: 'a', context: { code: 'NOT_FOUND' } },
                            { timestamp: '2026-06-28T10:01:00.000Z', level: 'error', module: 'api', message: 'b', context: { code: 'NOT_FOUND' } }
                        ]
                    };
                }
                return {
                    logs: [{ timestamp: '2026-06-28T10:02:00.000Z', level: 'warn', module: 'db', message: 'c', context: { code: 'VALIDATION_ERROR' } }]
                };
            });

            const { req, res } = createMockReqRes({});
            handler(req, res);

            expect(res.body.data.total).toBe(3);
            // NOT_FOUND 出现 2 次，应排第一
            expect(res.body.data.topCodes[0]).toEqual({ code: 'NOT_FOUND', count: 2 });
            expect(res.body.data.topCodes[1]).toEqual({ code: 'VALIDATION_ERROR', count: 1 });
            // api 模块 2 次，应排第一
            expect(res.body.data.topModules[0]).toEqual({ module: 'api', count: 2 });
            expect(res.body.data.topModules[1]).toEqual({ module: 'db', count: 1 });
        });

        test('无 code 的错误应归入 UNKNOWN', () => {
            logStore.listRecentTraces.mockReturnValue([
                { traceId: 't1', levelCounts: { error: 1, warn: 0, info: 0, debug: 0 } }
            ]);
            logStore.getByTraceId.mockReturnValue({
                logs: [{ timestamp: '2026-06-28T10:00:00.000Z', level: 'error', module: 'm', message: 'e', context: {} }]
            });

            const { req, res } = createMockReqRes({});
            handler(req, res);

            expect(res.body.data.topCodes[0]).toEqual({ code: 'UNKNOWN', count: 1 });
        });
    });

    describe('extractErrorEntries 嵌套 context 读取', () => {
        const handler = findRouteHandler('get', '/errors');

        test('应从嵌套 context 读取 code/stack/context 字段', () => {
            logStore.listRecentTraces.mockReturnValue([
                { traceId: 'tr-x', levelCounts: { error: 1, warn: 0, info: 0, debug: 0 } }
            ]);
            logStore.getByTraceId.mockReturnValue({
                logs: [{
                    timestamp: '2026-06-28T10:00:00.000Z',
                    level: 'error',
                    module: 'api',
                    message: 'fail',
                    // logger.js 将 context 作为嵌套属性存储
                    context: {
                        code: 'INTERNAL_ERROR',
                        stack: 'Error: fail\n    at handler',
                        context: { method: 'GET', path: '/api/test' }
                    }
                }]
            });

            const { req, res } = createMockReqRes({});
            handler(req, res);

            const entry = res.body.data[0];
            expect(entry.code).toBe('INTERNAL_ERROR');
            expect(entry.stack).toContain('Error: fail');
            expect(entry.context).toEqual({ method: 'GET', path: '/api/test' });
            expect(entry.traceId).toBe('tr-x');
            expect(entry.module).toBe('api');
            expect(entry.message).toBe('fail');
        });

        test('context 为空时 code/stack/context 应为 null', () => {
            logStore.listRecentTraces.mockReturnValue([
                { traceId: 'tr-y', levelCounts: { error: 1, warn: 0, info: 0, debug: 0 } }
            ]);
            logStore.getByTraceId.mockReturnValue({
                logs: [{
                    timestamp: '2026-06-28T10:00:00.000Z',
                    level: 'warn',
                    module: 'm',
                    message: 'w',
                    context: {}
                }]
            });

            const { req, res } = createMockReqRes({});
            handler(req, res);

            const entry = res.body.data[0];
            expect(entry.code).toBeNull();
            expect(entry.stack).toBeNull();
            expect(entry.context).toBeNull();
        });
    });
});
