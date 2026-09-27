/**
 * 素材预算 × 生命周期接线测试：区间外素材不应计入本章预算（token 黑洞防护）
 */
jest.mock('../../server/store', () => ({ queryItems: jest.fn() }));
jest.mock('../../server/services/genreConfig', () => ({ detectGenre: jest.fn(() => null) }));
jest.mock('../../server/services/prompts/styleInjector', () => ({ getStyleProfileForProject: jest.fn(async () => ({})) }));

const store = require('../../server/store');
const { calculateTokenBudget } = require('../../server/services/materialBudgetCalc');

describe('materialBudgetCalc × lifecycle', () => {
    beforeEach(() => jest.clearAllMocks());

    test('章节区间外/归档/报废的素材不计入本章预算', async () => {
        store.queryItems.mockResolvedValue([
            { id: 'always', type: 'equipment', name: '常驻' },
            { id: 'ch30-50', type: 'equipment', name: '30-50章有效', activeFromChapter: 30, activeToChapter: 50 },
            { id: 'gone', type: 'equipment', name: '已归档', archived: true },
            { id: 'dead', type: 'equipment', name: '已报废', state: 'retired' },
        ]);
        const r20 = await calculateTokenBudget('p1', 20);
        const r40 = await calculateTokenBudget('p1', 40);
        const r60 = await calculateTokenBudget('p1', 60);
        expect(r20.totalMaterials).toBe(1);   // 只剩"常驻"
        expect(r40.totalMaterials).toBe(2);   // 常驻 + 30-50章
        expect(r60.totalMaterials).toBe(1);   // 区间已过
    });
});
