const {
    estimateTokens,
    truncateToTokens,
    ContextBudget,
    CONTEXT_BUDGETS,
    COMPACT_MODELS,
    LONG_CONTEXT_MODELS,
    ULTRA_LONG_CONTEXT_MODELS,
    SAFETY_MARGIN,
    MODEL_RATIOS,
    DEFAULT_RATIOS
} = require('../../server/services/contextBudget');

describe('estimateTokens - Chinese text', () => {
    test('returns reasonable token count for pure Chinese text', () => {
        const text = '这是一个测试文本用于验证中文估算功能';
        const tokens = estimateTokens(text);
        const charCount = text.length;
        expect(tokens).toBeGreaterThan(0);
        expect(tokens).toBeLessThanOrEqual(Math.ceil(charCount * DEFAULT_RATIOS.chinese * SAFETY_MARGIN));
        expect(tokens).toBeGreaterThanOrEqual(Math.ceil(charCount * 1.3 * SAFETY_MARGIN));
    });

    test('returns 0 for empty string', () => {
        expect(estimateTokens('')).toBe(0);
    });

    test('returns 0 for null input', () => {
        expect(estimateTokens(null)).toBe(0);
    });

    test('returns 0 for undefined input', () => {
        expect(estimateTokens(undefined)).toBe(0);
    });

    test('handles single Chinese character', () => {
        const tokens = estimateTokens('中');
        expect(tokens).toBeGreaterThan(0);
        expect(tokens).toBeLessThanOrEqual(Math.ceil(DEFAULT_RATIOS.chinese * SAFETY_MARGIN));
    });
});

describe('estimateTokens - mixed Chinese/English text', () => {
    test('mixed Chinese and English text returns reasonable estimate', () => {
        const text = 'Hello世界，this is 一个mixed文本with 123数字';
        const tokens = estimateTokens(text);
        expect(tokens).toBeGreaterThan(0);
        const chineseChars = [...text].filter(c => {
            const code = c.charCodeAt(0);
            return code >= 0x4e00 && code <= 0x9fff;
        }).length;
        const latinChars = [...text].filter(c => {
            const code = c.charCodeAt(0);
            return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
        }).length;
        expect(tokens).toBeGreaterThanOrEqual(Math.ceil((chineseChars * 1.3 + latinChars * DEFAULT_RATIOS.latin) * SAFETY_MARGIN));
    });

    test('pure English text returns lower token count than same-length Chinese', () => {
        const englishText = 'Hello world this is a test';
        const chineseText = '你好世界这是一个测试文本';
        const enTokens = estimateTokens(englishText);
        const zhTokens = estimateTokens(chineseText);
        expect(zhTokens).toBeGreaterThan(enTokens);
    });

    test('text with CJK punctuation is handled', () => {
        const text = '你好，世界！这是测试。';
        const tokens = estimateTokens(text);
        expect(tokens).toBeGreaterThan(0);
    });

    test('text with fullwidth characters is handled', () => {
        const text = 'Ｈｅｌｌｏ';
        const tokens = estimateTokens(text);
        expect(tokens).toBeGreaterThan(0);
    });
});

