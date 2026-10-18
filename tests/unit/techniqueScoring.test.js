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
