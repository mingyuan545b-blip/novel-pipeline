/**
 * techniqueFeedback.test.js — 技法效果反馈闭环测试
 */
const mockItems = new Map();
jest.mock('../store', () => ({
    setItem: jest.fn((type, id, data) => { mockItems.set(id, data); }),
    queryItems: jest.fn((type, opts) => Array.from(mockItems.values()).filter(i => i.projectId === opts?.projectId)),
    deleteItem: jest.fn((type, id) => { mockItems.delete(id); }),
}));
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

const { recordFeedback, getTechniqueSuccessRate, getBatchSuccessRates, deleteFeedbackByProject, STORE_TYPE } = require('../services/pipeline/techniqueFeedback');

describe('techniqueFeedback', () => {
    beforeEach(() => { mockItems.clear(); jest.clearAllMocks(); });

    test('recordFeedback stores feedback records', async () => {
        await recordFeedback('proj-1', 1, ['tech-a', 'tech-b'], true);
        const store = require('../store');
        expect(store.setItem).toHaveBeenCalledTimes(2);
    });

    test('recordFeedback skips empty techniqueIds', async () => {
        await recordFeedback('proj-1', 1, [], true);
        const store = require('../store');
        expect(store.setItem).not.toHaveBeenCalled();
    });

    test('getTechniqueSuccessRate returns null when no feedback', async () => {
        const rate = await getTechniqueSuccessRate('tech-x', 'proj-1');
        expect(rate).toBeNull();
    });

    test('getBatchSuccessRates returns empty object for no feedback', async () => {
        const rates = await getBatchSuccessRates(['tech-a'], 'proj-1');
        expect(rates).toEqual({});
    });

    test('deleteFeedbackByProject removes feedback', async () => {
        await recordFeedback('proj-1', 1, ['tech-a'], true);
        const count = await deleteFeedbackByProject('proj-1');
        expect(count).toBe(1);
    });

    test('STORE_TYPE is technique-feedback', () => {
        expect(STORE_TYPE).toBe('technique-feedback');
    });
});