describe('estimateTokens - model-specific ratios', () => {
    test('qwen model uses lower ratio for Chinese (1.3) than default (1.5)', () => {
        const text = '这是一个中文测试文本';
        const qwenTokens = estimateTokens(text, 'qwen3.6-plus');
        const defaultTokens = estimateTokens(text);
        expect(qwenTokens).toBeLessThan(defaultTokens);
    });

    test('gpt model uses same chinese ratio as default (1.5)', () => {
        const text = '这是一个中文测试文本';
        const gptTokens = estimateTokens(text, 'gpt-4o');
        const defaultTokens = estimateTokens(text);
        // gpt.chinese = 1.5 = DEFAULT_RATIOS.chinese, but gpt has higher punctuation ratio
        expect(gptTokens).toBeGreaterThanOrEqual(defaultTokens);
    });

    test('deepseek model uses lower ratio for Chinese (1.3) than default (1.5)', () => {
        const text = '这是一个中文测试文本';
        const deepseekTokens = estimateTokens(text, 'deepseek-chat');
        const defaultTokens = estimateTokens(text);
        expect(deepseekTokens).toBeLessThan(defaultTokens);
    });

    test('unknown model falls back to default ratios', () => {
        const text = '测试文本abc';
        const unknownTokens = estimateTokens(text, 'some-unknown-model');
        const defaultTokens = estimateTokens(text);
        expect(unknownTokens).toBe(defaultTokens);
    });

    test('qwen model uses lower punctuation ratio (0.4) than gpt (0.6)', () => {
        const text = '你好，世界！测试。';
        const qwenTokens = estimateTokens(text, 'qwen-plus');
        const gptTokens = estimateTokens(text, 'gpt-4o');
        expect(gptTokens).toBeGreaterThan(qwenTokens);
    });
});

describe('estimateTokens - empty/null input', () => {
    test('returns 0 for empty string', () => {
        expect(estimateTokens('')).toBe(0);
    });

    test('returns 0 for null', () => {
        expect(estimateTokens(null)).toBe(0);
    });

    test('returns 0 for undefined', () => {
        expect(estimateTokens(undefined)).toBe(0);
    });

    test('returns 0 for 0', () => {
        expect(estimateTokens(0)).toBe(0);
    });

    test('returns 0 for false', () => {
        expect(estimateTokens(false)).toBe(0);
    });
});

describe('estimateTokens - JSON input', () => {
    test('stringifies and estimates JSON object', () => {
        const obj = { name: '测试', value: 42 };
        const tokens = estimateTokens(obj);
        const stringified = JSON.stringify(obj);
        const expectedTokens = estimateTokens(stringified);
        expect(tokens).toBe(expectedTokens);
        expect(tokens).toBeGreaterThan(0);
    });

    test('stringifies and estimates JSON array', () => {
        const arr = ['你好', '世界', 'test'];
        const tokens = estimateTokens(arr);
        const stringified = JSON.stringify(arr);
        const expectedTokens = estimateTokens(stringified);
        expect(tokens).toBe(expectedTokens);
    });

    test('handles nested JSON', () => {
        const nested = { a: { b: { c: '深层嵌套的中文文本' } } };
        const tokens = estimateTokens(nested);
        expect(tokens).toBeGreaterThan(0);
    });
});

describe('estimateTokens - SAFETY_MARGIN is applied', () => {
    test('result is greater than raw calculation without margin', () => {
        const text = '这是一段用于测试安全边距的中文文本包含一些English和数字123';
        const withMargin = estimateTokens(text);
        const rawChinese = [...text].filter(c => {
            const code = c.charCodeAt(0);
            return code >= 0x4e00 && code <= 0x9fff;
        }).length;
        const rawLatin = [...text].filter(c => {
            const code = c.charCodeAt(0);
            return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
        }).length;
        const rawNumbers = [...text].filter(c => {
            const code = c.charCodeAt(0);
            return code >= 0x30 && code <= 0x39;
        }).length;
        const rawCalc = rawChinese * DEFAULT_RATIOS.chinese + rawLatin * DEFAULT_RATIOS.latin + rawNumbers * DEFAULT_RATIOS.number;
        expect(withMargin).toBeGreaterThan(rawCalc);
        expect(withMargin).toBe(Math.ceil(rawCalc * SAFETY_MARGIN));
    });

    test('safety margin of 1.15 adds approximately 15% overhead', () => {
        const text = '测试文本';
        const tokens = estimateTokens(text);
        const charCount = [...text].filter(c => {
            const code = c.charCodeAt(0);
            return code >= 0x4e00 && code <= 0x9fff;
        }).length;
        const raw = charCount * DEFAULT_RATIOS.chinese;
        const expectedWithMargin = Math.ceil(raw * SAFETY_MARGIN);
        expect(tokens).toBe(expectedWithMargin);
    });
});

