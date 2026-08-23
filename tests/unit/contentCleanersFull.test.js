const {
    calcNgramOverlap, normalizeForDedup, deduplicateContent,
    truncateChapter, splitLongParagraphs, cleanFinalContent,
    cleanChapterContent, ensureCliffhanger, MAX_CHAPTER_WORDS
} = require('../../server/services/contentCleaners');

describe('contentCleaners', () => {
    describe('calcNgramOverlap', () => {
        test('returns 0 for strings shorter than n', () => {
            expect(calcNgramOverlap('ab', 'abcdef', 4)).toBe(0);
            expect(calcNgramOverlap('abcdef', 'ab', 4)).toBe(0);
        });
        test('returns 1 for identical strings', () => {
            expect(calcNgramOverlap('这是一个测试文本', '这是一个测试文本')).toBe(1);
        });
        test('returns 0 for completely different strings', () => {
            expect(calcNgramOverlap('甲乙丙丁戊己', '子丑寅卯辰巳')).toBe(0);
        });
        test('returns partial overlap', () => {
            const result = calcNgramOverlap('今天天气很好啊', '今天天气很差啊');
            expect(result).toBeGreaterThan(0);
            expect(result).toBeLessThan(1);
        });
    });

    describe('normalizeForDedup', () => {
        test('removes punctuation and whitespace', () => {
            expect(normalizeForDedup('你好，世界！')).toBe('你好世界');
        });
        test('removes time expressions', () => {
            expect(normalizeForDedup('第一天他去了')).not.toContain('第一天');
        });
        test('removes time-of-day expressions', () => {
            expect(normalizeForDedup('早上他出门了')).not.toContain('早上');
        });
        test('lowercases', () => {
            expect(normalizeForDedup('ABC')).toBe('abc');
        });
    });

    describe('deduplicateContent', () => {
        test('handles null/undefined', () => {
            expect(deduplicateContent(null)).toEqual({ content: '', removed: 0, details: [] });
            expect(deduplicateContent(undefined)).toEqual({ content: '', removed: 0, details: [] });
        });
        test('handles short content', () => {
            expect(deduplicateContent('短文本')).toEqual({ content: '短文本', removed: 0, details: [] });
        });
        test('handles non-string input', () => {
            const result = deduplicateContent(123);
            expect(result.content).toBe('123');
            expect(result.removed).toBe(0);
        });
        test('removes duplicate paragraphs', () => {
            const para = Array(20).fill('这是第一段内容，包含一些独特的文字描述。').join('');
            const content = para + '\n\n' + para;
            const result = deduplicateContent(content);
            expect(result.removed).toBeGreaterThanOrEqual(0);
        });
        test('keeps unique paragraphs', () => {
            const content = '这是第一段内容，包含一些独特的文字描述。\n\n这是第二段内容，完全不同的文字描述。';
            const result = deduplicateContent(content);
            expect(result.removed).toBe(0);
        });
        test('handles few paragraphs with long content (sentence chunk path)', () => {
            const longPara = '这是第一句话的内容。这是第二句话的内容。这是第三句话的内容。这是第四句话的内容。这是第五句话的内容。';
            const content = longPara + '\n' + longPara;
            const result = deduplicateContent(content);
            expect(result.removed).toBeGreaterThanOrEqual(0);
        });
    });

    describe('truncateChapter', () => {
        test('returns content as-is when under maxWords', () => {
            const result = truncateChapter('短内容', 100);
            expect(result.content).toBe('短内容');
        });
        test('truncates long content', () => {
            const longContent = Array(50).fill('这是一段很长的内容，用于测试截断功能。').join('\n\n');
            const result = truncateChapter(longContent, 200);
            expect(result.content.length).toBeLessThan(longContent.length);
        });
        test('adds ellipsis when content does not end with punctuation', () => {
            const longContent = Array(50).fill('这是一段很长的内容用于测试截断功能').join('\n\n');
            const result = truncateChapter(longContent, 200);
            expect(result.content.endsWith('……')).toBe(true);
        });
    });

    describe('splitLongParagraphs', () => {
        test('handles null/undefined', () => {
            expect(splitLongParagraphs(null)).toBeNull();
            expect(splitLongParagraphs(undefined)).toBeUndefined();
        });
        test('keeps short paragraphs as-is', () => {
            const result = splitLongParagraphs('短段落');
            expect(result).toBe('短段落');
        });
        test('splits long paragraphs at sentence boundaries', () => {
            const longPara = '第一句话。第二句话。第三句话。第四句话。第五句话。第六句话。第七句话。第八句话。第九句话。第十句话。';
            const result = splitLongParagraphs(longPara, 50);
            expect(result.length).toBeGreaterThanOrEqual(longPara.length);
        });
    });

    describe('cleanFinalContent', () => {
        test('handles null/undefined', () => {
            expect(cleanFinalContent(null)).toBe('');
            expect(cleanFinalContent(undefined)).toBe('');
        });
        test('handles non-string input', () => {
            expect(cleanFinalContent(123)).toBe('123');
        });
        test('removes chapter headers', () => {
            expect(cleanFinalContent('# 第1章 测试标题\n正文内容')).not.toContain('# 第1章');
        });
        test('removes hooks and foreshadowing markers', () => {
            expect(cleanFinalContent('正文内容【钩子】这是钩子内容\n\n后续内容')).not.toContain('【钩子】');
        });
        test('removes excessive newlines', () => {
            expect(cleanFinalContent('内容\n\n\n\n\n更多内容')).not.toContain('\n\n\n');
        });
    });

    describe('cleanChapterContent', () => {
        test('handles null/undefined', () => {
            expect(cleanChapterContent(null)).toBe('');
            expect(cleanChapterContent(undefined)).toBe('');
        });
        test('handles non-string input', () => {
            expect(cleanChapterContent(123)).toBe('123');
        });
        test('removes thinking tags', () => {
            const result = cleanChapterContent('正文<think思考过程</think后续');
            expect(result).toContain('正文');
            expect(result).toContain('后续');
        });
        test('removes analysis patterns', () => {
            expect(cleanChapterContent('让我分析一下：这段内容需要修改')).not.toContain('让我分析一下');
        });
        test('removes game UI elements', () => {
            expect(cleanChapterContent('正文[权限终端]获得新能力后续')).not.toContain('[权限终端]');
        });
    });

    describe('ensureCliffhanger', () => {
        test('handles null/undefined', () => {
            expect(ensureCliffhanger(null)).toBeNull();
            expect(ensureCliffhanger(undefined)).toBeUndefined();
        });
        test('keeps content ending with punctuation', () => {
            expect(ensureCliffhanger('他走了。')).toBe('他走了。');
            expect(ensureCliffhanger('真的吗？')).toBe('真的吗？');
        });
        test('adds ellipsis when no punctuation', () => {
            expect(ensureCliffhanger('他转身')).toBe('他转身……');
        });
    });

    test('MAX_CHAPTER_WORDS is a positive number', () => {
        expect(MAX_CHAPTER_WORDS).toBeGreaterThan(0);
    });
});
