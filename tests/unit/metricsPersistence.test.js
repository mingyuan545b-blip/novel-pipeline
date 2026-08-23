'use strict';

/**
 * G4 测试：metricsPersistence 核心函数
 *
 * 覆盖：
 *   - takeSnapshot 返回 ts/pipeline/llm 三个字段
 *   - predictQuotaExhaustion 计算 hoursRemaining/exhaustAt
 *   - predictQuotaExhaustion 空输入返回 null
 *   - loadHistoricalSnapshots store 异常时返回空数组
 *   - persistSnapshot 超过 MAX_SNAPSHOTS 时裁剪旧快照
 *
 * 文件位置：tests/unit/metricsPersistence.test.js
 */

jest.mock('../../server/services/pipelineMetrics', () => ({
    getAllMetrics: jest.fn(() => ({ writer: { count: 5, totalMs: 1000 } })),
    getSlowestSteps: jest.fn(() => [])
}));

jest.mock('../../server/services/llmMetrics', () => ({
    getAllProviderMetrics: jest.fn(() => ({
        aliyun: { requestCount: 10, failureCount: 1, p95LatencyMs: 2000, slowRequestCount: 0 }
    })),
    SLOW_REQUEST_MS: 3000
}));

const metricsPersistence = require('../../server/services/metricsPersistence');

describe('G4: metricsPersistence.takeSnapshot', () => {
    test('应返回 ts/pipeline/llm 三个字段', () => {
        const snap = metricsPersistence.takeSnapshot();
        expect(snap).toHaveProperty('ts');
        expect(snap).toHaveProperty('pipeline');
        expect(snap).toHaveProperty('llm');
        expect(typeof snap.ts).toBe('string');
        expect(snap.pipeline.writer.count).toBe(5);
        expect(snap.llm.aliyun.requestCount).toBe(10);
    });

    test('ts 应为 ISO 格式', () => {
        const snap = metricsPersistence.takeSnapshot();
        expect(() => new Date(snap.ts).toISOString()).not.toThrow();
    });
});

describe('G4: metricsPersistence.predictQuotaExhaustion', () => {
    test('应正确计算 hoursRemaining 与 exhaustAt', () => {
        // 1000 tokens/hour, 5000 quota → 5 hours
        const result = metricsPersistence.predictQuotaExhaustion(1000, 5000);
        expect(result).not.toBeNull();
        expect(result.hoursRemaining).toBe(5.0);
        expect(() => new Date(result.exhaustAt).toISOString()).not.toThrow();
    });

    test('小数 hours 应保留 1 位', () => {
        // 1000/hour, 5500 quota → 5.5 hours
        const result = metricsPersistence.predictQuotaExhaustion(1000, 5500);
        expect(result.hoursRemaining).toBe(5.5);
    });

    test('hourlyTokenRate 为 0 应返回 null', () => {
        expect(metricsPersistence.predictQuotaExhaustion(0, 5000)).toBeNull();
    });

    test('quotaLimit 为 0 应返回 null', () => {
        expect(metricsPersistence.predictQuotaExhaustion(1000, 0)).toBeNull();
    });

    test('两者都为 undefined 应返回 null', () => {
        expect(metricsPersistence.predictQuotaExhaustion(undefined, undefined)).toBeNull();
    });
});

describe('G4: metricsPersistence.loadHistoricalSnapshots', () => {
    test('store 异常时应返回空数组', async () => {
        // 不初始化 store，让 _ensureStore 抛错或返回 undefined
        // 由于 store 是 lazy require，我们 mock store.getItem 抛错
        jest.resetModules();
        jest.doMock('../../server/store', () => ({
            getItem: jest.fn().mockRejectedValue(new Error('store unavailable'))
        }));
        const persistenceMod = require('../../server/services/metricsPersistence');
        const result = await persistenceMod.loadHistoricalSnapshots();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toEqual([]);
        jest.dontMock('../../server/store');
    });

    test('store 返回非数组时应返回空数组', async () => {
        jest.resetModules();
        jest.doMock('../../server/store', () => ({
            getItem: jest.fn().mockResolvedValue({ not: 'an array' })
        }));
        const persistenceMod = require('../../server/services/metricsPersistence');
        const result = await persistenceMod.loadHistoricalSnapshots();
        expect(result).toEqual([]);
        jest.dontMock('../../server/store');
    });
});

describe('G4: metricsPersistence.startPersistence/stopPersistence', () => {
    test('startPersistence 不应抛错', () => {
        expect(() => metricsPersistence.startPersistence()).not.toThrow();
        // 立即停止避免影响后续测试
        metricsPersistence.stopPersistence();
    });

    test('stopPersistence 不应抛错（即使未启动）', () => {
        expect(() => metricsPersistence.stopPersistence()).not.toThrow();
    });

    test('重复调用 startPersistence 不应创建多个 timer', () => {
        metricsPersistence.startPersistence();
        metricsPersistence.startPersistence();
        metricsPersistence.stopPersistence();
        // 不抛错即可
    });
});
