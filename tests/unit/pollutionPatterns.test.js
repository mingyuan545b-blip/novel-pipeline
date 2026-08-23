const { extractChineseNames, extractSettingKeywords, calcSimilarity, POLLUTION_SEVERITY } = require('../../server/services/pipeline/pollutionPatterns');

describe('pollutionPatterns', () => {
    describe('extractChineseNames', () => {
        test('extracts names from dialogue context', () => {
            const text = '沈默说："我们走。"苏婉清叹了口气。';
            const names = extractChineseNames(text);
            expect(names).toContain('沈默');
            expect(names).toContain('苏婉清');
        });

        test('extracts names from possessive context', () => {
            const text = '他的目光扫过，林远的脚步停了下来。';
            const names = extractChineseNames(text);
            expect(names.some(n => n.includes('林远'))).toBe(true);
        });

        test('returns empty for empty input', () => {
            expect(extractChineseNames('')).toEqual([]);
            expect(extractChineseNames(null)).toEqual([]);
        });

        test('does not extract common words as names', () => {
            const text = '他的目光看向前方，什么也没有。';
            const names = extractChineseNames(text);
            expect(names).not.toContain('他的');
            expect(names).not.toContain('什么');
        });

        test('handles single occurrence name', () => {
            const text = '陈默站了起来。';
            const names = extractChineseNames(text);
            expect(names).toContain('陈默');
        });
    });

    describe('extractSettingKeywords', () => {
        test('extracts occupation keywords', () => {
            const content = '职业：纹身师\n专长：符文雕刻';
            const keywords = extractSettingKeywords(content);
            expect(keywords.length).toBeGreaterThan(0);
        });

        test('extracts role-based keywords', () => {
            const content = '他是一名审计师，负责核查账目';
            const keywords = extractSettingKeywords(content);
            expect(keywords.some(k => k.includes('审计师'))).toBe(true);
        });

        test('returns empty for empty input', () => {
            expect(extractSettingKeywords('')).toEqual([]);
            expect(extractSettingKeywords(null)).toEqual([]);
        });
    });

    describe('calcSimilarity', () => {
        test('returns 1 for identical strings', () => {
            expect(calcSimilarity('hello', 'hello')).toBe(1);
        });

        test('returns 0 for completely different strings', () => {
            expect(calcSimilarity('abc', 'xyz')).toBe(0);
        });

        test('returns partial similarity for overlapping strings', () => {
            const sim = calcSimilarity('沈默是一个清道夫', '沈默是一个审计师');
            expect(sim).toBeGreaterThan(0);
            expect(sim).toBeLessThan(1);
        });
    });

    describe('POLLUTION_SEVERITY', () => {
        test('has required severity levels', () => {
            expect(POLLUTION_SEVERITY.CRITICAL).toBe('CRITICAL');
            expect(POLLUTION_SEVERITY.HIGH).toBe('HIGH');
            expect(POLLUTION_SEVERITY.MEDIUM).toBe('MEDIUM');
        });
    });
});
