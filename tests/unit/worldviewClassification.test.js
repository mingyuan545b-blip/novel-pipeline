/**
 * worldviewClassification.test.js — 世界观3维分类测试
 */
const { classifyMaterial, classifyMaterials, resolveWorldviewLoadDepth, getClassificationOverview } = require('../../server/services/pipeline/worldviewClassification');

describe('worldviewClassification', () => {
    const sampleMaterials = [
        { id: '1', name: '战力体系', type: 'power-system' },
        { id: '2', name: '灵剑宗', type: 'faction' },
        { id: '3', name: '天衡山', type: 'geography' },
        { id: '4', name: '灵剑宗习俗', type: 'custom' },
        { id: '5', name: '陆尘', type: 'character' },
        { id: '6', name: '青锋剑', type: 'equipment' },
        { id: '7', name: '伏笔1', type: 'foreshadowing' },
        { id: '8', name: '世界观总纲', type: 'worldview' },
    ];

    test('classifyMaterial maps power-system to macro', () => {
        const cls = classifyMaterial(sampleMaterials[0]);
        expect(cls.worldviewDepth).toBe('macro');
    });

    test('classifyMaterial maps faction to meso', () => {
        const cls = classifyMaterial(sampleMaterials[1]);
        expect(cls.worldviewDepth).toBe('meso');
    });

    test('classifyMaterial maps custom to micro', () => {
        const cls = classifyMaterial(sampleMaterials[3]);
        expect(cls.worldviewDepth).toBe('micro');
    });

    test('classifyMaterial maps character to character category', () => {
        const cls = classifyMaterial(sampleMaterials[4]);
        expect(cls.category).toBe('character');
        expect(cls.worldviewDepth).toBeNull();
    });

    test('classifyMaterials groups correctly', () => {
        const result = classifyMaterials(sampleMaterials);
        expect(result.macro.length).toBe(2);
        expect(result.meso.length).toBe(2);
        expect(result.micro.length).toBe(1);
        expect(result.character.length).toBe(1);
    });

    test('resolveWorldviewLoadDepth: macro default is L1', () => {
        const depth = resolveWorldviewLoadDepth(sampleMaterials[0], '无关内容');
        expect(depth).toBe('L1');
    });

    test('resolveWorldviewLoadDepth: meso default is L0', () => {
        const depth = resolveWorldviewLoadDepth(sampleMaterials[1], '无关内容');
        expect(depth).toBe('L0');
    });

    test('resolveWorldviewLoadDepth: meso mentioned upgrades to L2', () => {
        const depth = resolveWorldviewLoadDepth(sampleMaterials[1], '陆尘来到灵剑宗');
        expect(depth).toBe('L2');
    });

    test('resolveWorldviewLoadDepth: micro default is null (no load)', () => {
        const depth = resolveWorldviewLoadDepth(sampleMaterials[3], '无关内容');
        expect(depth).toBeNull();
    });

    test('getClassificationOverview returns structure', () => {
        const overview = getClassificationOverview(sampleMaterials);
        expect(overview.macro.count).toBe(2);
        expect(overview.macro.defaultLoad).toBe('L1');
        expect(overview.meso.count).toBe(2);
        expect(overview.meso.defaultLoad).toBe('L0');
        expect(overview.micro.count).toBe(1);
        expect(overview.micro.defaultLoad).toBeNull();
    });
});
