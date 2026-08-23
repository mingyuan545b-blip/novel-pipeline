'use strict';

/**
 * G4 测试：metricsRecorder MetricsCollector 类
 *
 * 覆盖：
 *   - recordAgentTiming 累加 calls/totalMs/avgMs/maxMs/totalTokens
 *   - recordReviewResult 累加 total/passed
 *   - recordAgentPassRate 累加 total/passed/failChapters（带 CAP）
 *   - recordReviserLoop 推入数组并裁剪
 *   - recordChapterDuration 推入数组
 *   - recordError 按 step:type 累加
 *   - resetAgentPassRates 清空 agentPassRates
 *   - removeChapterFromFailRates 从 failChapters 移除指定章节
 *
 * 文件位置：tests/unit/metricsRecorder.test.js
 */

const store = require('../../server/store');
const { METRICS_CONFIG } = require('../../server/services/pipelineConfig');

// Mock dataContext — 每个测试用例提供独立的内存 project
function makeMockContext(initialMetrics) {
    const project = { id: 'p1', _pipeline_metrics: initialMetrics || undefined };
    return {
        getProject: async () => project,
        _project: project
    };
}

jest.mock('../../server/services/dataContext', () => ({
    getDataContext: jest.fn()
}));

const { getDataContext } = require('../../server/services/dataContext');
const { MetricsCollector, METRICS_KEY } = require('../../server/services/metricsRecorder');

describe('G4: MetricsCollector.recordAgentTiming', () => {
    beforeEach(() => {
        store.setItem = jest.fn().mockResolvedValue(true);
    });

    test('应累加 calls/totalMs/avgMs/maxMs/totalTokens', async () => {
        const ctx = makeMockContext();
        getDataContext.mockResolvedValue(ctx);

        const c = new MetricsCollector('p1');
        await c.recordAgentTiming('writer', 1000, 500);
        await c.recordAgentTiming('writer', 3000, 1500);

        const metrics = ctx._project[METRICS_KEY];
        expect(metrics.agentTimings.writer).toEqual({
            calls: 2, totalMs: 4000, avgMs: 2000, maxMs: 3000, totalTokens: 2000
        });
    });

    test('tokenCount 缺省时 totalTokens 应不变', async () => {
        const ctx = makeMockContext();
        getDataContext.mockResolvedValue(ctx);

        const c = new MetricsCollector('p1');
        await c.recordAgentTiming('writer', 1000);

        const metrics = ctx._project[METRICS_KEY];
        expect(metrics.agentTimings.writer.totalTokens).toBe(0);
    });
});

describe('G4: MetricsCollector.recordReviewResult', () => {
    test('应累加 total/passed', async () => {
        const ctx = makeMockContext();
        getDataContext.mockResolvedValue(ctx);
        store.setItem = jest.fn().mockResolvedValue(true);

        const c = new MetricsCollector('p1');
        await c.recordReviewResult('first-review', true);
        await c.recordReviewResult('first-review', false);
        await c.recordReviewResult('first-review', true);

        const metrics = ctx._project[METRICS_KEY];
        expect(metrics.reviewPassRates['first-review']).toEqual({ total: 3, passed: 2 });
    });
});

describe('G4: MetricsCollector.recordAgentPassRate', () => {
    test('应累加 total/passed/failChapters', async () => {
        const ctx = makeMockContext();
        getDataContext.mockResolvedValue(ctx);
        store.setItem = jest.fn().mockResolvedValue(true);

        const c = new MetricsCollector('p1');
        await c.recordAgentPassRate('writer', true, 1);
        await c.recordAgentPassRate('writer', false, 2);
        await c.recordAgentPassRate('writer', false, 3);

        const metrics = ctx._project[METRICS_KEY];
        expect(metrics.agentPassRates.writer).toEqual({
            total: 3, passed: 1, failChapters: [2, 3]
        });
    });

    test(`failChapters 应受 METRICS_CONFIG.FAIL_CHAPTERS_CAP 限制`, async () => {
        const ctx = makeMockContext();
        getDataContext.mockResolvedValue(ctx);
        store.setItem = jest.fn().mockResolvedValue(true);

        const c = new MetricsCollector('p1');
        // 写入超过 CAP 次失败
        const cap = METRICS_CONFIG.FAIL_CHAPTERS_CAP;
        for (let i = 1; i <= cap + 5; i++) {
            await c.recordAgentPassRate('writer', false, i);
        }

        const metrics = ctx._project[METRICS_KEY];
        // length 达到 CAP 后不再 push（length < CAP 时才 push）
        expect(metrics.agentPassRates.writer.failChapters.length).toBe(cap);
        // 应保留前 cap 个章节号（push 在 length=cap 时停止）
        expect(metrics.agentPassRates.writer.failChapters[0]).toBe(1);
        expect(metrics.agentPassRates.writer.failChapters[cap - 1]).toBe(cap);
    });
});

