const { planMaterialBatches } = require('../../server/services/pipeline/materialBatchPlan');

describe('materialBatchPlan — 素材生成批次规划（P1-F #12）', () => {
    test('含角色时拆成 主角批 + 其余角色批 + 非角色批', () => {
        const batches = planMaterialBatches(['character', 'worldview', 'equipment']);
        expect(batches.map(b => b.batchKey)).toEqual(['character-lead', 'character-rest', 'non-character']);
        expect(batches[0].types).toEqual(['character']);
        expect(batches[2].types).toEqual(['worldview', 'equipment']);
    });
    test('无角色时只有非角色批', () => {
        const batches = planMaterialBatches(['worldview', 'foreshadowing']);
        expect(batches).toHaveLength(1);
        expect(batches[0].batchKey).toBe('non-character');
    });
    test('去重类型', () => {
        const batches = planMaterialBatches(['character', 'character', 'worldview', 'worldview']);
        expect(batches[2].types).toEqual(['worldview']);
    });
    test('空输入返回空批次', () => {
        expect(planMaterialBatches([])).toEqual([]);
    });
    test('character-rest 批次带避重占位符', () => {
        const batches = planMaterialBatches(['character']);
        expect(batches[1].note).toContain('{{AVOID}}');
    });
});
