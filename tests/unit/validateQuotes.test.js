/**
 * validateQuotes 单元测试 — 台词四要素质检 + 去重
 */
const {
    normalizeQuote, quoteKey, validateQuote, validateQuotes, dedupeQuotes
} = require('../../server/services/validateQuotes');

describe('normalizeQuote', () => {
    test('兼容纯字符串（旧格式）', () => {
        expect(normalizeQuote('路就在脚下')).toEqual(
            { speaker: '', scene: '', quote: '路就在脚下', why: '', chapter: 0 }
        );
    });
    test('兼容 {scene,quote}', () => {
        const n = normalizeQuote({ scene: '绝境', quote: '人生如棋，落子无悔' });
        expect(n.scene).toBe('绝境');
        expect(n.why).toBe('');
    });
    test('空值返回 null', () => {
        expect(normalizeQuote('')).toBeNull();
        expect(normalizeQuote(null)).toBeNull();
        expect(normalizeQuote({ quote: '  ' })).toBeNull();
    });
});

describe('validateQuote', () => {
    test('四要素齐备通过', () => {
        const r = validateQuote({ speaker: '卡蜜尔', scene: '回望一生', quote: '我曾踏足山巅，也曾进入低谷', why: '道出她对人生态度的通达' });
        expect(r.valid).toBe(true);
        expect(r.issues).toEqual([]);
    });
    test('缺场景/记忆点被拦', () => {
        const r = validateQuote({ quote: '路就在脚下' });
        expect(r.valid).toBe(false);
        expect(r.issues).toEqual(expect.arrayContaining([expect.stringContaining('scene'), expect.stringContaining('why')]));
    });
});

describe('validateQuotes / dedupeQuotes', () => {
    const good = { speaker: '方源', scene: '抉择', quote: '路就在脚下', why: '点明他绝不回头的道' };
    test('批量区分通过/失败', () => {
        const r = validateQuotes([good, { quote: 'x' }]);
        expect(r.passed).toBe(1);
        expect(r.failed).toHaveLength(1);
        expect(r.valid).toBe(false);
    });
    test('去重忽略标点空白', () => {
        const { merged, added } = dedupeQuotes(
            [{ scene: 'a', quote: '人生如棋，落子无悔', why: 'x' }],
            [{ scene: 'b', quote: '人生如棋，落子无悔。', why: 'y' }, good]
        );
        expect(merged).toHaveLength(2); // 重复项被去掉，good 新增
        expect(added.map(q => q.quote)).toEqual(['路就在脚下']);
    });
    test('quoteKey 归一', () => {
        expect(quoteKey('路就在脚下')).toBe(quoteKey(' 路就在脚下。 '));
    });
});
