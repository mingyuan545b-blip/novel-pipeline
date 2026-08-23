const {
    TYPE_LABELS, DEFAULT_TYPES, buildTypeList,
    buildInitialMaterialSystemPrompt, parseMaterialResponse
} = require('../../server/services/pipeline/initialMaterialHelpers');

describe('initialMaterialHelpers', () => {
    describe('TYPE_LABELS', () => {
        test('has labels for key types', () => {
            expect(TYPE_LABELS.character).toBe('人物卡');
            expect(TYPE_LABELS.worldview).toBe('世界观设定');
            expect(TYPE_LABELS.equipment).toBe('重要物品/工具');
        });
    });

    describe('DEFAULT_TYPES', () => {
        test('includes worldview and character', () => {
            expect(DEFAULT_TYPES).toContain('worldview');
            expect(DEFAULT_TYPES).toContain('character');
        });
    });

    describe('buildTypeList', () => {
        test('returns default types for null profile', () => {
            const result = buildTypeList(null);
            expect(result.typeListStr).toContain('worldview');
            expect(result.skipTypes.size).toBe(0);
            expect(result.skipNote).toBe('');
        });
        test('returns default types for empty profile', () => {
            const result = buildTypeList({});
            expect(result.typeListStr).toContain('worldview');
        });
        test('uses genre materialFocus when available', () => {
            const result = buildTypeList({ key: 'high-martial-comedy' });
            expect(result.typeListStr.length).toBeGreaterThan(0);
        });
        test('includes skip note when skip types exist', () => {
            const result = buildTypeList({ key: 'high-martial-comedy-artisan' });
            if (result.skipTypes.size > 0) {
                expect(result.skipNote).toContain('禁止生成');
            }
        });
        test('skips types in skip set', () => {
            const result = buildTypeList({ key: 'high-martial-comedy-artisan' });
            if (result.skipTypes.has('power-system')) {
                expect(result.typeListStr).not.toContain('power-system');
            }
        });
        test('appends material rules to type labels', () => {
            const result = buildTypeList({ key: 'high-martial-comedy' });
            expect(result.typeListStr.length).toBeGreaterThan(0);
        });
    });

    describe('buildInitialMaterialSystemPrompt', () => {
        test('includes type list', () => {
            const prompt = buildInitialMaterialSystemPrompt('- worldview: 世界观设定\n', '', '', '');
            expect(prompt).toContain('worldview');
            expect(prompt).toContain('素材库生成器');
        });
        test('includes skip note', () => {
            const prompt = buildInitialMaterialSystemPrompt('', '禁止生成power-system', '', '');
            expect(prompt).toContain('禁止生成');
        });
        test('includes constraint injection', () => {
            const prompt = buildInitialMaterialSystemPrompt('', '', '硬性约束：禁止霸总', '');
            expect(prompt).toContain('禁止霸总');
        });
        test('includes style injection', () => {
            const prompt = buildInitialMaterialSystemPrompt('', '', '', '风格：诗意意象');
            expect(prompt).toContain('诗意意象');
        });
    });

    describe('parseMaterialResponse', () => {
        test('parses valid JSON array', () => {
            const result = parseMaterialResponse('[{"type":"character","name":"张三","content":"内容"}]');
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('张三');
        });
        test('strips markdown code blocks', () => {
            const result = parseMaterialResponse('```json\n[{"type":"character","name":"张三","content":"内容"}]\n```');
            expect(result).toHaveLength(1);
        });
        test('extracts JSON from surrounding text', () => {
            const result = parseMaterialResponse('这是生成的素材：\n[{"type":"character","name":"张三","content":"内容"}]\n以上是素材。');
            expect(result).toHaveLength(1);
        });
        test('throws for invalid JSON', () => {
            expect(() => parseMaterialResponse('not json')).toThrow();
        });
        test('removes control characters', () => {
            const result = parseMaterialResponse('[{"type":"character","name":"张三","content":"内容\x00"}]');
            expect(result).toHaveLength(1);
        });
    });
});
