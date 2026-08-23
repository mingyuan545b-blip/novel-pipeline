'use strict';

/**
 * G4 测试：metricsReport.buildReport 报告生成
 *
 * 覆盖：
 *   - 空输入返回 error
 *   - agentTimings 聚合（calls/avgMs/avgTokens）
 *   - reviewPassRates/agentPassRates 百分比格式化
 *   - reviserLoopStats/hookResolutionStats/materialStats/branchingStats 聚合
 *   - recentChapters/topErrors/topSlowestSteps 填充
 *
 * 文件位置：tests/unit/metricsReport.test.js
 */

jest.mock('../../server/services/pipelineMetrics', () => ({
    getSlowestSteps: jest.fn(() => [{ stepName: 'writer', p95Ms: 5000, avgMs: 3000, count: 10 }])
}));

const { buildReport } = require('../../server/services/metricsReport');

describe('G4: metricsReport.buildReport', () => {
    test('空输入应返回 error 对象', () => {
        const r = buildReport(null);
        expect(r).toEqual({ error: 'No metrics found' });
    });

    test('agentTimings 应聚合 calls/avgMs/avgTokens', () => {
        const r = buildReport({
            agentTimings: {
                writer: { calls: 4, totalMs: 4000, avgMs: 1000, maxMs: 2000, totalTokens: 8000 }
            },
            reviewPassRates: {}, agentPassRates: {}, reviserLoops: [],
            hookResolutionLog: [], materialAddedLog: [], chapterDurations: [],
            errorCounts: {}, branchingLog: []
        });
        expect(r.agentTimings.writer).toEqual({ calls: 4, avgMs: 1000, maxMs: 2000, avgTokens: 2000 });
    });

    test('reviewPassRates 应格式化为百分比', () => {
        const r = buildReport({
            agentTimings: {},
            reviewPassRates: { 'first-review': { total: 10, passed: 8 } },
            agentPassRates: {}, reviserLoops: [], hookResolutionLog: [],
            materialAddedLog: [], chapterDurations: [], errorCounts: {}, branchingLog: []
        });
        expect(r.reviewPassRates['first-review'].rate).toBe('80.0%');
        expect(r.reviewPassRates['first-review'].total).toBe(10);
    });

    test('reviewPassRates total=0 时 rate 应为 N/A', () => {
        const r = buildReport({
            agentTimings: {}, reviewPassRates: { empty: { total: 0, passed: 0 } },
            agentPassRates: {}, reviserLoops: [], hookResolutionLog: [],
            materialAddedLog: [], chapterDurations: [], errorCounts: {}, branchingLog: []
        });
        expect(r.reviewPassRates.empty.rate).toBe('N/A');
    });

    test('agentPassRates 应包含 recentFailChapters（最多5个）', () => {
        const r = buildReport({
            agentTimings: {}, reviewPassRates: {},
            agentPassRates: {
                writer: { total: 5, passed: 3, failChapters: [1, 2, 3, 4, 5, 6, 7] }
            },
            reviserLoops: [], hookResolutionLog: [], materialAddedLog: [],
            chapterDurations: [], errorCounts: {}, branchingLog: []
        });
        expect(r.agentPassRates.writer.passRate).toBe('60.0%');
        expect(r.agentPassRates.writer.recentFailChapters).toEqual([3, 4, 5, 6, 7]);
    });

    test('reviserLoopStats 应聚合 avg/max', () => {
        const r = buildReport({
            agentTimings: {}, reviewPassRates: {}, agentPassRates: {},
            reviserLoops: [
                { chapterNumber: 1, loopCount: 2, totalReviserMs: 1000 },
                { chapterNumber: 2, loopCount: 4, totalReviserMs: 2000 }
            ],
            hookResolutionLog: [], materialAddedLog: [], chapterDurations: [],
            errorCounts: {}, branchingLog: []
        });
        expect(r.reviserLoopStats.totalChapters).toBe(2);
        expect(r.reviserLoopStats.avgLoopsPerChapter).toBe('3.0');
        expect(r.reviserLoopStats.maxLoops).toBe(4);
    });

    test('hookResolutionStats 应分类统计 resolved/advanced/stale', () => {
        const r = buildReport({
            agentTimings: {}, reviewPassRates: {}, agentPassRates: {},
            reviserLoops: [],
            hookResolutionLog: [
                { action: 'resolved' }, { action: 'resolved' },
                { action: 'advanced' }, { action: 'stale' }
            ],
            materialAddedLog: [], chapterDurations: [], errorCounts: {}, branchingLog: []
        });
        expect(r.hookResolutionStats).toEqual({
            total: 4, resolved: 2, advanced: 1, stale: 1, resolveRate: '50.0%'
        });
    });

    test('materialStats 应按 materialType 分类统计', () => {
        const r = buildReport({
            agentTimings: {}, reviewPassRates: {}, agentPassRates: {},
            reviserLoops: [], hookResolutionLog: [],
            materialAddedLog: [
                { materialType: 'character' }, { materialType: 'character' },
                { materialType: 'item' }
            ],
            chapterDurations: [], errorCounts: {}, branchingLog: []
        });
        expect(r.materialStats.totalAdded).toBe(3);
        expect(r.materialStats.byType).toEqual({ character: 2, item: 1 });
    });

    test('branchingStats 应统计 A/B 分支选择数', () => {
        const r = buildReport({
            agentTimings: {}, reviewPassRates: {}, agentPassRates: {},
            reviserLoops: [], hookResolutionLog: [], materialAddedLog: [],
            chapterDurations: [], errorCounts: {},
            branchingLog: [
                { selectedBranch: 'A' }, { selectedBranch: 'B' }, { selectedBranch: 'A' }
            ]
        });
        expect(r.branchingStats).toEqual({
            totalBranches: 3, branchASelected: 2, branchBSelected: 1
        });
    });

    test('topErrors 应按 count 降序取前5', () => {
        const r = buildReport({
            agentTimings: {}, reviewPassRates: {}, agentPassRates: {},
            reviserLoops: [], hookResolutionLog: [], materialAddedLog: [],
            chapterDurations: [],
            errorCounts: { 'writer:timeout': 5, 'reviewer:parse': 3, 'editor:rate': 1 },
            branchingLog: []
        });
        expect(r.topErrors[0]).toEqual({ error: 'writer:timeout', count: 5 });
        expect(r.topErrors[1]).toEqual({ error: 'reviewer:parse', count: 3 });
        expect(r.topErrors.length).toBe(3);
    });

    test('topSlowestSteps 应从 pipelineMetrics.getSlowestSteps(5) 获取', () => {
        const r = buildReport({
            agentTimings: {}, reviewPassRates: {}, agentPassRates: {},
            reviserLoops: [], hookResolutionLog: [], materialAddedLog: [],
            chapterDurations: [], errorCounts: {}, branchingLog: []
        });
        expect(r.topSlowestSteps).toEqual([{ stepName: 'writer', p95Ms: 5000, avgMs: 3000, count: 10 }]);
    });
});
