/**
 * techniqueFeedback 统计单测（D 增量·差分加权数据源）
 */
jest.mock('../../server/store', () => ({ queryItems: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn(), getItem: jest.fn() }));

const store = require('../../server/store');
const { getTechniqueStats, getTechniqueSuccessRate, getBatchSuccessStats, recordFeedback } = require('../../server/services/pipeline/techniqueFeedback');

const rec = (techniqueId, passed, t) => ({ id: 'r' + t, techniqueId, passed, createdAt: new Date(2026, 0, t).toISOString() });

describe('getTechniqueStats', () => {
    beforeEach(() => jest.clearAllMocks());

    test('返回速率 + 样本数', async () => {
        store.queryItems.mockResolvedValue([rec('t1', true, 1), rec('t1', false, 2), rec('t1', true, 3)]);
        const s = await getTechniqueStats('t1', 'p1');
        expect(s.count).toBe(3);
        expect(s.rate).toBeCloseTo(2 / 3);
    });

    test('无记录 → null；getTechniqueSuccessRate 兼容返回 rate', async () => {
        store.queryItems.mockResolvedValue([]);
        expect(await getTechniqueStats('t1', 'p1')).toBeNull();
        expect(await getTechniqueSuccessRate('t1', 'p1')).toBeNull();
    });

    test('getBatchSuccessStats 只收有样本的技法', async () => {
        store.queryItems.mockResolvedValue([rec('t1', true, 1), rec('t2', false, 2)]);
        const b = await getBatchSuccessStats(['t1', 't2', 't3'], 'p1');
        expect(Boolean(b.t1)).toBe(true);
        expect(b.t2.rate).toBe(0);
        expect(b.t3).toBeUndefined();
    });
});

describe('recordFeedback × 留出集隔离（D3-a 接线）', () => {
    beforeEach(() => jest.clearAllMocks());

    test('未设置 holdoutRatio → 正常记录', async () => {
        store.getItem.mockResolvedValue({ settings: {} });
        store.queryItems.mockResolvedValue([]);
        await recordFeedback('p1', 5, ['t1'], true);
        expect(store.setItem).toHaveBeenCalledTimes(1);
    });

    test('holdoutRatio=1 → 全为留出集，不写入学习数据', async () => {
        store.getItem.mockResolvedValue({ settings: { holdoutRatio: 1 } });
        await recordFeedback('p1', 5, ['t1'], true);
        expect(store.setItem).not.toHaveBeenCalled();
    });

    test('读项目失败 → 保守不隔离（仍记录）', async () => {
        store.getItem.mockRejectedValue(new Error('db down'));
        store.queryItems.mockResolvedValue([]);
        await recordFeedback('p1', 5, ['t1'], false);
        expect(store.setItem).toHaveBeenCalledTimes(1);
    });
});
