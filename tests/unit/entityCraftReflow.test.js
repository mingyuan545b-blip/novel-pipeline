/**
 * entityCraftReflow 单元测试 — 台词库/高光场景回流合并
 */
const { mergeQuoteLibrary, mergeHighlights, buildCraftPatch } = require('../../server/services/entityCraftReflow');

const good = { speaker: '方源', scene: '抉择', quote: '路就在脚下', why: '点明绝不回头的道' };

describe('mergeQuoteLibrary', () => {
    test('只收四要素合格的名言', () => {
        const r = mergeQuoteLibrary([], [good, { quote: '路就在脚下' }]); // 第二条缺 scene/why
        expect(r.added).toBe(1);
        expect(r.quoteLibrary[0].quote).toBe('路就在脚下');
    });
    test('重复不重复入库', () => {
        const r = mergeQuoteLibrary([good], [{ ...good, scene: '别处' }]);
        expect(r.added).toBe(0);
        expect(r.quoteLibrary).toHaveLength(1);
    });
});

describe('mergeHighlights', () => {
    test('按 scene|what 去重', () => {
        const r = mergeHighlights(
            [{ scene: '雨夜', what: '立誓', why: 'x' }],
            [{ scene: '雨夜', what: '立誓', why: 'y' }, { scene: '茶肆', what: '布局', why: 'z' }]
        );
        expect(r.added).toBe(1);
        expect(r.highlightScenes).toHaveLength(2);
    });
    test('空/非法项忽略', () => {
        expect(mergeHighlights([], [{}, null]).added).toBe(0);
    });
});

describe('buildCraftPatch', () => {
    test('仅在有新增时给字段', () => {
        const patch = buildCraftPatch({}, {
            quotes: [good],
            highlights: [{ scene: 's', what: 'w' }]
        });
        expect(patch.quoteLibrary).toHaveLength(1);
        expect(patch.highlightScenes).toHaveLength(1);
    });
    test('无新增返回空补丁', () => {
        expect(buildCraftPatch({ quoteLibrary: [good], highlightScenes: [] }, { quotes: [good], highlights: [] })).toEqual({});
    });
});
