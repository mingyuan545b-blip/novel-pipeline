'use strict';

/**
 * reviewCircuitBreaker 单元测试（S1）
 *
 * 测试策略：
 * - mock store（内存 Map 实现 getItem/setItem）
 * - mock dataContext（_migrateFromProject 路径）
 * - 覆盖 recordFailure/recordSuccess/isTripped/getAdjustedConfig/getStats/reset
 * - 覆盖阈值触发、冷却恢复、history 裁剪、迁移逻辑
 *
 * 文件位置：tests/unit/reviewCircuitBreaker.test.js
 */

jest.mock('../../server/shared/logger', () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));

// 内存式 store mock — 变量必须以 mock 开头（jest hoisting 规则）
const mockStore = new Map();
jest.mock('../../server/store', () => ({
    getItem: jest.fn(async (type, id) => mockStore.get(`${type}:${id}`) || null),
    setItem: jest.fn(async (type, id, value) => { mockStore.set(`${type}:${id}`, value); })
}));

jest.mock('../../server/services/dataContext', () => ({
    getDataContext: jest.fn()
}));

const { ReviewCircuitBreaker, getCircuitBreaker, DEFAULT_CONFIG } = require('../../server/services/reviewCircuitBreaker');
const store = require('../../server/store');
const { getDataContext } = require('../../server/services/dataContext');

function resetMockStore() {
    mockStore.clear();
    store.getItem.mockClear();
    store.setItem.mockClear();
}

