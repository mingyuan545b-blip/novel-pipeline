const { VALID_MATERIAL_TYPES, HIERARCHY_RULES, MATERIAL_STANDARDS, DOMAIN_CATEGORIES, isValidType, inferTypeFromContent, classifyMaterialType, CRAFT_TYPES, WORLDVIEW_TYPES, CHARACTER_TYPES } = require('../../server/config/materialTypes');

describe('Material Types Config', () => {
    test('VALID_MATERIAL_TYPES has expected count', () => {
        expect(VALID_MATERIAL_TYPES.length).toBeGreaterThanOrEqual(28);
    });

    test('all types in DOMAIN_CATEGORIES are in VALID_MATERIAL_TYPES', () => {
        for (const [domain, types] of Object.entries(DOMAIN_CATEGORIES)) {
            for (const type of types) {
                expect(VALID_MATERIAL_TYPES).toContain(type);
            }
        }
    });

    test('all types in HIERARCHY_RULES are in VALID_MATERIAL_TYPES', () => {
        for (const type of Object.keys(HIERARCHY_RULES)) {
            expect(VALID_MATERIAL_TYPES).toContain(type);
        }
    });

    test('all types in MATERIAL_STANDARDS are in VALID_MATERIAL_TYPES', () => {
        for (const type of Object.keys(MATERIAL_STANDARDS)) {
            expect(VALID_MATERIAL_TYPES).toContain(type);
        }
    });

    test('no duplicate types', () => {
        const unique = new Set(VALID_MATERIAL_TYPES);
        expect(unique.size).toBe(VALID_MATERIAL_TYPES.length);
    });
});

describe('isValidType', () => {
    test('returns true for valid types', () => {
        expect(isValidType('worldview')).toBe(true);
        expect(isValidType('character')).toBe(true);
        expect(isValidType('foreshadowing')).toBe(true);
        expect(isValidType('craft')).toBe(true);
    });

    test('returns false for invalid types', () => {
        expect(isValidType('invalid-type')).toBe(false);
        expect(isValidType('')).toBe(false);
        expect(isValidType('Character')).toBe(false);
    });
});

describe('inferTypeFromContent', () => {
    test('infers mechanism type', () => {
        const result = inferTypeFromContent('灵气净化机制', '这个结构具有过滤和传导功能，触发条件是灵气浓度');
        expect(result).toBe('mechanism');
    });

    test('infers character type', () => {
        const result = inferTypeFromContent('张三', '身份：掌门。性格：沉稳。行为模式：隐忍。内在矛盾：凡心未了');
        expect(result).toBe('character');
    });

    test('returns null for ambiguous content', () => {
        const result = inferTypeFromContent('测试', '普通内容');
        expect(result).toBeNull();
    });
});

describe('classifyMaterialType', () => {
    test('worldview types classified correctly', () => {
        expect(classifyMaterialType('worldview')).toBe('worldview');
        expect(classifyMaterialType('power-system')).toBe('worldview');
        expect(classifyMaterialType('faction')).toBe('worldview');
    });

    test('character types classified correctly', () => {
        expect(classifyMaterialType('character')).toBe('character');
        expect(classifyMaterialType('character-psychology')).toBe('character');
        expect(classifyMaterialType('foreshadowing')).toBe('character');
    });

    test('craft types classified correctly', () => {
        expect(classifyMaterialType('mechanism')).toBe('craft');
        expect(classifyMaterialType('writing-technique')).toBe('craft');
        expect(classifyMaterialType('craft')).toBe('craft');
    });
});

describe('MATERIAL_STANDARDS validation', () => {
    test('character standard accepts valid content', () => {
        const result = MATERIAL_STANDARDS.character.check('核心欲望：修仙成道。内在矛盾：凡尘未了。行为模式：隐忍不发。');
        expect(result.valid).toBe(true);
    });

    test('character standard rejects content missing fields', () => {
        const result = MATERIAL_STANDARDS.character.check('这是一个普通描述，没有标准字段。');
        expect(result.valid).toBe(false);
        expect(result.missing.length).toBeGreaterThan(0);
    });

    test('worldview standard accepts valid content', () => {
        const result = MATERIAL_STANDARDS.worldview.check('边界：不可跨越天堑。违反后果：遭天谴。');
        expect(result.valid).toBe(true);
    });

    test('power-system standard accepts valid content', () => {
        const result = MATERIAL_STANDARDS['power-system'].check('升级条件：需渡劫。代价：反噬三成修为。限制：不可越级。');
        expect(result.valid).toBe(true);
    });

    test('foreshadowing standard accepts valid content', () => {
        const result = MATERIAL_STANDARDS.foreshadowing.check('预期回收窗口：第30章。关联角色：张三。');
        expect(result.valid).toBe(true);
    });
});

describe('HIERARCHY_RULES', () => {
    test('faction requires parentPlane', () => {
        expect(HIERARCHY_RULES.faction.parentRequired).toBe(true);
        expect(HIERARCHY_RULES.faction.parentFields).toContain('parentPlane');
    });

    test('character requires parentFaction', () => {
        expect(HIERARCHY_RULES.character.parentRequired).toBe(true);
        expect(HIERARCHY_RULES.character.parentFields).toContain('parentFaction');
    });

    test('worldview does not require parent', () => {
        expect(HIERARCHY_RULES.worldview.parentRequired).toBe(false);
    });
});

describe('MaterialValidator integration', () => {
    let validator;

    beforeAll(() => {
        validator = require('../../server/services/materialValidator');
    });

    test('validateHierarchy rejects faction without parentPlane', async () => {
        const result = await validator.validateHierarchy({
            type: 'faction',
            name: '测试势力',
            parentPlane: undefined
        });
        expect(result.valid).toBe(false);
    });

    test('validateHierarchy accepts faction with parentPlane', async () => {
        const result = await validator.validateHierarchy({
            type: 'faction',
            name: '测试势力',
            parentPlane: null
        });
        expect(result.valid).toBe(true);
    });

    test('validateHierarchy rejects character without parentFaction', async () => {
        const result = await validator.validateHierarchy({
            type: 'character',
            name: '测试角色',
            parentFaction: undefined
        });
        expect(result.valid).toBe(false);
    });

    test('validateHierarchy accepts character with parentFaction', async () => {
        const result = await validator.validateHierarchy({
            type: 'character',
            name: '测试角色',
            parentFaction: 'fac-1'
        });
        expect(result.valid).toBe(true);
    });

    test('validateMaterial rejects invalid type', async () => {
        const result = await validator.validateMaterial({
            type: 'invalid-type',
            name: '测试'
        });
        expect(result.valid).toBe(false);
        expect(result.message).toBeDefined();
    });

    test('validateMaterial accepts valid material', async () => {
        const result = await validator.validateMaterial({
            type: 'worldview',
            name: '测试世界观',
            currentContent: '边界：不可。违反后果：天谴。',
            parentPlane: null
        });
        expect(result.valid).toBe(true);
    });

    test('validateMaterialBatch processes multiple materials', async () => {
        const materials = [
            { type: 'worldview', name: '世界1', currentContent: '边界：不可。违反后果：天谴。', parentPlane: null },
            { type: 'character', name: '角色1', parentFaction: 'fac-1' },
            { type: 'invalid', name: '无效' }
        ];
        const result = await validator.validateMaterialBatch(materials);
        expect(result.total).toBe(3);
        expect(result.invalid).toBeGreaterThanOrEqual(1);
    });
});
