const { resolveWorldRef, normalizeWorldRefs } = require('../../server/services/worldRefResolve');

const WORLDS = [
    { id: 'main-world', name: '主位面' },
    { id: 'jie-qiangshi', name: '腔市·夜摊' },
    { id: 'jie-chaiqian', name: '拆迁楼·601' },
];

describe('worldRefResolve — 世界名称↔id 归一（#17）', () => {
    test('名称精确匹配 → id', () => {
        expect(resolveWorldRef('腔市·夜摊', WORLDS)).toBe('jie-qiangshi');
    });
    test('名称包含匹配（LLM 加前后缀）', () => {
        expect(resolveWorldRef('腔市', WORLDS)).toBe('jie-qiangshi');
    });
    test('主世界别名 → main-world', () => {
        expect(resolveWorldRef('主世界', WORLDS)).toBe('main-world');
        expect(resolveWorldRef('', WORLDS)).toBe('main-world');
    });
    test('复合主世界串 → main-world（实测 LLM 返回"现实界/主世界"）', () => {
        expect(resolveWorldRef('现实界/主世界', WORLDS)).toBe('main-world');
        expect(resolveWorldRef('main-world(主世界)', WORLDS)).toBe('main-world');
    });
    test('已是 id 保持', () => {
        expect(resolveWorldRef('jie-chaiqian', WORLDS)).toBe('jie-chaiqian');
    });
    test('normalizeWorldRefs 修正 worldName=腔市 但 worldId=main-world 的实体', () => {
        const result = { entities: [{ name: '岑野', worldId: 'main-world', worldName: '腔市' }], transitions: [{ from: '腔市', to: '主世界' }] };
        normalizeWorldRefs(result, WORLDS);
        expect(result.entities[0].worldId).toBe('jie-qiangshi');
        expect(result.transitions[0]).toEqual({ from: 'jie-qiangshi', to: 'main-world' });
    });
});
