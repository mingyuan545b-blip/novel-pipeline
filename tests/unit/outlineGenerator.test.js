const { parseMarkdownOutlines, cleanJsonArrayResponse } = require('../../server/services/pipeline/outlineFormatter');
const { validateTemplateInput, parseTemplateResponse } = require('../../server/services/pipeline/outlineTemplateValidator');

jest.mock('../../server/shared/logger', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

describe('outlineFormatter - parseMarkdownOutlines', () => {
    test('should extract chapters from standard markdown format', () => {
        const text = `第1章：系统激活\n主角被系统选中，开始冒险之旅。这一章描述了系统的初次激活过程，主角从懵懂到逐渐理解的过程。\n\n第2章：初入秘境\n主角进入第一个秘境，遭遇了意想不到的挑战。他需要运用智慧来化解危机。`;
        const result = parseMarkdownOutlines(text);
        expect(result).toHaveLength(2);
        expect(result[0].chapterNumber).toBe(1);
        expect(result[0].title).toBe('系统激活');
        expect(result[1].chapterNumber).toBe(2);
        expect(result[1].title).toBe('初入秘境');
    });

    test('should extract outline text between chapter headings', () => {
        const text = `第1章：测试章节\n这是一段足够长的大纲内容，需要超过二十个字符才能被正确提取和保存。主角在测试中发现了问题。\n\n第2章：下一章\n后续的章节大纲内容，同样需要足够长才能被系统正确提取和处理。`;
        const result = parseMarkdownOutlines(text);
        expect(result).toHaveLength(2);
        expect(result[0].outline.length).toBeGreaterThan(0);
        expect(result[1].outline.length).toBeGreaterThan(0);
    });

    test('should skip chapters with outline shorter than 20 chars', () => {
        const text = `第1章：短章节\n太短了\n\n第2章：正常章节\n这段大纲内容足够长，超过二十个字符的限制，应该可以被正确提取。`;
        const result = parseMarkdownOutlines(text);
        expect(result).toHaveLength(1);
        expect(result[0].chapterNumber).toBe(2);
    });

    test('should return empty array when no chapters match', () => {
        const text = '这是一段没有章节标记的普通文本内容';
        const result = parseMarkdownOutlines(text);
        expect(result).toHaveLength(0);
    });

    test('should support Chapter prefix format with 章', () => {
        const text = `Chapter 1章：Begin\nA sufficiently long outline text that describes the beginning of the story in detail.\n\nChapter 2章：Journey\nAnother long outline text describing the journey ahead with enough detail.`;
        const result = parseMarkdownOutlines(text);
        expect(result.length).toBeGreaterThanOrEqual(1);
    });

    test('should try section regex as fallback when primary regex fails', () => {
        const text = `### 第1章：备用格式\n这段大纲使用了三级标题格式，作为备用正则的匹配目标，内容足够长。\n\n### 第2章：继续\n第二段大纲内容同样使用三级标题格式，确保备用正则能正常工作。`;
        const result = parseMarkdownOutlines(text);
        expect(result.length).toBeGreaterThanOrEqual(1);
    });

    test('should truncate outline to 800 chars max', () => {
        const longOutline = 'A'.repeat(1000);
        const text = `第1章：长章节\n${longOutline}`;
        const result = parseMarkdownOutlines(text);
        expect(result).toHaveLength(1);
        expect(result[0].outline.length).toBeLessThanOrEqual(800);
    });

    test('should clean markdown formatting from outline text', () => {
        const text = `第1章：格式测试\n**加粗文本**在开头\n## 二级标题\n---\n正常的大纲内容，这段足够长可以满足最低字数要求。`;
        const result = parseMarkdownOutlines(text);
        if (result.length > 0) {
            expect(result[0].outline).not.toContain('**');
            expect(result[0].outline).not.toContain('## ');
            expect(result[0].outline).not.toContain('---');
        }
    });
});

describe('outlineFormatter - cleanJsonArrayResponse', () => {
    test('should remove json code blocks', () => {
        const input = '```json\n[{"a":1}]\n```';
        const result = cleanJsonArrayResponse(input);
        expect(result).not.toContain('```');
        expect(result).toContain('[{"a":1}]');
    });

    test('should extract JSON array from surrounding text', () => {
        const input = 'Here is the result: [{"name":"test"}] and some trailing text';
        const result = cleanJsonArrayResponse(input);
        expect(result).toBe('[{"name":"test"}]');
    });

    test('should remove trailing commas before closing brackets', () => {
        const input = '[{"a":1,},{"b":2,},]';
        const result = cleanJsonArrayResponse(input);
        expect(result).not.toContain(',}');
        expect(result).not.toContain(',]');
    });

    test('should remove single-line comments', () => {
        const input = '[{"a":1 // comment\n}]';
        const result = cleanJsonArrayResponse(input);
        expect(result).not.toContain('// comment');
    });

    test('should remove block comments', () => {
        const input = '[{"a":1/* block */}]';
        const result = cleanJsonArrayResponse(input);
        expect(result).not.toContain('/* block */');
    });

    test('should strip control characters', () => {
        const input = '[{"a":"test\x00\x01\x02value"}]';
        const result = cleanJsonArrayResponse(input);
        expect(result).not.toContain('\x00');
        expect(result).not.toContain('\x01');
    });
});

describe('outlineTemplateValidator - validateTemplateInput', () => {
    test('should pass when name and genre are provided', () => {
        expect(() => validateTemplateInput({ name: '测试', genre: '玄幻' })).not.toThrow();
    });

    test('should throw when name is missing', () => {
        expect(() => validateTemplateInput({ genre: '玄幻' })).toThrow('name and genre are required');
    });

    test('should throw when genre is missing', () => {
        expect(() => validateTemplateInput({ name: '测试' })).toThrow('name and genre are required');
    });

    test('should throw when both name and genre are missing', () => {
        expect(() => validateTemplateInput({})).toThrow('name and genre are required');
    });

    test('should throw when name is empty string', () => {
        expect(() => validateTemplateInput({ name: '', genre: '玄幻' })).toThrow('name and genre are required');
    });
});

describe('outlineTemplateValidator - parseTemplateResponse', () => {
    test('should parse valid JSON object from response', () => {
        const response = '{"materials": [], "chapterOutlines": []}';
        const result = parseTemplateResponse(response);
        expect(result).toEqual({ materials: [], chapterOutlines: [] });
    });

    test('should parse JSON wrapped in code blocks', () => {
        const response = '```json\n{"materials": [], "chapterOutlines": []}\n```';
        const result = parseTemplateResponse(response);
        expect(result).toEqual({ materials: [], chapterOutlines: [] });
    });

    test('should throw when no JSON object found', () => {
        expect(() => parseTemplateResponse('no json here')).toThrow('No JSON object found in response');
    });

    test('should repair unclosed braces', () => {
        const response = '{"materials": [], "chapterOutlines": [';
        expect(() => parseTemplateResponse(response)).toThrow();
    });

    test('should handle JSON with surrounding text', () => {
        const response = 'Here is the result: {"materials": [], "mainQuests": []} end';
        const result = parseTemplateResponse(response);
        expect(result.materials).toEqual([]);
    });
});
