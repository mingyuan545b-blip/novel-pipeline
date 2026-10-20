/**
 * timelineContextResolver.test.js — 时间轴上下文解析测试
 */
const { TIMELINE_PRIORITY, DISTANCE_DECAY } = require('../../server/services/pipeline/timelineContextResolver');

describe('timelineContextResolver constants', () => {
    test('TIMELINE_PRIORITY has main and sub', () => {
        expect(TIMELINE_PRIORITY.main).toBeDefined();
        expect(TIMELINE_PRIORITY.main.depth).toBe('L2');
        expect(TIMELINE_PRIORITY.sub).toBeDefined();
        expect(TIMELINE_PRIORITY.sub.depth).toBe('L1');
    });

    test('TIMELINE_PRIORITY main has higher maxEvents than sub', () => {
        expect(TIMELINE_PRIORITY.main.maxEvents).toBeGreaterThan(TIMELINE_PRIORITY.sub.maxEvents);
    });

    test('DISTANCE_DECAY has all decay levels', () => {
        expect(DISTANCE_DECAY.currentChapter.depthBoost).toBe(2);
        expect(DISTANCE_DECAY.recentChapters.depthBoost).toBe(1);
        expect(DISTANCE_DECAY.olderChapters.depthBoost).toBe(0);
        expect(DISTANCE_DECAY.ancientChapters.depthBoost).toBe(-1);
    });

    test('DISTANCE_DECAY currentChapter has smallest lookback', () => {
        expect(DISTANCE_DECAY.currentChapter.maxLookback).toBeLessThan(DISTANCE_DECAY.recentChapters.maxLookback);
    });
});
