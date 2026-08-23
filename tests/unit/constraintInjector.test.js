/**
 * constraintInjector.test.js
 * 覆盖 constraintInjector 核心函数
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    queryItems: jest.fn()
}));

const store = require('../../server/store');

describe('constraintInjector', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        store.getItem.mockReturnValue(null);
        store.queryItems.mockReturnValue([]);
    });

    test('module loads without error', () => {
        const ci = require('../../server/services/prompts/constraintInjector');
        expect(ci).toBeDefined();
        expect(typeof ci.buildConstraintInjection).toBe('function');
    });

    test('buildConstraintInjection returns result for missing project', async () => {
        store.getItem.mockReturnValue(null);
        const ci = require('../../server/services/prompts/constraintInjector');
        const result = await ci.buildConstraintInjection('proj1', 'outline');
        expect(result).toBeDefined();
    });

    test('buildConstraintInjection returns result with project', async () => {
        store.getItem.mockReturnValue({ genre: 'novel', styleProfile: {} });
        const ci = require('../../server/services/prompts/constraintInjector');
        const result = await ci.buildConstraintInjection('proj1', 'outline');
        expect(result).toBeDefined();
    });
});
