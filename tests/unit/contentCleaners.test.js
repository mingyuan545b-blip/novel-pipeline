/**
 * contentCleaners.test.js
 * 覆盖 calcNgramOverlap, normalizeForDedup, deduplicateContent,
 * truncateChapter, splitLongParagraphs, cleanFinalContent,
 * cleanChapterContent, ensureCliffhanger
 */
const {
    calcNgramOverlap, normalizeForDedup, deduplicateContent,
    truncateChapter, splitLongParagraphs, cleanFinalContent,
    cleanChapterContent, ensureCliffhanger
} = require('../../server/services/contentCleaners');

describe('contentCleaners', () => {
    describe('calcNgramOverlap', () => {
        test('returns 0 for short strings', () => {
            expect(calcNgramOverlap('ab', 'cd')).toBe(0);
        });
        test('returns 1 for identical strings', () => {
            expect(calcNgramOverlap('这是一段测试文字', '这是一段测试文字')).toBe(1);
        });
        test('returns 0 for completely different strings', () => {
            expect(calcNgramOverlap('一二三四五六七八九', 'abcdefghij')).toBe(0);
        });
        test('returns partial overlap', () => {
            const overlap = calcNgramOverlap('测试文字内容一', '测试文字内容二');
            expect(overlap).toBeGreaterThan(0);
            expect(overlap).toBeLessThan(1);
        });
    });

    describe('normalizeForDedup', () => {
        test('removes punctuation and whitespace', () => {
            const result = normalizeForDedup('你好，世界！测试。');
            expect(result).not.toMatch(/[，。！]/);
        });
        test('removes time expressions', () => {
            const result = normalizeForDedup('第一天早上他出发了');
            expect(result).not.toContain('第一天');
            expect(result).not.toContain('早上');
        });
        test('converts to lowercase', () => {
            const result = normalizeForDedup('ABC测试');
            expect(result).toBe(result.toLowerCase());
        });
    });

    describe('deduplicateContent', () => {
        test('handles null/empty input', () => {
            expect(deduplicateContent(null).content).toBe('');
            expect(deduplicateContent('').content).toBe('');
        });
        test('handles non-string input', () => {
            const result = deduplicateContent(123);
            expect(result.content).toBe('123');
        });
        test('removes duplicate paragraphs', () => {
            const para = '这是一段文字内容测试去重功能。需要足够长的文字才能触发。';
            const content = para + '\n\n中间段落。\n\n' + para;
            const result = deduplicateContent(content);
            expect(result.removed).toBeGreaterThanOrEqual(0);
        });
        test('keeps unique paragraphs', () => {
            const content = '第一段独特内容。\n\n第二段独特内容。\n\n第三段独特内容。';
            const result = deduplicateContent(content);
            expect(result.removed).toBe(0);
        });
        test('handles short content', () => {
            const result = deduplicateContent('短');
            expect(result.content).toBe('短');
        });
    });

    describe('truncateChapter', () => {
        test('returns content as-is when within limit', () => {
            const content = '短内容';
            const result = truncateChapter(content, 1000);
            expect(result.content).toBe(content);
        });
        test('truncates when exceeding limit', () => {
            const longContent = Array(20).fill('这是一段很长的段落内容，用来测试截断功能。').join('\n\n');
            const result = truncateChapter(longContent, 200);
            expect(result.content.length).toBeLessThanOrEqual(250);
        });
        test('adds ellipsis when truncated mid-sentence', () => {
            const longContent = Array(20).fill('这是一段很长的段落内容，用来测试截断功能。').join('\n\n');
            const result = truncateChapter(longContent, 200);
            expect(result.content).toMatch(/……$|。$/);
        });
    });

    describe('splitLongParagraphs', () => {
        test('handles null/empty', () => {
            expect(splitLongParagraphs(null)).toBeNull();
            expect(splitLongParagraphs('')).toBe('');
        });
        test('keeps short paragraphs intact', () => {
            const content = '短段落。';
            expect(splitLongParagraphs(content)).toBe(content);
        });
        test('splits long paragraphs by sentences', () => {
            const longPara = Array(10).fill('这是一句话。').join('');
            const result = splitLongParagraphs(longPara, 30);
            const paragraphs = result.split('\n\n');
            expect(paragraphs.length).toBeGreaterThan(1);
        });
    });

    describe('cleanFinalContent', () => {
        test('handles null/empty', () => {
            expect(cleanFinalContent(null)).toBe('');
            expect(cleanFinalContent('')).toBe('');
        });
        test('handles non-string input', () => {
            expect(cleanFinalContent(42)).toBe('42');
        });
        test('removes chapter headers', () => {
            expect(cleanFinalContent('# 第1章 测试\n\n正文')).not.toContain('# 第1章');
        });
        test('removes hook/foreshadow tags', () => {
            const result = cleanFinalContent('正文内容\n\n【钩子】下章预告内容\n\n');
            expect(result).not.toContain('【钩子】');
        });
        test('normalizes multiple newlines', () => {
            const result = cleanFinalContent('段落1\n\n\n\n段落2');
            expect(result).not.toMatch(/\n{3,}/);
        });
    });

    describe('cleanChapterContent', () => {
        test('handles null/empty', () => {
            expect(cleanChapterContent(null)).toBe('');
            expect(cleanChapterContent('')).toBe('');
        });
        test('handles non-string input', () => {
            expect(cleanChapterContent({})).toBe('[object Object]');
        });
        test('removes think tags', () => {
            const result = cleanChapterContent('正文<think思考过程</think后续');
            expect(result).toBeDefined();
        });
        test('removes code blocks', () => {
            const result = cleanChapterContent('正文```代码块```后续');
            expect(result).not.toContain('```');
        });
        test('removes game UI elements', () => {
            expect(cleanChapterContent('正文[权限终端]选择')).not.toContain('[权限终端]');
            expect(cleanChapterContent('正文[道具：钥匙]获得')).not.toContain('[道具');
        });
        test('removes analysis patterns', () => {
            const result = cleanChapterContent('让我分析一下：这段文字');
            expect(result).not.toContain('让我分析');
        });
    });

    describe('ensureCliffhanger', () => {
        test('handles null/empty', () => {
            expect(ensureCliffhanger(null)).toBeNull();
            expect(ensureCliffhanger('')).toBe('');
        });
        test('adds ellipsis when no ending punctuation', () => {
            expect(ensureCliffhanger('他走进了黑暗')).toBe('他走进了黑暗……');
        });
        test('keeps content with ending punctuation', () => {
            expect(ensureCliffhanger('他走进了黑暗。')).toBe('他走进了黑暗。');
        });
        test('recognizes various ending chars', () => {
            expect(ensureCliffhanger('什么！')).toBe('什么！');
            expect(ensureCliffhanger('真的？')).toBe('真的？');
            expect(ensureCliffhanger('继续……')).toBe('继续……');
        });
    });
});
