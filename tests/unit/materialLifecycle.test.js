/**
 * materialLifecycle 单元测试：区间/归档/报废判定
 */
const { isMaterialActiveAt, lifecycleLabel, normalizeLifecyclePatch } = require('../../server/services/materialLifecycle');

describe('materialLifecycle', () => {
    test('无区间/未归档 → 任意章有效', () => {
        expect(isMaterialActiveAt({ name: 'x' }, 1)).toBe(true);
        expect(isMaterialActiveAt({ name: 'x' }, 999)).toBe(true);
    });

    test('归档/报废 → 任何章都无效', () => {
        expect(isMaterialActiveAt({ archived: true }, 5)).toBe(false);
        expect(isMaterialActiveAt({ state: 'retired' }, 5)).toBe(false);
    });

    test('章节区间：30–50 章内有效，区间外无效', () => {
        const m = { activeFromChapter: 30, activeToChapter: 50 };
        expect(isMaterialActiveAt(m, 29)).toBe(false);
        expect(isMaterialActiveAt(m, 30)).toBe(true);
        expect(isMaterialActiveAt(m, 50)).toBe(true);
        expect(isMaterialActiveAt(m, 51)).toBe(false);
    });

    test('只有起始/只有结束', () => {
        expect(isMaterialActiveAt({ activeFromChapter: 10 }, 9)).toBe(false);
        expect(isMaterialActiveAt({ activeFromChapter: 10 }, 99)).toBe(true);
        expect(isMaterialActiveAt({ activeToChapter: 10 }, 11)).toBe(false);
    });

    test('无章节上下文（chapter=0）→ 不做区间裁剪（建索引场景）', () => {
        expect(isMaterialActiveAt({ activeFromChapter: 30, activeToChapter: 50 }, 0)).toBe(true);
        expect(isMaterialActiveAt({ archived: true }, 0)).toBe(false);
    });

    test('lifecycleLabel 展示', () => {
        expect(lifecycleLabel({ archived: true })).toBe('已归档/报废');
        expect(lifecycleLabel({})).toBe('常驻');
        expect(lifecycleLabel({ activeFromChapter: 30, activeToChapter: 50 })).toBe('第30–50章');
        expect(lifecycleLabel({ activeFromChapter: 30 })).toBe('第30–∞章');
    });

    test('normalizeLifecyclePatch 校验', () => {
        expect(normalizeLifecyclePatch({ state: 'retired', archived: true, activeFromChapter: '5' }))
            .toEqual({ state: 'retired', archived: true, activeFromChapter: 5 });
        expect(() => normalizeLifecyclePatch({ state: 'bogus' })).toThrow();
        expect(() => normalizeLifecyclePatch({ activeFromChapter: 50, activeToChapter: 30 })).toThrow();
    });
});
