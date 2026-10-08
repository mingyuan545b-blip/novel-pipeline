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
    const h1 = { scene: '雨夜堤岸', what: '把唯一的伞塞给对方自己淋回去', cost: '欠了一夜的风寒', why: '因为他怕欠人情，所以宁可自己病，也不肯让别人照顾' };
    const h2 = { scene: '茶肆后堂', what: '当着两派面上摔了账本', cost: '断了这条线的退路', why: '因为他要的是账平，所以宁可撕破脸，也不肯留一笔糊涂账' };
    test('按 scene|what 去重', () => {
        const r = mergeHighlights([h1], [h1, h2]);
        expect(r.added).toBe(1);
        expect(r.highlightScenes).toHaveLength(2);
    });
    test('空/非法项忽略', () => {
        expect(mergeHighlights([], [{}, null]).added).toBe(0);
    });
    test('评论腔/无代价的高光不回流（治"展现了…"）', () => {
        const r = mergeHighlights([], [
            { scene: '雨夜', what: '立誓', why: '展现了其核心能力的高光时刻' },
            { scene: '茶肆', what: '布局' },
        ]);
        expect(r.added).toBe(0);
        expect(r.highlightScenes).toEqual([]);
    });
});

describe('buildCraftPatch', () => {
    test('仅在有新增时给字段', () => {
        const patch = buildCraftPatch({}, {
            quotes: [good],
            highlights: [{ scene: '茶肆后堂', what: '当面摔了账本', cost: '断了退路', why: '因为他要账平，所以宁可撕破脸，也不留糊涂账' }]
        });
        expect(patch.quoteLibrary).toHaveLength(1);
        expect(patch.highlightScenes).toHaveLength(1);
    });
    test('评论腔 why 的名言不回流', () => {
        const patch = buildCraftPatch({}, {
            quotes: [{ speaker: '甲', scene: '对峙', quote: '人生如棋，落子无悔', why: '体现了其哲学观' }],
            highlights: []
        });
        expect(patch).toEqual({});
    });
    test('无新增返回空补丁', () => {
        expect(buildCraftPatch({ quoteLibrary: [good], highlightScenes: [] }, { quotes: [good], highlights: [] })).toEqual({});
    });
});
