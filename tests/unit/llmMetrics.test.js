'use strict';

/**
 * llmMetrics 单元测试（方向 M1：LLM 耗时监控）
 *
 * 覆盖：
 * 1. recordTokenUsage 记录耗时（durationMs）
 * 2. getAllProviderMetrics 返回 avgLatencyMs/maxLatencyMs/p95LatencyMs/slowRequestCount
 * 3. 慢请求阈值（>= 30000ms）触发 slowRequestCount 递增
 * 4. p95 分位数计算正确性
 * 5. 不传 durationMs 时的向后兼容
 *
 * 文件位置：tests/unit/llmMetrics.test.js
 */

const {
    recordTokenUsage,
    getProviderMetrics,
    getAllProviderMetrics,
    resetMetrics,
    SLOW_REQUEST_MS
} = require('../../server/services/llmMetrics');

describe('llmMetrics - M1 耗时监控', () => {
    beforeEach(() => {
        resetMetrics();
    });

    describe('recordTokenUsage 耗时记录', () => {
        test('应记录 durationMs 到 lastRequests', () => {
            recordTokenUsage('aliyun', 'qwen3', { total_tokens: 100 }, true, 1500);
            const metrics = getAllProviderMetrics();
            const stats = metrics['aliyun/qwen3'];
            expect(stats.recentRequests[0].durationMs).toBe(1500);
        });

        test('不传 durationMs 应默认为 0（向后兼容）', () => {
            recordTokenUsage('aliyun', 'qwen3', { total_tokens: 100 }, true);
            const metrics = getAllProviderMetrics();
            const stats = metrics['aliyun/qwen3'];
            expect(stats.recentRequests[0].durationMs).toBe(0);
        });

        test('负数 durationMs 应被视为 0', () => {
            recordTokenUsage('aliyun', 'qwen3', { total_tokens: 100 }, true, -100);
            const metrics = getAllProviderMetrics();
            expect(metrics['aliyun/qwen3'].recentRequests[0].durationMs).toBe(0);
        });

        test('非数字 durationMs 应被视为 0', () => {
            recordTokenUsage('aliyun', 'qwen3', { total_tokens: 100 }, true, 'abc');
            const metrics = getAllProviderMetrics();
            expect(metrics['aliyun/qwen3'].recentRequests[0].durationMs).toBe(0);
        });
    });

    describe('getAllProviderMetrics 耗时聚合', () => {
        test('应返回 avgLatencyMs 平均耗时', () => {
            recordTokenUsage('aliyun', 'qwen3', null, true, 1000);
            recordTokenUsage('aliyun', 'qwen3', null, true, 3000);
            const stats = getAllProviderMetrics()['aliyun/qwen3'];
            // 平均 = (1000 + 3000) / 2 = 2000
            expect(stats.avgLatencyMs).toBe(2000);
        });

        test('应返回 maxLatencyMs 最大耗时', () => {
            recordTokenUsage('aliyun', 'qwen3', null, true, 1000);
            recordTokenUsage('aliyun', 'qwen3', null, true, 5000);
            recordTokenUsage('aliyun', 'qwen3', null, true, 3000);
            const stats = getAllProviderMetrics()['aliyun/qwen3'];
            expect(stats.maxLatencyMs).toBe(5000);
        });

        test('应返回 slowRequestCount 慢请求数量', () => {
            recordTokenUsage('aliyun', 'qwen3', null, true, 1000);  // 正常
            recordTokenUsage('aliyun', 'qwen3', null, true, SLOW_REQUEST_MS);  // 慢
            recordTokenUsage('aliyun', 'qwen3', null, true, SLOW_REQUEST_MS + 5000);  // 慢
            const stats = getAllProviderMetrics()['aliyun/qwen3'];
            expect(stats.slowRequestCount).toBe(2);
        });

        test('恰好等于阈值应计为慢请求', () => {
            recordTokenUsage('aliyun', 'qwen3', null, true, SLOW_REQUEST_MS);
            const stats = getAllProviderMetrics()['aliyun/qwen3'];
            expect(stats.slowRequestCount).toBe(1);
        });

        test('未记录耗时时 avgLatencyMs 应为 0', () => {
            recordTokenUsage('aliyun', 'qwen3', { total_tokens: 100 }, true);
            const stats = getAllProviderMetrics()['aliyun/qwen3'];
            expect(stats.avgLatencyMs).toBe(0);
            expect(stats.maxLatencyMs).toBe(0);
            expect(stats.p95LatencyMs).toBe(0);
            expect(stats.slowRequestCount).toBe(0);
        });
    });

    describe('p95LatencyMs 分位数计算', () => {
        test('单条记录 p95 应为该记录的耗时', () => {
            recordTokenUsage('aliyun', 'qwen3', null, true, 1500);
            const stats = getAllProviderMetrics()['aliyun/qwen3'];
            expect(stats.p95LatencyMs).toBe(1500);
        });

        test('多条记录 p95 应接近最大值', () => {
            // 10 条记录：100, 200, ..., 1000
            for (let i = 1; i <= 10; i++) {
                recordTokenUsage('aliyun', 'qwen3', null, true, i * 100);
            }
            const stats = getAllProviderMetrics()['aliyun/qwen3'];
            // p95 = 第 95 百分位 = 第 9.5 个 → 向上取整 = 第 10 个 = 1000
            expect(stats.p95LatencyMs).toBe(1000);
        });

        test('20 条记录 p95 应为第 19 个值（排序后）', () => {
            for (let i = 1; i <= 20; i++) {
                recordTokenUsage('aliyun', 'qwen3', null, true, i * 100);
            }
            const stats = getAllProviderMetrics()['aliyun/qwen3'];
            // 20 条 * 0.95 = 19，idx = ceil(19) - 1 = 18（0-based），即第 19 个值 = 1900
            expect(stats.p95LatencyMs).toBe(1900);
        });

        test('无耗时数据时 p95 应为 0', () => {
            recordTokenUsage('aliyun', 'qwen3', null, true);  // 无 durationMs
            const stats = getAllProviderMetrics()['aliyun/qwen3'];
            expect(stats.p95LatencyMs).toBe(0);
        });
    });

    describe('多 provider/model 隔离', () => {
        test('不同 provider 应独立统计', () => {
            recordTokenUsage('aliyun', 'qwen3', null, true, 1000);
            recordTokenUsage('deepseek', 'deepseek-v3', null, true, 2000);
            const metrics = getAllProviderMetrics();
            expect(metrics['aliyun/qwen3'].avgLatencyMs).toBe(1000);
            expect(metrics['deepseek/deepseek-v3'].avgLatencyMs).toBe(2000);
        });

        test('同 provider 不同 model 应独立统计', () => {
            recordTokenUsage('aliyun', 'qwen3-plus', null, true, 1000);
            recordTokenUsage('aliyun', 'qwen3-max', null, true, 3000);
            const metrics = getAllProviderMetrics();
            expect(metrics['aliyun/qwen3-plus'].avgLatencyMs).toBe(1000);
            expect(metrics['aliyun/qwen3-max'].avgLatencyMs).toBe(3000);
        });
    });

    describe('getProviderMetrics 单个查询', () => {
        test('应返回指定 provider/model 的指标', () => {
            recordTokenUsage('aliyun', 'qwen3', null, true, 1000);
            const stats = getProviderMetrics('aliyun', 'qwen3');
            expect(stats).not.toBeNull();
            expect(stats.requestCount).toBe(1);
            expect(stats.totalDurationMs).toBe(1000);
        });

        test('不存在的 provider/model 应返回 null', () => {
            expect(getProviderMetrics('unknown', 'unknown')).toBeNull();
        });
    });

    describe('resetMetrics 重置', () => {
        test('应清空所有指标', () => {
            recordTokenUsage('aliyun', 'qwen3', null, true, 1000);
            resetMetrics();
            expect(Object.keys(getAllProviderMetrics())).toHaveLength(0);
        });
    });

    describe('SLOW_REQUEST_MS 常量', () => {
        test('应为 30000 毫秒（30 秒）', () => {
            expect(SLOW_REQUEST_MS).toBe(30000);
        });
    });
});
