/**
 * techniqueScoring 单测 — 技法基础分归一化（D 增量 1）
 * 源头缺陷：success_rate（0–100）被当 0–1 用 → 基础分恒为 ~50，压过全部 boost。
 */
const { normalizeSuccessRate, baseScore, DEFAULT_SUCCESS_RATE, BASE_WEIGHT } = require('../../server/services/pipeline/techniqueScoring');

describe('normalizeSuccessRate（0–100 → 0–1）', () => {
    test('百分数换算', () => {
        expect(normalizeSuccessRate(50)).toBeCloseTo(0.5);
        expect(normalizeSuccessRate(17)).toBeCloseTo(0.17);
        expect(normalizeSuccessRate(100)).toBe(1);
    });
    test('上限截断到 1', () => {
        expect(normalizeSuccessRate(150)).toBe(1);
    });
    test('非法/缺失/≤0 → 中性先验', () => {
        expect(normalizeSuccessRate(undefined)).toBe(DEFAULT_SUCCESS_RATE);
        expect(normalizeSuccessRate(null)).toBe(DEFAULT_SUCCESS_RATE);
        expect(normalizeSuccessRate('abc')).toBe(DEFAULT_SUCCESS_RATE);
        expect(normalizeSuccessRate(0)).toBe(DEFAULT_SUCCESS_RATE);
        expect(normalizeSuccessRate(-5)).toBe(DEFAULT_SUCCESS_RATE);
    });
});

describe('baseScore', () => {
    test('与各 boost 同量级（≤BASE_WEIGHT），不再恒为 50', () => {
        expect(baseScore({ success_rate: 50 })).toBeCloseTo(0.5 * BASE_WEIGHT);
        expect(baseScore({ success_rate: 10 })).toBeCloseTo(0.1 * BASE_WEIGHT);
        expect(baseScore({})).toBeCloseTo(DEFAULT_SUCCESS_RATE * BASE_WEIGHT);
    });
    test('null/undefined 安全', () => {
        expect(baseScore(null)).toBeCloseTo(DEFAULT_SUCCESS_RATE * BASE_WEIGHT);
        expect(baseScore(undefined)).toBeCloseTo(DEFAULT_SUCCESS_RATE * BASE_WEIGHT);
    });
});

const { feedbackDelta, FEEDBACK_WEIGHT, FEEDBACK_PRIOR_STRENGTH } = require('../../server/services/pipeline/techniqueScoring');

describe('feedbackDelta（D 增量·差分加权）', () => {
    test('无反馈样本（count=0）→ 0，不干预', () => {
        expect(feedbackDelta({ rate: 1, count: 0, prior: 0.5 })).toBe(0);
        expect(feedbackDelta({ rate: 1, count: undefined, prior: 0.5 })).toBe(0);
    });

    test('反馈优于先验 → 正；劣于先验 → 负（相对先验的差分）', () => {
        const up = feedbackDelta({ rate: 1, count: 5, prior: 0.5 });
        const down = feedbackDelta({ rate: 0, count: 5, prior: 0.5 });
        expect(up).toBeGreaterThan(0);
        expect(down).toBeLessThan(0);
        expect(up).toBeCloseTo(-down);
    });

    test('置信度随样本数上升：同偏离下 count 越大 |delta| 越大', () => {
        const small = feedbackDelta({ rate: 0.9, count: 1, prior: 0.5 });
        const large = feedbackDelta({ rate: 0.9, count: 50, prior: 0.5 });
        expect(large).toBeGreaterThan(small);
        expect(large).toBeLessThanOrEqual((0.9 - 0.5) * FEEDBACK_WEIGHT);
    });

    test('偏离锁定在 [0,1]×weight；上限受 weight 约束', () => {
        const max = feedbackDelta({ rate: 1, count: 1000, prior: 0, priorStrength: FEEDBACK_PRIOR_STRENGTH });
        expect(max).toBeLessThanOrEqual(FEEDBACK_WEIGHT);
    });

    test('非法 rate → 0', () => {
        expect(feedbackDelta({ rate: 'x', count: 5, prior: 0.5 })).toBe(0);
        expect(feedbackDelta({ rate: null, count: 5, prior: 0.5 })).toBe(0);
    });
});
