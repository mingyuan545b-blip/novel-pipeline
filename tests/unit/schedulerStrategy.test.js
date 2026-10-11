/**
 * schedulerStrategy.test.js — 默认选材策略：小预算不静默空转（2026-10-11 根因修复回归）
 */
const { selectItems, DEFAULT_STRATEGY } = require('../../server/services/pipeline/schedulerStrategy');

describe('schedulerStrategy.selectItems', () => {
    test('预算足够时按顺序装到预算上限', () => {
        const items = [{ content: 'a'.repeat(100) }, { content: 'b'.repeat(100) }, { content: 'c'.repeat(100) }];
        expect(selectItems(items, {}, 250).length).toBe(2);
    });

    test('预算 < 单条素材时至少给一条（超长按预算截断），不得返回空', () => {
        const items = [{ content: 'x'.repeat(1600) }, { content: 'y'.repeat(1500) }];
        const out = selectItems(items, {}, 1500);
        expect(out.length).toBe(1);
        expect(out[0].content.length).toBe(1500);
    });

    test('预算足够容纳第一条但不够第二条时，给一条（原值不截断）', () => {
        const items = [{ content: 'x'.repeat(1400) }, { content: 'y'.repeat(1400) }];
        const out = selectItems(items, {}, 1500);
        expect(out.length).toBe(1);
        expect(out[0].content.length).toBe(1400);
    });

    test('空素材列表返回空', () => {
        expect(selectItems([], {}, 1000).length).toBe(0);
    });

    test('DEFAULT_STRATEGY 导出稳定', () => {
        expect(DEFAULT_STRATEGY.id).toBe('default');
        expect(typeof DEFAULT_STRATEGY.select).toBe('function');
    });
});