describe('G4: MetricsCollector.recordReviserLoop', () => {
    test('应推入 reviserLoops 数组', async () => {
        const ctx = makeMockContext();
        getDataContext.mockResolvedValue(ctx);
        store.setItem = jest.fn().mockResolvedValue(true);

        const c = new MetricsCollector('p1');
        await c.recordReviserLoop(1, 2, 1000, 5);

        const metrics = ctx._project[METRICS_KEY];
        expect(metrics.reviserLoops).toHaveLength(1);
        expect(metrics.reviserLoops[0]).toMatchObject({
            chapterNumber: 1, loopCount: 2, totalReviserMs: 1000, issuesFixed: 5
        });
        expect(metrics.reviserLoops[0].timestamp).toBeDefined();
    });
});

describe('G4: MetricsCollector.recordChapterDuration', () => {
    test('应推入 chapterDurations 数组', async () => {
        const ctx = makeMockContext();
        getDataContext.mockResolvedValue(ctx);
        store.setItem = jest.fn().mockResolvedValue(true);

        const c = new MetricsCollector('p1');
        await c.recordChapterDuration(1, 60000, 3);

        const metrics = ctx._project[METRICS_KEY];
        expect(metrics.chapterDurations).toHaveLength(1);
        expect(metrics.chapterDurations[0]).toMatchObject({
            chapterNumber: 1, durationMs: 60000, rounds: 3
        });
    });
});

describe('G4: MetricsCollector.recordError', () => {
    test('应按 step:errorType 累加计数', async () => {
        const ctx = makeMockContext();
        getDataContext.mockResolvedValue(ctx);
        store.setItem = jest.fn().mockResolvedValue(true);

        const c = new MetricsCollector('p1');
        await c.recordError('writer', 'timeout');
        await c.recordError('writer', 'timeout');
        await c.recordError('reviewer', 'parse');

        const metrics = ctx._project[METRICS_KEY];
        expect(metrics.errorCounts).toEqual({
            'writer:timeout': 2,
            'reviewer:parse': 1
        });
    });
});

describe('G4: MetricsCollector.resetAgentPassRates', () => {
    test('应清空 agentPassRates', async () => {
        const ctx = makeMockContext({
            agentPassRates: { writer: { total: 5, passed: 3, failChapters: [1, 2] } },
            agentTimings: {}, reviewPassRates: {}, tokenUsage: {},
            chapterDurations: [], errorCounts: {}, reviserLoops: [],
            hookResolutionLog: [], materialAddedLog: [], branchingLog: []
        });
        getDataContext.mockResolvedValue(ctx);
        store.setItem = jest.fn().mockResolvedValue(true);

        const c = new MetricsCollector('p1');
        await c.resetAgentPassRates();

        const metrics = ctx._project[METRICS_KEY];
        expect(metrics.agentPassRates).toEqual({});
        // 其他字段不应被清空
        expect(metrics.agentTimings).toBeDefined();
    });
});

describe('G4: MetricsCollector.removeChapterFromFailRates', () => {
    test('应从所有 agent 的 failChapters 中移除指定章节', async () => {
        const ctx = makeMockContext({
            agentPassRates: {
                writer: { total: 5, passed: 3, failChapters: [1, 2, 3] },
                reviewer: { total: 5, passed: 4, failChapters: [2, 4] }
            },
            agentTimings: {}, reviewPassRates: {}, tokenUsage: {},
            chapterDurations: [], errorCounts: {}, reviserLoops: [],
            hookResolutionLog: [], materialAddedLog: [], branchingLog: []
        });
        getDataContext.mockResolvedValue(ctx);
        store.setItem = jest.fn().mockResolvedValue(true);

        const c = new MetricsCollector('p1');
        await c.removeChapterFromFailRates(2);

        const metrics = ctx._project[METRICS_KEY];
        expect(metrics.agentPassRates.writer.failChapters).toEqual([1, 3]);
        expect(metrics.agentPassRates.reviewer.failChapters).toEqual([4]);
    });
});
