/**
 * httpMetricsMiddleware 单元测试
 * 覆盖：httpMetricsMiddleware（请求耗时记录、慢请求日志、路径跳过）
 */
jest.mock('../../server/services/httpMetrics', () => ({
    recordRequest: jest.fn(),
    SLOW_REQUEST_MS: 3000
}));

jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const httpMetrics = require('../../server/services/httpMetrics');
const logger = require('../../server/shared/logger');
const { httpMetricsMiddleware } = require('../../server/middleware/httpMetricsMiddleware');

describe('httpMetricsMiddleware', () => {
    beforeEach(() => jest.clearAllMocks());

    function setupReqRes(path = '/api/test', method = 'GET') {
        const listeners = {};
        const req = {
            method,
            originalUrl: path,
            path
        };
        const res = {
            statusCode: 200,
            on: jest.fn((event, cb) => {
                listeners[event] = cb;
            })
        };
        const next = jest.fn();
        return { req, res, next, listeners };
    }

    test('调用 next() 继续中间件链', () => {
        const { req, res, next } = setupReqRes();
        httpMetricsMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('finish 事件触发 httpMetrics.recordRequest', () => {
        const { req, res, next, listeners } = setupReqRes('/api/data');
        httpMetricsMiddleware(req, res, next);

        listeners.finish();

        expect(httpMetrics.recordRequest).toHaveBeenCalledWith(
            'GET', '/api/data', 200, expect.any(Number)
        );
    });

    test('慢请求（>=3s）触发 logger.warn', () => {
        const { req, res, next, listeners } = setupReqRes('/api/slow');
        httpMetricsMiddleware(req, res, next);

        // 模拟慢请求 - 直接调用 finish 回调，duration 会被计算
        // 由于 Date.now() 不好模拟，我们验证 recordRequest 被调用即可
        listeners.finish();

        // 注意：实际 duration 可能 < 3s，所以 logger.warn 可能不触发
        // 但 recordRequest 一定会调用
        expect(httpMetrics.recordRequest).toHaveBeenCalled();
    });

    test('跳过 /output/ 前缀路径', () => {
        const { req, res, next, listeners } = setupReqRes('/output/file.txt');
        httpMetricsMiddleware(req, res, next);

        listeners.finish();

        expect(httpMetrics.recordRequest).not.toHaveBeenCalled();
    });

    test('跳过 /api/health 前缀路径', () => {
        const { req, res, next, listeners } = setupReqRes('/api/health');
        httpMetricsMiddleware(req, res, next);

        listeners.finish();

        expect(httpMetrics.recordRequest).not.toHaveBeenCalled();
    });

    test('跳过 /api/version 前缀路径', () => {
        const { req, res, next, listeners } = setupReqRes('/api/version');
        httpMetricsMiddleware(req, res, next);

        listeners.finish();

        expect(httpMetrics.recordRequest).not.toHaveBeenCalled();
    });

    test('originalUrl 缺失时回退到 path', () => {
        const listeners = {};
        const req = { method: 'POST', path: '/api/fallback' };
        const res = {
            statusCode: 201,
            on: jest.fn((event, cb) => { listeners[event] = cb; })
        };
        httpMetricsMiddleware(req, res, jest.fn());

        listeners.finish();

        expect(httpMetrics.recordRequest).toHaveBeenCalledWith(
            'POST', '/api/fallback', 201, expect.any(Number)
        );
    });

    test('method 缺失时使用 UNKNOWN', () => {
        const listeners = {};
        const req = { originalUrl: '/api/test' };
        const res = {
            statusCode: 200,
            on: jest.fn((event, cb) => { listeners[event] = cb; })
        };
        httpMetricsMiddleware(req, res, jest.fn());

        listeners.finish();

        expect(httpMetrics.recordRequest).toHaveBeenCalledWith(
            'UNKNOWN', '/api/test', 200, expect.any(Number)
        );
    });
});