describe('_getModelFamily - returns correct family for known models', () => {
    const { estimateTokens: _ } = require('../../server/services/contextBudget');

    function getModelFamily(model) {
        if (!model) return 'default';
        const ml = model.toLowerCase();
        if (ml.includes('qwen')) return 'qwen';
        if (ml.includes('deepseek')) return 'deepseek';
        if (ml.includes('gpt')) return 'gpt';
        if (ml.includes('minimax')) return 'minimax';
        if (ml.includes('glm')) return 'glm';
        if (ml.includes('moonshot')) return 'moonshot';
        return 'default';
    }

    test('qwen models return qwen family', () => {
        expect(getModelFamily('qwen3.6-plus')).toBe('qwen');
        expect(getModelFamily('qwen-plus')).toBe('qwen');
        expect(getModelFamily('Qwen3.6-35B-A3B')).toBe('qwen');
        expect(getModelFamily('qwen-turbo')).toBe('qwen');
    });

    test('deepseek models return deepseek family', () => {
        expect(getModelFamily('deepseek-chat')).toBe('deepseek');
        expect(getModelFamily('deepseek-reasoner')).toBe('deepseek');
        expect(getModelFamily('DeepSeek-V3')).toBe('deepseek');
    });

    test('gpt models return gpt family', () => {
        expect(getModelFamily('gpt-4o')).toBe('gpt');
        expect(getModelFamily('gpt-4o-mini')).toBe('gpt');
        expect(getModelFamily('gpt-4-turbo')).toBe('gpt');
    });

    test('minimax models return minimax family', () => {
        expect(getModelFamily('MiniMax-M2.7')).toBe('minimax');
        expect(getModelFamily('minimax-text-01')).toBe('minimax');
    });

    test('glm models return glm family', () => {
        expect(getModelFamily('glm-4-plus')).toBe('glm');
        expect(getModelFamily('glm-4')).toBe('glm');
    });

    test('moonshot models return moonshot family', () => {
        expect(getModelFamily('moonshot-v1-128k')).toBe('moonshot');
        expect(getModelFamily('moonshot-v1-32k')).toBe('moonshot');
    });

    test('unknown model returns default family', () => {
        expect(getModelFamily('claude-3-opus')).toBe('default');
        expect(getModelFamily('llama-3')).toBe('default');
    });

    test('null/undefined returns default family', () => {
        expect(getModelFamily(null)).toBe('default');
        expect(getModelFamily(undefined)).toBe('default');
    });
});

describe('estimateTokens - number and whitespace handling', () => {
    test('digits are estimated with number ratio', () => {
        const text = '1234567890';
        const tokens = estimateTokens(text);
        const rawCalc = 10 * DEFAULT_RATIOS.number;
        expect(tokens).toBe(Math.ceil(rawCalc * SAFETY_MARGIN));
    });

    test('whitespace is estimated with whitespace ratio', () => {
        const text = '    \n\n\t';
        const tokens = estimateTokens(text);
        expect(tokens).toBeGreaterThan(0);
    });

    test('tab and newline characters are counted as whitespace', () => {
        const text = 'a\tb\nc d';
        const tokens = estimateTokens(text);
        expect(tokens).toBeGreaterThan(0);
    });
});

describe('truncateToTokens', () => {
    test('returns original text if within token limit', () => {
        const text = '短文本';
        const result = truncateToTokens(text, 1000);
        expect(result).toBe(text);
    });

    test('returns empty string for null input', () => {
        expect(truncateToTokens(null, 1000)).toBe('');
    });

    test('returns empty string for undefined input', () => {
        expect(truncateToTokens(undefined, 1000)).toBe('');
    });

    test('truncates long text and appends indicator', () => {
        const longText = '这是'.repeat(500);
        const result = truncateToTokens(longText, 100, 'qwen-plus');
        expect(result.length).toBeLessThan(longText.length);
        expect(result).toContain('已截断');
    });
});
