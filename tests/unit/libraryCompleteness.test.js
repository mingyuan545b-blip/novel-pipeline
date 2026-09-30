/**
 * libraryCompleteness.test.js — 藏经阁技法"内容完整度"判定
 *
 * 背景：库里 207 条技法有 184 条是空壳（无规则/无反模式/无描述），
 * 前端据此做"有内容优先"排序与空壳降权，判定口径必须稳定。
 */
'use strict';

const { assessCompleteness, summarize, LEVELS, FULL_RULE_THRESHOLD } = require('../../server/services/libraryCompleteness');

describe('assessCompleteness', () => {
    test('规则≥阈值 → full（与提取解析层判废下限一致）', () => {
        const t = { implementation_rules: ['a', 'b'] };
        const c = assessCompleteness(t);
        expect(c.level).toBe(LEVELS.FULL);
        expect(c.hasRules).toBe(true);
        expect(c.rulesCount).toBe(2);
    });

    test('规则不足但有描述/反模式 → partial', () => {
        expect(assessCompleteness({ implementation_rules: ['a'] }).level).toBe(LEVELS.PARTIAL);
        expect(assessCompleteness({ anti_patterns: ['x'] }).level).toBe(LEVELS.PARTIAL);
        expect(assessCompleteness({ description: '有描述' }).level).toBe(LEVELS.PARTIAL);
    });

    test('全空 → empty（空壳）', () => {
        const c = assessCompleteness({ implementation_rules: [], anti_patterns: [], description: '' });
        expect(c.level).toBe(LEVELS.EMPTY);
        expect(c.score).toBe(0);
    });

    test('空白描述不算有内容（避免空格骗过判定）', () => {
        expect(assessCompleteness({ description: '   ' }).level).toBe(LEVELS.EMPTY);
    });

    test('缺字段/非法类型不抛错，按空壳处理', () => {
        expect(assessCompleteness(null).level).toBe(LEVELS.EMPTY);
        expect(assessCompleteness(undefined).level).toBe(LEVELS.EMPTY);
        expect(assessCompleteness({ implementation_rules: 'not-an-array' }).rulesCount).toBe(0);
    });

    test('score 单调：规则越多分越高，用于"有内容优先"排序', () => {
        const s1 = assessCompleteness({ implementation_rules: ['a', 'b'] }).score;
        const s2 = assessCompleteness({ implementation_rules: ['a', 'b', 'c'] }).score;
        const s3 = assessCompleteness({}).score;
        expect(s2).toBeGreaterThan(s1);
        expect(s1).toBeGreaterThan(s3);
    });

    test('阈值常量被引用而非硬编码', () => {
        expect(assessCompleteness({ implementation_rules: new Array(FULL_RULE_THRESHOLD).fill('x') }).level).toBe(LEVELS.FULL);
    });
});

describe('summarize', () => {
    test('统计各类数量', () => {
        const r = summarize([{ implementation_rules: ['a', 'b'] }, { description: 'd' }, {}, null]);
        expect(r).toEqual({ total: 4, full: 1, partial: 1, empty: 2 });
    });
    test('非数组输入不抛错', () => {
        expect(summarize(null)).toEqual({ total: 0, full: 0, partial: 0, empty: 0 });
    });
});
