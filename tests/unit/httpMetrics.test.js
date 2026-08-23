'use strict';

/**
 * httpMetrics 单元测试（方向 M2：HTTP 请求耗时中间件）
 *
 * 覆盖：
 * 1. recordRequest 按 method+path 聚合
 * 2. getAllMetrics 返回 avgMs/maxMs/p95Ms/slowCount
 * 3. normalizePath 路径归一化（UUID/数字 ID）
 * 4. getSlowRoutes 返回 top N 慢请求
 * 5. 慢请求阈值（>= 3000ms）
 *
 * 文件位置：tests/unit/httpMetrics.test.js
 */

const {
    recordRequest,
    getRouteMetrics,
    getAllMetrics,
    getSlowRoutes,
    resetMetrics,
    normalizePath,
    SLOW_REQUEST_MS
} = require('../../server/services/httpMetrics');

describe('httpMetrics - M2 HTTP 请求耗时', () => {
    beforeEach(() => {
        resetMetrics();
    });

    describe('normalizePath 路径归一化', () => {
        test('应将数字 ID 归一化为 :id', () => {
            expect(normalizePath('/api/projects/123')).toBe('/api/projects/:id');
            expect(normalizePath('/api/chapters/456/logs')).toBe('/api/chapters/:id/logs');
        });

        test('应将 UUID 归一化为 :uuid', () => {
            const uuid = '550e8400-e29b-41d4-a716-446655440000';
            expect(normalizePath(`/api/projects/${uuid}`)).toBe('/api/projects/:uuid');
        });

        test('无 ID 路径应原样返回', () => {
            expect(normalizePath('/api/projects')).toBe('/api/projects');
            expect(normalizePath('/api/health/metrics')).toBe('/api/health/metrics');
        });

        test('空路径应返回 UNKNOWN', () => {
            expect(normalizePath('')).toBe('UNKNOWN');
            expect(normalizePath(null)).toBe('UNKNOWN');
        });
    });

    describe('recordRequest 聚合', () => {
        test('应按 method+path 聚合', () => {
            recordRequest('GET', '/api/projects', 200, 100);
            recordRequest('GET', '/api/projects', 200, 200);
            recordRequest('POST', '/api/projects', 201, 300);

            const all = getAllMetrics();
            expect(Object.keys(all)).toHaveLength(2);
            expect(all['GET /api/projects'].count).toBe(2);
            expect(all['POST /api/projects'].count).toBe(1);
        });

        test('数字 ID 应归一化后聚合', () => {
            recordRequest('GET', '/api/projects/1', 200, 100);
            recordRequest('GET', '/api/projects/2', 200, 150);
            recordRequest('GET', '/api/projects/3', 200, 200);

            const all = getAllMetrics();
            // 三个不同 ID 应聚合到同一个 key
            expect(Object.keys(all)).toHaveLength(1);
            expect(all['GET /api/projects/:id'].count).toBe(3);
        });

        test('应统计失败请求（4xx/5xx）', () => {
            recordRequest('GET', '/api/test', 200, 100);
            recordRequest('GET', '/api/test', 404, 50);
            recordRequest('GET', '/api/test', 500, 200);

            const all = getAllMetrics();
            expect(all['GET /api/test'].failureCount).toBe(2);
        });

        test('应统计慢请求（>= 3000ms）', () => {
            recordRequest('GET', '/api/test', 200, 1000);
            recordRequest('GET', '/api/test', 200, SLOW_REQUEST_MS);
            recordRequest('GET', '/api/test', 200, SLOW_REQUEST_MS + 1000);

            const all = getAllMetrics();
            expect(all['GET /api/test'].slowCount).toBe(2);
        });

        test('恰好等于阈值应计为慢请求', () => {
            recordRequest('GET', '/api/test', 200, SLOW_REQUEST_MS);
            const all = getAllMetrics();
            expect(all['GET /api/test'].slowCount).toBe(1);
        });
    });

    describe('getAllMetrics 耗时聚合', () => {
        test('应返回 avgMs 平均耗时', () => {
            recordRequest('GET', '/api/test', 200, 100);
            recordRequest('GET', '/api/test', 200, 300);
            const all = getAllMetrics();
            // (100 + 300) / 2 = 200
            expect(all['GET /api/test'].avgMs).toBe(200);
        });

        test('应返回 maxMs 最大耗时', () => {
            recordRequest('GET', '/api/test', 200, 100);
            recordRequest('GET', '/api/test', 200, 500);
            recordRequest('GET', '/api/test', 200, 300);
            const all = getAllMetrics();
            expect(all['GET /api/test'].maxMs).toBe(500);
        });

        test('应返回 p95Ms 分位数', () => {
            for (let i = 1; i <= 10; i++) {
                recordRequest('GET', '/api/test', 200, i * 100);
            }
            const all = getAllMetrics();
            // 10 条 * 0.95 = 9.5 → ceil = 10 → idx = 9（0-based）= 第 10 个 = 1000
            expect(all['GET /api/test'].p95Ms).toBe(1000);
        });

        test('应返回 recentRequests 最近 20 条', () => {
            for (let i = 0; i < 25; i++) {
                recordRequest('GET', '/api/test', 200, 100);
            }
            const all = getAllMetrics();
            expect(all['GET /api/test'].recentRequests).toHaveLength(20);
        });
    });

    describe('getRouteMetrics 单路由查询', () => {
        test('应返回指定路由的指标', () => {
            recordRequest('GET', '/api/test', 200, 500);
            const metrics = getRouteMetrics('GET', '/api/test');
            expect(metrics).not.toBeNull();
            expect(metrics.count).toBe(1);
            expect(metrics.avgMs).toBe(500);
        });

        test('不存在的路由应返回 null', () => {
            expect(getRouteMetrics('GET', '/nonexistent')).toBeNull();
        });
    });

    describe('getSlowRoutes 慢请求排行', () => {
        test('应按 p95Ms 降序排列', () => {
            // 路由 A：p95 = 5000
            for (let i = 0; i < 5; i++) {
                recordRequest('GET', '/api/slow', 200, 5000);
            }
            // 路由 B：p95 = 1000
            for (let i = 0; i < 5; i++) {
                recordRequest('GET', '/api/fast', 200, 1000);
            }

            const slow = getSlowRoutes(10);
            expect(slow).toHaveLength(2);
            expect(slow[0].route).toBe('GET /api/slow');
            expect(slow[0].p95Ms).toBe(5000);
            expect(slow[1].route).toBe('GET /api/fast');
            expect(slow[1].p95Ms).toBe(1000);
        });

        test('应限制返回数量', () => {
            for (let i = 0; i < 10; i++) {
                recordRequest('GET', `/api/route${i}`, 200, 1000 * (i + 1));
            }
            const slow = getSlowRoutes(3);
            expect(slow).toHaveLength(3);
        });

        test('无数据时应返回空数组', () => {
            expect(getSlowRoutes(5)).toEqual([]);
        });
    });

    describe('resetMetrics 重置', () => {
        test('应清空所有指标', () => {
            recordRequest('GET', '/api/test', 200, 100);
            resetMetrics();
            expect(Object.keys(getAllMetrics())).toHaveLength(0);
        });
    });

    describe('SLOW_REQUEST_MS 常量', () => {
        test('应为 3000 毫秒（3 秒）', () => {
            expect(SLOW_REQUEST_MS).toBe(3000);
        });
    });
});
