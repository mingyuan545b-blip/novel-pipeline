/**
 * styleProfile归一化器单元测试
 * 验证字段名变体归一化和约束字段补齐
 */

const { normalizeStyleProfile, validateStyleProfile } = require('../../server/config/styleProfileNormalizer');
const { STYLE_PROFILE_FIELDS, CONSTRAINT_FIELDS } = require('../../server/config/styleProfileSchema');

describe('styleProfileNormalizer', () => {
    describe('normalizeStyleProfile - 字段名兼容', () => {
        test('标准字段名直接保留', () => {
            const input = {
                key: 'test', genre: '玄幻', genreProfile: '玄幻',
                style: '热血', tone: '激昂', pov: '第三人称'
            };
            const result = normalizeStyleProfile(input);
            expect(result.key).toBe('test');
            expect(result.genre).toBe('玄幻');
            expect(result.style).toBe('热血');
        });

        test('历史字段名genreId映射为genreProfile', () => {
            const input = { genreId: 'test-profile' };
            const result = normalizeStyleProfile(input);
            expect(result.genreProfile).toBe('test-profile');
        });

        test('缺失约束字段时用默认值补齐', () => {
            const input = { key: 'test', genre: '玄幻', genreProfile: '玄幻' };
            const result = normalizeStyleProfile(input);
            // 7个约束字段都应补齐
            for (const field of CONSTRAINT_FIELDS) {
                expect(result[field]).toBeDefined();
            }
            expect(result[STYLE_PROFILE_FIELDS.POV_RULE]).toBe('');
            expect(result[STYLE_PROFILE_FIELDS.DIALOGUE_RULE]).toBe('');
        });

        test('outlineMaterialSaver变体（缺失约束字段）归一化后补齐', () => {
            // 模拟outlineMaterialSaver生成的styleProfile（缺失povRule等7个字段）
            const input = {
                key: 'profile1', genre: '都市', genreProfile: '都市',
                style: '轻松', tone: '幽默', pov: '第三人称',
                namingStyle: '现代', namingStyleIntensity: 'medium'
            };
            const result = normalizeStyleProfile(input);
            expect(result.povRule).toBe('');
            expect(result.dialogueRule).toBe('');
            expect(result.behaviorRule).toBe('');
            expect(result.toneRule).toBe('');
            expect(result.characterRefRules).toBe('');
            expect(result.narrativeDistance).toBe('');
            expect(result.titleRule).toBe('');
        });
    });

    describe('normalizeStyleProfile - 边界场景', () => {
        test('null输入返回null', () => {
            expect(normalizeStyleProfile(null)).toBeNull();
        });

        test('undefined输入返回null', () => {
            expect(normalizeStyleProfile(undefined)).toBeNull();
        });

        test('空对象返回带默认值的标准Schema', () => {
            const result = normalizeStyleProfile({});
            expect(result.key).toBe('');
            expect(result.genre).toBe('');
            expect(result.povRule).toBe('');
        });

        test('未知字段被跳过', () => {
            const input = { key: 'test', unknownField: 999 };
            const result = normalizeStyleProfile(input);
            expect(result.unknownField).toBeUndefined();
        });
    });

    describe('validateStyleProfile', () => {
        test('完整Schema校验通过', () => {
            const profile = normalizeStyleProfile({
                key: 'test', genre: '玄幻', genreProfile: '玄幻',
                style: '热血', tone: '激昂', pov: '第三人称'
            });
            const { valid, issues } = validateStyleProfile(profile);
            expect(valid).toBe(true);
            expect(issues).toHaveLength(0);
        });

        test('缺少必填字段校验失败', () => {
            const profile = { povRule: 'test' }; // 缺key/genre等必填字段
            const { valid, issues } = validateStyleProfile(profile);
            expect(valid).toBe(false);
            expect(issues.length).toBeGreaterThan(0);
        });

        test('缺少约束字段校验失败', () => {
            const profile = {
                key: 'test', genre: '玄幻', genreProfile: '玄幻',
                style: '热血', tone: '激昂', pov: '第三人称'
                // 缺少7个约束字段
            };
            const { valid, issues } = validateStyleProfile(profile);
            expect(valid).toBe(false);
            expect(issues.some(i => i.includes('povRule'))).toBe(true);
        });
    });
});
