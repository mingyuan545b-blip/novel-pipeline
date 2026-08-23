/**
 * targetChapters归一化器单元测试
 * 验证targetChapters和targetChapterCount两个字段名都能正确归一化
 */

const { normalizeTargetChapters } = require('../../server/config/targetChaptersNormalizer');

describe('targetChaptersNormalizer', () => {
    describe('normalizeTargetChapters - 字段名兼容', () => {
        test('标准字段名targetChapters', () => {
            const project = { targetChapters: 50 };
            expect(normalizeTargetChapters(project)).toBe(50);
        });

        test('历史字段名targetChapterCount', () => {
            const project = { targetChapterCount: 30 };
            expect(normalizeTargetChapters(project)).toBe(30);
        });

        test('两个字段同时存在时优先targetChapters', () => {
            const project = { targetChapters: 50, targetChapterCount: 30 };
            expect(normalizeTargetChapters(project)).toBe(50);
        });

        test('targetChapters=0是合法值', () => {
            const project = { targetChapters: 0 };
            expect(normalizeTargetChapters(project)).toBe(0);
        });
    });

    describe('normalizeTargetChapters - 边界场景', () => {
        test('null输入返回默认值', () => {
            expect(normalizeTargetChapters(null)).toBe(100);
        });

        test('undefined输入返回默认值', () => {
            expect(normalizeTargetChapters(undefined)).toBe(100);
        });

        test('空对象返回默认值', () => {
            expect(normalizeTargetChapters({})).toBe(100);
        });

        test('字符串数字被转换', () => {
            const project = { targetChapters: '50' };
            expect(normalizeTargetChapters(project)).toBe(50);
        });

        test('负数返回默认值', () => {
            const project = { targetChapters: -10 };
            expect(normalizeTargetChapters(project)).toBe(100);
        });

        test('非数字字符串返回默认值', () => {
            const project = { targetChapters: 'abc' };
            expect(normalizeTargetChapters(project)).toBe(100);
        });
    });
});
