/**
 * chapterIntentsNormalizer 单元测试
 */
const { normalizeChapterIntents, validateChapterIntents } = require('../../server/config/chapterIntentsNormalizer');

describe('chapterIntentsNormalizer', () => {
    describe('normalizeChapterIntents', () => {
        test('null/undefined应返回默认结构', () => {
            const result = normalizeChapterIntents(null);
            expect(result).toEqual({ chapters: {} });
        });

        test('非对象类型应返回默认结构', () => {
            const result = normalizeChapterIntents('invalid');
            expect(result).toEqual({ chapters: {} });
        });

        test('chapters为数组时应转换为对象', () => {
            const input = {
                chapters: [
                    { chapter: 1, goal: '第一章目标' },
                    { chapter: 2, goal: '第二章目标' },
                ]
            };
            const result = normalizeChapterIntents(input);
            expect(result.chapters).toHaveProperty('chapter-0001');
            expect(result.chapters).toHaveProperty('chapter-0002');
            expect(result.chapters['chapter-0001'].goal).toBe('第一章目标');
        });

        test('chapters为对象时应原样保留', () => {
            const input = {
                chapters: {
                    'chapter-0001': { chapter: 1, goal: '目标' }
                }
            };
            const result = normalizeChapterIntents(input);
            expect(result.chapters['chapter-0001'].goal).toBe('目标');
        });

        test('chapters为非对象非数组时应重置为空对象', () => {
            const input = { chapters: 'invalid' };
            const result = normalizeChapterIntents(input);
            expect(result.chapters).toEqual({});
        });

        test('数组转换时chapter字段缺失的项应被跳过', () => {
            const input = {
                chapters: [
                    { chapter: 1, goal: '有chapter' },
                    { goal: '无chapter' },
                    null,
                ]
            };
            const result = normalizeChapterIntents(input);
            expect(Object.keys(result.chapters)).toHaveLength(1);
            expect(result.chapters).toHaveProperty('chapter-0001');
        });
    });

    describe('validateChapterIntents', () => {
        test('合规结构应通过校验', () => {
            const input = {
                chapters: {
                    'chapter-0001': { chapter: 1, goal: '目标' }
                }
            };
            const result = validateChapterIntents(input);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('chapters为数组应报错', () => {
            const input = { chapters: [] };
            const result = validateChapterIntents(input);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('不能为数组');
        });

        test('章节key格式错误应报错', () => {
            const input = {
                chapters: {
                    'chapter-1': { chapter: 1, goal: '目标' }
                }
            };
            const result = validateChapterIntents(input);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('chapter-XXXX');
        });

        test('缺少必填字段应报错', () => {
            const input = {
                chapters: {
                    'chapter-0001': { chapter: 1 }
                }
            };
            const result = validateChapterIntents(input);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('goal'))).toBe(true);
        });

        test('null输入应报错', () => {
            const result = validateChapterIntents(null);
            expect(result.valid).toBe(false);
        });
    });
});
