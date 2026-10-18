/**
 * validateHighlights 单元测试 — 高光四问质检 + 去重
 */
const {
    normalizeHighlight, highlightKey, validateHighlight, validateHighlights, dedupeHighlights
} = require('../../server/services/validateHighlights');

const good = {
    scene: '烧烤摊对峙灰衣探员',
    what: '用空白勘定笔在桌面划出蓝光弧线，冻结探员行动权',
    cost: '暴露了自己会用规则改写的底牌',
    why: '因为他怕线索断在自己手里，所以宁可违规，也不肯让唯一证人被带走'
};

describe('normalizeHighlight', () => {
    test('兼容纯字符串与旧 {scene,what,why}', () => {
        expect(normalizeHighlight('雨夜立誓').what).toBe('雨夜立誓');
        const n = normalizeHighlight({ scene: '雨夜', what: '立誓', why: 'x' });
        expect(n.cost).toBe('');
    });
    test('空值返回 null', () => {
        expect(normalizeHighlight(null)).toBeNull();
        expect(normalizeHighlight({})).toBeNull();
    });
});

describe('validateHighlight（高光四问）', () => {
    test('四要素齐备通过', () => {
        const r = validateHighlight(good);
        expect(r.valid).toBe(true);
        expect(r.issues).toEqual([]);
    });
    test('剧情摘要式 what 过短被拦', () => {
        const r = validateHighlight({ scene: '对峙', what: '打了', why: '因为他要活' });
        expect(r.valid).toBe(false);
        expect(r.issues.join()).toContain('what');
    });
    test('评论腔 why 被拦（治"展现了…体现了…"）', () => {
        const r = validateHighlight({ ...good, why: '展现了其核心能力的高光时刻，体现了绝境中的冷静' });
        expect(r.valid).toBe(false);
        expect(r.issues.join()).toContain('评论腔');
    });
    test('缺 why 被拦', () => {
        expect(validateHighlight({ scene: '对峙', what: '用笔冻结探员行动权' }).valid).toBe(false);
    });
});

describe('validateHighlights / dedupeHighlights', () => {
    test('批量区分通过/失败', () => {
        const r = validateHighlights([good, { scene: 'x', what: 'y' }]);
        expect(r.passed).toBe(1);
        expect(r.failed).toHaveLength(1);
        expect(r.valid).toBe(false);
    });
    test('去重忽略标点空白', () => {
        const { merged, added } = dedupeHighlights(
            [{ ...good, what: good.what + '。' }],
            [good, { scene: '别处', what: '另一个选择动作原文', cost: '代价', why: '因为他怕失去，所以宁可退，也不争' }]
        );
        expect(merged).toHaveLength(2);
        expect(added).toHaveLength(1);
    });
    test('highlightKey 归一', () => {
        expect(highlightKey(good)).toBe(highlightKey({ ...good, what: good.what + '。' }));
    });
});

describe('validateHighlight 结构性反模式（2026-10-17 加严，治库中真实脏数据）', () => {
    test('缺 cost 被拦（高光四问之"有代价"）', () => {
        const r = validateHighlight({ scene: '对峙', what: '用笔冻结探员行动权', why: '因为他怕线索断在自己手里，所以宁可违规也不退' });
        expect(r.valid).toBe(false);
        expect(r.issues.join()).toContain('cost');
    });
    test('剧情摘要式 what（事件复述）被拦', () => {
        const r = validateHighlight({
            scene: '提出取回原始协议时',
            what: '摇头否定陆行舟的直接行动力，指出其状态连低级镜像兽都打不过，并给出基于0.5秒逻辑空窗期的精密方案。',
            cost: '背负失去合作者的风险', why: '因为他信奉审计逻辑，所以宁可担连带责任，也不许数据被破坏'
        });
        expect(r.valid).toBe(false);
        expect(r.issues.join()).toContain('剧情摘要');
    });
    test('标签式 why 被拦', () => {
        const r = validateHighlight({
            scene: '对峙', what: '划出蓝光弧线冻结探员', cost: '暴露底牌', why: '记忆点：体现冷静'
        });
        expect(r.valid).toBe(false);
        expect(r.issues.join()).toContain('标签');
    });
});