describe('reviewCircuitBreaker (S1)', () => {
    beforeEach(() => {
        resetMockStore();
        // 默认 mock：project 不存在（不触发迁移）
        getDataContext.mockReset();
        getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(null) });
    });

    describe('DEFAULT_CONFIG', () => {
        test('包含关键默认值', () => {
            expect(DEFAULT_CONFIG.threshold).toBe(3);
            expect(DEFAULT_CONFIG.cooldownMs).toBe(10 * 60 * 1000);
            expect(DEFAULT_CONFIG.temperatureBoost).toBe(0.15);
            expect(DEFAULT_CONFIG.enablePolisher).toBe(true);
            expect(DEFAULT_CONFIG.historyMax).toBe(50);
            expect(DEFAULT_CONFIG.historyTrimTo).toBe(30);
        });
    });

    describe('getCircuitBreaker 工厂', () => {
        test('无 project 配置时使用默认值', () => {
            const cb = getCircuitBreaker('p1', null);
            expect(cb.projectId).toBe('p1');
            expect(cb.config.threshold).toBe(DEFAULT_CONFIG.threshold);
        });

        test('project.circuitBreakerConfig 覆盖默认值', () => {
            const cb = getCircuitBreaker('p1', { circuitBreakerConfig: { threshold: 5 } });
            expect(cb.config.threshold).toBe(5);
            expect(cb.config.cooldownMs).toBe(DEFAULT_CONFIG.cooldownMs);
        });
    });

    describe('_getStore 初始化路径', () => {
        test('首次访问创建空状态', async () => {
            const cb = new ReviewCircuitBreaker('p1');
            const state = await cb._getStore();
            expect(state.consecutiveFailures).toBe(0);
            expect(state.tripped).toBe(false);
            expect(state.history).toEqual([]);
            expect(store.setItem).toHaveBeenCalledWith('circuit-breakers', 'p1', expect.objectContaining({ id: 'p1' }));
        });

        test('已存在状态直接返回', async () => {
            mockStore.set('circuit-breakers:p1', { id: 'p1', tripped: true, consecutiveFailures: 5, history: [] });
            const cb = new ReviewCircuitBreaker('p1');
            const state = await cb._getStore();
            expect(state.tripped).toBe(true);
            expect(state.consecutiveFailures).toBe(5);
        });

        test('从 project._circuitBreaker 迁移', async () => {
            const oldCb = { consecutiveFailures: 2, tripped: false, history: [{ step: 'first-review', chapterNumber: 1, result: 'fail' }] };
            const project = { id: 'p1', _circuitBreaker: oldCb };
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            const cb = new ReviewCircuitBreaker('p1');
            const state = await cb._getStore();
            expect(state.consecutiveFailures).toBe(2);
            expect(state.history).toHaveLength(1);
            expect(project._circuitBreaker).toBeUndefined();
        });

        test('project 不存在时不迁移', async () => {
            const cb = new ReviewCircuitBreaker('p1');
            const state = await cb._getStore();
            expect(state.consecutiveFailures).toBe(0);
        });

        test('project 无 _circuitBreaker 时不迁移', async () => {
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue({ id: 'p1' }) });
            const cb = new ReviewCircuitBreaker('p1');
            const state = await cb._getStore();
            expect(state.consecutiveFailures).toBe(0);
        });
    });

    describe('recordFailure', () => {
        test('单次失败递增计数不触发熔断', async () => {
            const cb = new ReviewCircuitBreaker('p1');
            await cb.recordFailure('first-review', 1);
            const state = await cb._getStore();
            expect(state.consecutiveFailures).toBe(1);
            expect(state.tripped).toBe(false);
            expect(state.lastFailureStep).toBe('first-review');
            expect(state.history).toHaveLength(1);
            expect(state.history[0]).toMatchObject({ step: 'first-review', chapterNumber: 1, result: 'fail' });
        });

        test('达到 threshold 触发熔断', async () => {
            const cb = new ReviewCircuitBreaker('p1', { threshold: 3 });
            await cb.recordFailure('first-review', 1);
            await cb.recordFailure('first-review', 2);
            await cb.recordFailure('first-review', 3);
            const state = await cb._getStore();
            expect(state.tripped).toBe(true);
            expect(state.consecutiveFailures).toBe(3);
            expect(state.tripChapter).toBe(3);
            expect(state.tripTimestamp).toBeGreaterThan(0);
        });

        test('已熔断状态再次失败不重复触发', async () => {
            const cb = new ReviewCircuitBreaker('p1', { threshold: 2 });
            await cb.recordFailure('first-review', 1);
            await cb.recordFailure('first-review', 2);
            const tripTs = (await cb._getStore()).tripTimestamp;
            await new Promise(r => setTimeout(r, 5));
            await cb.recordFailure('first-review', 3);
            const state = await cb._getStore();
            expect(state.consecutiveFailures).toBe(3);
            expect(state.tripped).toBe(true);
            expect(state.tripTimestamp).toBe(tripTs);
            expect(state.tripChapter).toBe(2);
        });

        test('history 缺失时自动初始化', async () => {
            mockStore.set('circuit-breakers:p1', { id: 'p1', consecutiveFailures: 0, tripped: false });
            const cb = new ReviewCircuitBreaker('p1');
            await cb.recordFailure('first-review', 1);
            const state = await cb._getStore();
            expect(state.history).toHaveLength(1);
        });

        test('history 超 historyMax 触发裁剪到 historyTrimTo', async () => {
            const cb = new ReviewCircuitBreaker('p1', { threshold: 100, historyMax: 5, historyTrimTo: 3 });
            for (let i = 1; i <= 6; i++) {
                await cb.recordFailure('first-review', i);
            }
            const state = await cb._getStore();
            expect(state.history).toHaveLength(3);
            expect(state.history[0].chapterNumber).toBe(4);
            expect(state.history[2].chapterNumber).toBe(6);
        });
    });

    describe('recordSuccess', () => {
        test('未熔断时重置连续失败计数', async () => {
            const cb = new ReviewCircuitBreaker('p1', { threshold: 5 });
            await cb.recordFailure('first-review', 1);
            await cb.recordFailure('first-review', 2);
            await cb.recordSuccess(3);
            const state = await cb._getStore();
            expect(state.consecutiveFailures).toBe(0);
            expect(state.tripped).toBe(false);
        });

        test('熔断但未过冷却期保持熔断', async () => {
            const cb = new ReviewCircuitBreaker('p1', { threshold: 1, cooldownMs: 60 * 60 * 1000 });
            await cb.recordFailure('first-review', 1);
            expect(await cb.isTripped()).toBe(true);
            await cb.recordSuccess(2);
            const state = await cb._getStore();
            expect(state.tripped).toBe(true);
            expect(state.consecutiveFailures).toBe(1);
        });

        test('熔断且过冷却期后恢复', async () => {
            const cb = new ReviewCircuitBreaker('p1', { threshold: 1, cooldownMs: 1 });
            await cb.recordFailure('first-review', 1);
            expect(await cb.isTripped()).toBe(true);
            await new Promise(r => setTimeout(r, 5));
            await cb.recordSuccess(2);
            const state = await cb._getStore();
            expect(state.tripped).toBe(false);
            expect(state.consecutiveFailures).toBe(0);
        });

        test('history 超 historyMax 触发裁剪', async () => {
            const cb = new ReviewCircuitBreaker('p1', { historyMax: 5, historyTrimTo: 3 });
            for (let i = 1; i <= 6; i++) {
                await cb.recordSuccess(i);
            }
            const state = await cb._getStore();
            expect(state.history).toHaveLength(3);
        });

        test('history 缺失时自动初始化', async () => {
            mockStore.set('circuit-breakers:p1', { id: 'p1', consecutiveFailures: 0, tripped: false });
            const cb = new ReviewCircuitBreaker('p1');
            await cb.recordSuccess(1);
            const state = await cb._getStore();
            expect(state.history).toHaveLength(1);
            expect(state.history[0]).toMatchObject({ result: 'pass', chapterNumber: 1 });
        });
    });

    describe('isTripped', () => {
        test('初始状态返回 false', async () => {
            const cb = new ReviewCircuitBreaker('p1');
            expect(await cb.isTripped()).toBe(false);
        });

        test('熔断后返回 true', async () => {
            const cb = new ReviewCircuitBreaker('p1', { threshold: 1 });
            await cb.recordFailure('first-review', 1);
            expect(await cb.isTripped()).toBe(true);
        });
    });

    describe('getAdjustedConfig', () => {
        test('未熔断返回零值', async () => {
            const cb = new ReviewCircuitBreaker('p1');
            const cfg = await cb.getAdjustedConfig();
            expect(cfg.temperatureBoost).toBe(0);
            expect(cfg.enablePolisher).toBe(false);
            expect(cfg.message).toBe('');
        });

        test('熔断后返回提升配置', async () => {
            const cb = new ReviewCircuitBreaker('p1', { threshold: 1, temperatureBoost: 0.2 });
            await cb.recordFailure('first-review', 1);
            const cfg = await cb.getAdjustedConfig();
            expect(cfg.temperatureBoost).toBe(0.2);
            expect(cfg.enablePolisher).toBe(true);
            expect(cfg.message).toContain('熔断激活');
            expect(cfg.message).toContain('first-review');
        });
    });

    describe('getStats', () => {
        test('初始状态返回默认 stats', async () => {
            const cb = new ReviewCircuitBreaker('p1');
            const stats = await cb.getStats();
            expect(stats.tripped).toBe(false);
            expect(stats.consecutiveFailures).toBe(0);
            expect(stats.history).toEqual([]);
            expect(stats.recentPassRate).toBe('N/A');
            expect(stats.recentPassCount).toBe(0);
            expect(stats.recentFailCount).toBe(0);
            expect(stats.config).toBeDefined();
        });

        test('统计最近 10 条 pass/fail', async () => {
            const cb = new ReviewCircuitBreaker('p1', { threshold: 100 });
            await cb.recordFailure('first-review', 1);
            await cb.recordSuccess(2);
            await cb.recordFailure('first-review', 3);
            const stats = await cb.getStats();
            expect(stats.recentFailCount).toBe(2);
            expect(stats.recentPassCount).toBe(1);
            expect(stats.recentPassRate).toBe('33.3%');
            expect(stats.history).toHaveLength(3);
        });

        test('history 只返回最近 10 条', async () => {
            const cb = new ReviewCircuitBreaker('p1', { threshold: 100, historyMax: 100, historyTrimTo: 50 });
            for (let i = 1; i <= 15; i++) {
                await cb.recordFailure('first-review', i);
            }
            const stats = await cb.getStats();
            expect(stats.history).toHaveLength(10);
        });
    });

    describe('reset', () => {
        test('清空熔断状态', async () => {
            const cb = new ReviewCircuitBreaker('p1', { threshold: 1 });
            await cb.recordFailure('first-review', 1);
            expect(await cb.isTripped()).toBe(true);
            await cb.reset();
            const state = await cb._getStore();
            expect(state.tripped).toBe(false);
            expect(state.consecutiveFailures).toBe(0);
            expect(state.history).toEqual([]);
        });

        test('reset 后写入 store', async () => {
            const cb = new ReviewCircuitBreaker('p1');
            await cb.reset();
            expect(store.setItem).toHaveBeenCalledWith('circuit-breakers', 'p1', expect.objectContaining({
                id: 'p1', tripped: false, consecutiveFailures: 0
            }));
        });
    });

    describe('冷却期边界', () => {
        test('刚好等于 cooldownMs 触发恢复', async () => {
            const cb = new ReviewCircuitBreaker('p1', { threshold: 1, cooldownMs: 1 });
            await cb.recordFailure('first-review', 1);
            await new Promise(r => setTimeout(r, 2));
            await cb.recordSuccess(2);
            const state = await cb._getStore();
            expect(state.tripped).toBe(false);
        });

        test('tripTimestamp 为 0 时 elapsed 巨大触发恢复', async () => {
            mockStore.set('circuit-breakers:p1', {
                id: 'p1', tripped: true, consecutiveFailures: 3,
                tripTimestamp: 0, history: []
            });
            const cb = new ReviewCircuitBreaker('p1', { cooldownMs: 1000 });
            await cb.recordSuccess(1);
            const state = await cb._getStore();
            expect(state.tripped).toBe(false);
        });
    });
});
