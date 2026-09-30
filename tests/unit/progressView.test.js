/**
 * progressView.test.js — 运行看板视图组装（纯函数）
 *
 * 回答"第几章 / 谁在干什么 / 用了多久 / 第几轮"，口径必须可测：
 * 日志在步骤结束时写入，故步耗时 = 与上一条日志的间隔；无数据必须为 null 而非 0。
 */
'use strict';

const { buildProgressView, buildStepTimeline, buildAgentStats, countCompleted, stepLabel } = require('../../server/services/pipeline/progressView');

const LOG = (entries) => [{ projectId: 'p', entries }];
const ENTRY = (step, ts, over = {}) => ({ step, timestamp: ts, round: 1, runRound: 1, chapterNumber: 1, ...over });

describe('stepLabel', () => {
    test('已知步骤走中文映射，未知回落原名', () => {
        expect(stepLabel('writer')).toBe('执笔人');
        expect(stepLabel('round-start')).toBe('轮次开始');
        expect(stepLabel('mystery')).toBe('mystery');
        expect(stepLabel('')).toBe('未知步骤');
    });
});

describe('buildStepTimeline', () => {
    test('按时间排序，耗时=与上一条的间隔，首条为 null', () => {
        const rows = buildStepTimeline(LOG([
            ENTRY('writer', '2026-01-01T00:00:00.000Z'),
            ENTRY('first-review', '2026-01-01T00:02:00.000Z'),
        ]), Date.parse('2026-01-01T00:05:00.000Z'), false);
        expect(rows.map(r => r.step)).toEqual(['writer', 'first-review']);
        expect(rows[0].durationMs).toBeNull();
        expect(rows[1].durationMs).toBe(120000);
    });

    test('运行中给最后一条补 elapsedMs（该步尚未写日志，只能按间隔推断）', () => {
        const rows = buildStepTimeline(LOG([ENTRY('writer', '2026-01-01T00:00:00.000Z')]),
            Date.parse('2026-01-01T00:01:00.000Z'), true);
        expect(rows[0].running).toBe(true);
        expect(rows[0].elapsedMs).toBe(60000);
    });

    test('非法时间戳被跳过，不产生 NaN', () => {
        const rows = buildStepTimeline(LOG([ENTRY('writer', 'bad'), ENTRY('polisher', '2026-01-01T00:00:00.000Z')]),
            Date.now(), false);
        expect(rows).toHaveLength(1);
        expect(rows[0].step).toBe('polisher');
    });

    test('空输入返回空数组', () => {
        expect(buildStepTimeline([], Date.now(), false)).toEqual([]);
        expect(buildStepTimeline(null, Date.now(), false)).toEqual([]);
    });
});

describe('buildAgentStats', () => {
    test('无计时的步骤（totalMs=0）排到后面并标 hasTiming=false', () => {
        const rows = buildAgentStats({
            writer: { calls: 2, totalMs: 0, totalTokens: 5000 },
            'first-review': { calls: 1, totalMs: 120000, avgMs: 120000, maxMs: 120000, totalTokens: 10 },
        });
        expect(rows[0].agent).toBe('first-review');
        expect(rows[0].hasTiming).toBe(true);
        expect(rows[1].hasTiming).toBe(false);
        expect(rows[1].label).toBe('执笔人');
    });
    test('空输入返回空数组', () => {
        expect(buildAgentStats(null)).toEqual([]);
    });
});

describe('countCompleted', () => {
    test('只算已 material-updated/approved 且有正文的章节', () => {
        expect(countCompleted([
            { status: 'material-updated', content: 'x' },
            { status: 'approved', content: 'y' },
            { status: 'approved', content: '' },
            { status: 'outlined', content: 'z' },
        ])).toBe(2);
    });
});

describe('buildProgressView', () => {
    test('组装总进度/当前步骤/时间线/统计', () => {
        const v = buildProgressView({
            project: { id: 'p', name: 'X', genre: '高武', targetChapters: 20 },
            infiniteStatus: { running: true, currentChapter: 3, phase: '写作' },
            chapters: [{ status: 'material-updated', content: 'x'.repeat(2500) }],
            logs: LOG([ENTRY('writer', '2026-01-01T00:00:00.000Z')]),
            agentTimings: { writer: { calls: 1, totalMs: 1000, avgMs: 1000, maxMs: 1000, totalTokens: 100 } },
            now: '2026-01-01T00:01:00.000Z',
        });
        expect(v.progress).toMatchObject({ completed: 1, target: 20, percent: 5, currentChapter: 3 });
        expect(v.current.step).toBe('writer');
        expect(v.current.stepLabel).toBe('执笔人');
        expect(v.current.sinceMs).toBe(60000);
        expect(v.running).toBe(true);
        expect(v.agentStats[0].agent).toBe('writer');
    });

    test('没有章节/日志时不抛错，进度为 0 且 current 为 null', () => {
        const v = buildProgressView({ project: { id: 'p', targetChapters: 0 }, chapters: [], logs: [], agentTimings: {} });
        expect(v.progress.percent).toBe(0);
        expect(v.current).toBeNull();
        expect(v.timeline).toEqual([]);
    });
});
