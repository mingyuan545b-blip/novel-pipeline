/**
 * blindJudge 单测（D3-b 双盲去标签）
 */
const { buildBlindSet, unblindCode, assignCodes } = require('../../server/services/blindJudge');

const items = [
    { id: 'modelX', payload: '来自模型的文本X' },
    { id: 'modelY', payload: '来自模型的文本Y' },
];

describe('buildBlindSet', () => {
    test('确定性洗牌：同 seed 同顺序（可复现）', () => {
        const a = buildBlindSet(items, { seed: 's1' });
        const b = buildBlindSet(items, { seed: 's1' });
        expect(a.blinded).toEqual(b.blinded);
        expect(a.mapping).toEqual(b.mapping);
    });
    test('代号↔原始 id 映射正确，且 payload 与 mapping 对应', () => {
        const { blinded, mapping } = buildBlindSet(items, { seed: 's2' });
        for (const b of blinded) {
            const id = unblindCode(b.code, mapping);
            expect(['modelX', 'modelY']).toContain(id);
            const src = items.find(i => i.id === id);
            expect(b.payload).toBe(src.payload);
        }
    });
    test('不暴露原始 id 到 blinded 载荷', () => {
        const { blinded } = buildBlindSet(items, { seed: 's3' });
        for (const b of blinded) expect(b.payload).not.toContain(b.code);
    });
    test('空输入安全', () => {
        expect(buildBlindSet(null).blinded).toEqual([]);
        expect(buildBlindSet([]).mapping).toEqual({});
    });
    test('未知代号揭盲返回 null', () => {
        expect(unblindCode('Z', { A: 'x' })).toBeNull();
    });
});

describe('assignCodes', () => {
    test('A/B/C…/溢出用 X<n>', () => {
        expect(assignCodes(3)).toEqual(['A', 'B', 'C']);
        expect(assignCodes(27)[26]).toBe('X26');
    });
});
