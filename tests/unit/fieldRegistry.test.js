/**
 * S5：字段词汇表注册表（R1）—— 生成端/校验端/提取端 同口径
 */
const registry = require('../../server/config/fieldRegistry');
const promptFragments = require('../../server/config/promptFragments');
const { extractLabeledFields } = require('../../server/services/pipeline/characterStateLabeledFields');
const { validateMaterialDepth } = require('../../server/services/materialDepthValidator');

describe('S5 fieldRegistry（单一对齐点）', () => {
    test('别名感知提取：标志性动作 满足 标志性细节 的口径', () => {
        expect(registry.extractFieldWithAliases('【标志性动作】左手旧伤', '标志性细节')).toBe('左手旧伤');
        expect(registry.extractFieldWithAliases('【方言/语感】冷淡', '说话语气')).toBe('冷淡');
        expect(registry.extractFieldWithAliases('【命运弧光】觉醒', '成长弧光')).toBe('觉醒');
    });

    test('P0-B 回归：素材写【标志性动作】不再被判缺【标志性细节】', () => {
        const content = [
            '【身份/职位】账房先生', '【性格】冷静、腹黑、心思缜密', '【说话语气】语气冷淡',
            '【标志性动作】总用左手食指敲桌'
        ].join('\n');
        const r = validateMaterialDepth({ type: 'character', roleLevel: 'npc', currentContent: content });
        expect(r.missing).not.toContain('标志性细节');
    });

    test('生成端 prompt tags 覆盖该校验深度全部必填标签', () => {
        for (const [role, depth] of Object.entries(registry.ROLE_LEVEL_TO_DEPTH)) {
            const advertised = new Set(registry.promptFieldTags(role).map(t => (t.match(/【([^】]+)】/) || [])[1]));
            for (const label of registry.requiredLabels('character', depth)) expect(advertised.has(label)).toBe(true);
        }
    });

    test('promptFragments 会把题材缺失的必填标签补进 prompt', () => {
        const r = promptFragments.resolve('baby');
        expect(r.PROTAGONIST_TAGS).toContain('【标志性细节】');
        expect(r.PROTAGONIST_TAGS).toContain('【身份/职位】');
    });

    test('校验标签与提取正则同口径（映射字段至少一个写法可提取）', () => {
        for (const [label, map] of Object.entries(registry.FIELD_MAPPINGS)) {
            const names = registry.aliasesOf(label);
            const ok = names.some(n => Object.keys(extractLabeledFields(`【${n}】值文本`)).length > 0);
            if (label === '金句库') continue; // 由 characterStateExtractor 单独提取
            expect({ label, mapped: !!map.stateJsonKey, ok }).toMatchObject({ ok: true });
        }
    });

    test('落点映射三方齐全', () => {
        for (const [label, map] of Object.entries(registry.FIELD_MAPPINGS)) {
            expect(map.entityKey).toBeTruthy();
            expect(map.stateJsonKey).toBeTruthy();
        }
    });
});
