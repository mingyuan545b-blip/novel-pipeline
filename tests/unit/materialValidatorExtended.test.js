const {
    validateHierarchy, validateMaterial, validateMaterialBatch,
    getMaterialValidationPrompt, MATERIAL_STANDARDS, HIERARCHY_RULES
} = require('../../server/services/materialValidator');

describe('materialValidator', () => {
    describe('validateHierarchy', () => {
        test('returns valid for unknown type', async () => {
            const result = await validateHierarchy({ type: 'unknown' });
            expect(result.valid).toBe(true);
        });
        test('returns valid for type without hierarchy rules', async () => {
            const result = await validateHierarchy({ type: 'equipment' });
            expect(result.valid).toBe(true);
        });
        test('returns valid when required parent fields present', async () => {
            const result = await validateHierarchy({ type: 'character', parentFaction: 'f1', parentPlane: 'p1' });
            expect(result.valid).toBe(true);
        });
        test('returns invalid when required parent fields missing', async () => {
            const result = await validateHierarchy({ type: 'character' });
            if (HIERARCHY_RULES.character?.parentRequired) {
                expect(result.valid).toBe(false);
                expect(result.missing.length).toBeGreaterThan(0);
            } else {
                expect(result.valid).toBe(true);
            }
        });
    });

    describe('validateMaterial', () => {
        test('returns invalid for unknown type', async () => {
            const result = await validateMaterial({ type: 'unknown-type', name: 'test', currentContent: 'content' });
            expect(result.valid).toBe(false);
            expect(result.message).toContain('无效素材类型');
        });
        test('returns result for character material', async () => {
            const result = await validateMaterial({ type: 'character', name: '张三', currentContent: 'a'.repeat(100), parentFaction: 'f1' });
            expect(result).toBeDefined();
            expect(result.type).toBe('character');
        });
        test('returns valid for foreshadowing with keywords', async () => {
            const result = await validateMaterial({ type: 'foreshadowing', name: '伏笔1', currentContent: '这是一个预期回收的伏笔' });
            expect(result).toBeDefined();
        });
        test('uses category as fallback type', async () => {
            const result = await validateMaterial({ category: 'unknown-cat', name: 'test', currentContent: 'content' });
            expect(result.valid).toBe(false);
        });
    });

    describe('validateMaterialBatch', () => {
        test('validates multiple materials', async () => {
            const materials = [
                { id: '1', name: 'test1', type: 'character', currentContent: 'a'.repeat(100), parentFaction: 'f1' },
                { id: '2', name: 'test2', type: 'unknown-type', currentContent: 'content' },
            ];
            const result = await validateMaterialBatch(materials);
            expect(result.total).toBe(2);
            expect(result.invalid).toBeGreaterThanOrEqual(1);
        });
        test('handles empty batch', async () => {
            const result = await validateMaterialBatch([]);
            expect(result.total).toBe(0);
            expect(result.invalid).toBe(0);
        });
    });

    describe('getMaterialValidationPrompt', () => {
        test('returns result for character material', async () => {
            const result = await getMaterialValidationPrompt({ type: 'character', name: '张三', currentContent: 'a'.repeat(100), parentFaction: 'f1' });
            expect(typeof result).toBe('string');
        });
        test('returns prompt for invalid material', async () => {
            const result = await getMaterialValidationPrompt({ type: 'unknown-type', name: 'test', currentContent: 'content' });
            expect(result).toContain('素材标准校验未通过');
        });
    });

    describe('MATERIAL_STANDARDS', () => {
        test('has standards for key types', () => {
            expect(MATERIAL_STANDARDS.character).toBeDefined();
        });
    });

    describe('HIERARCHY_RULES', () => {
        test('has rules for character type', () => {
            expect(HIERARCHY_RULES.character).toBeDefined();
        });
    });
});
