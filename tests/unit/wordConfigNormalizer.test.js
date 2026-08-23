/**
 * wordConfig归一化器单元测试
 * 验证5套历史变体都能正确归一化为标准Schema
 */

const { normalizeWordConfig, validateWordConfig } = require('../../server/config/wordConfigNormalizer');
const { WORD_CONFIG_FIELDS } = require('../../server/config/wordConfigSchema');

describe('wordConfigNormalizer', () => {
    describe('normalizeWordConfig - 5套历史变体归一化', () => {
        test('变体A: {minWords, targetWords, maxWords} 标准数据源', () => {
            const input = { minWords: 2500, targetWords: 3000, maxWords: 4000 };
            const result = normalizeWordConfig(input);
            expect(result).toEqual({
                minWords: 2500,
                targetWords: 3000,
                maxWords: 4000,
                rejectMin: 2500 // 缺失时默认等于minWords
            });
        });

        test('变体B: {targetMin, targetMax, rejectMin, maxWords} unifiedConfig期望', () => {
            const input = { targetMin: 2200, targetMax: 2800, rejectMin: 1850, maxWords: 3500 };
            const result = normalizeWordConfig(input);
            expect(result.minWords).toBe(2200);
            expect(result.targetWords).toBe(2800);
            expect(result.rejectMin).toBe(1850);
            expect(result.maxWords).toBe(3500);
        });

        test('变体C: {targetMinWords, targetMaxWords, rejectMinWords, maxChapterWords} genreDefaults', () => {
            const input = { targetMinWords: 2200, targetMaxWords: 2800, rejectMinWords: 1800, maxChapterWords: 3500 };
            const result = normalizeWordConfig(input);
            expect(result.minWords).toBe(2200);
            expect(result.targetWords).toBe(2800);
            expect(result.rejectMin).toBe(1800);
            expect(result.maxWords).toBe(3500);
        });

        test('变体D: {target, rejectMin} 历史数据atomic-1', () => {
            const input = { target: 3000, rejectMin: 1500 };
            const result = normalizeWordConfig(input);
            expect(result.targetWords).toBe(3000);
            expect(result.rejectMin).toBe(1500);
            // 必填字段缺失时用默认值补齐
            expect(result.minWords).toBe(2200);
            expect(result.maxWords).toBe(3500);
        });

        test('变体E: 混合字段名（部分标准+部分历史）', () => {
            const input = { minWords: 2000, targetMax: 3000, maxWords: 4000 };
            const result = normalizeWordConfig(input);
            expect(result.minWords).toBe(2000);
            expect(result.targetWords).toBe(3000); // targetMax → targetWords
            expect(result.maxWords).toBe(4000);
        });
    });

    describe('normalizeWordConfig - 边界场景', () => {
        test('null输入返回null', () => {
            expect(normalizeWordConfig(null)).toBeNull();
        });

        test('undefined输入返回null', () => {
            expect(normalizeWordConfig(undefined)).toBeNull();
        });

        test('空对象返回带默认值的标准Schema', () => {
            const result = normalizeWordConfig({});
            expect(result.minWords).toBe(2200);
            expect(result.targetWords).toBe(2800);
            expect(result.maxWords).toBe(3500);
        });

        test('非数字值被跳过', () => {
            const input = { minWords: 'abc', targetWords: 3000, maxWords: 4000 };
            const result = normalizeWordConfig(input);
            expect(result.minWords).toBe(2200); // 用默认值
            expect(result.targetWords).toBe(3000);
        });

        test('负数被跳过', () => {
            const input = { minWords: -100, targetWords: 3000, maxWords: 4000 };
            const result = normalizeWordConfig(input);
            expect(result.minWords).toBe(2200); // 用默认值
        });

        test('未知字段被跳过', () => {
            const input = { minWords: 2200, targetWords: 2800, maxWords: 3500, unknownField: 999 };
            const result = normalizeWordConfig(input);
            expect(result.unknownField).toBeUndefined();
        });

        test('字符串数字被转换', () => {
            const input = { minWords: '2200', targetWords: '2800', maxWords: '3500' };
            const result = normalizeWordConfig(input);
            expect(result.minWords).toBe(2200);
            expect(result.targetWords).toBe(2800);
            expect(result.maxWords).toBe(3500);
        });
    });

    describe('validateWordConfig', () => {
        test('标准Schema校验通过', () => {
            const config = { minWords: 2200, targetWords: 2800, maxWords: 3500, rejectMin: 1800 };
            const { valid, issues } = validateWordConfig(config);
            expect(valid).toBe(true);
            expect(issues).toHaveLength(0);
        });

        test('缺少必填字段校验失败', () => {
            const config = { minWords: 2200 }; // 缺targetWords和maxWords
            const { valid, issues } = validateWordConfig(config);
            expect(valid).toBe(false);
            expect(issues.length).toBeGreaterThan(0);
        });

        test('minWords > targetWords业务逻辑校验失败', () => {
            const config = { minWords: 3000, targetWords: 2200, maxWords: 3500 };
            const { valid, issues } = validateWordConfig(config);
            expect(valid).toBe(false);
            expect(issues.some(i => i.includes('minWords'))).toBe(true);
        });

        test('存在非标准字段校验失败', () => {
            const config = { minWords: 2200, targetWords: 2800, maxWords: 3500, unknownField: 999 };
            const { valid, issues } = validateWordConfig(config);
            expect(valid).toBe(false);
            expect(issues.some(i => i.includes('unknownField'))).toBe(true);
        });
    });

    describe('WORD_CONFIG_FIELDS 常量', () => {
        test('标准字段名不可变（Object.freeze）', () => {
            // Object.freeze在strict mode下抛错，非strict mode下静默失败
            // 验证freeze生效：修改后值不变
            const original = WORD_CONFIG_FIELDS.MIN_WORDS;
            try {
                WORD_CONFIG_FIELDS.MIN_WORDS = 'changed';
            } catch (e) { /* strict mode抛TypeError */ }
            expect(WORD_CONFIG_FIELDS.MIN_WORDS).toBe(original);
        });

        test('包含4个标准字段', () => {
            expect(Object.keys(WORD_CONFIG_FIELDS)).toHaveLength(4);
            expect(WORD_CONFIG_FIELDS.MIN_WORDS).toBe('minWords');
            expect(WORD_CONFIG_FIELDS.TARGET_WORDS).toBe('targetWords');
            expect(WORD_CONFIG_FIELDS.MAX_WORDS).toBe('maxWords');
            expect(WORD_CONFIG_FIELDS.REJECT_MIN).toBe('rejectMin');
        });
    });
});
