/**
 * unifiedBudgetPool.test.js — 统一预算池测试
 */
const { allocateUnifiedBudget, BUDGET_ZONES } = require('../../server/services/pipeline/unifiedBudgetPool');

describe('unifiedBudgetPool', () => {
    test('BUDGET_ZONES has all required zones', () => {
        expect(BUDGET_ZONES.memory).toBeDefined();
        expect(BUDGET_ZONES.characters).toBeDefined();
        expect(BUDGET_ZONES.worldview).toBeDefined();
        expect(BUDGET_ZONES.plot).toBeDefined();
        expect(BUDGET_ZONES.constraints).toBeDefined();
        expect(BUDGET_ZONES.reserve).toBeDefined();
    });

    test('allocateUnifiedBudget distributes to all zones', () => {
        const result = allocateUnifiedBudget({
            model: 'qwen3.6-plus',
            totalBudget: 10000,
            materialNeeds: [
                { type: 'character', resolvedDepth: 'L3', maxItems: 3 },
                { type: 'worldview', resolvedDepth: 'L2', maxItems: 2 },
            ],
        });
        expect(result.zones.memory.allocated).toBeGreaterThan(0);
        expect(result.zones.characters.allocated).toBeGreaterThan(0);
        expect(result.totalAllocated).toBeGreaterThan(0);
    });

    test('allocateUnifiedBudget warns on high memory usage', () => {
        const result = allocateUnifiedBudget({
            model: 'qwen3.6-plus',
            totalBudget: 10000,
            memorySize: 2400,
        });
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('allocateUnifiedBudget warns on insufficient budget', () => {
        const result = allocateUnifiedBudget({
            model: 'qwen3.6-plus',
            totalBudget: 100,
        });
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('allocateUnifiedBudget tracks usage per zone', () => {
        const result = allocateUnifiedBudget({
            model: 'qwen3.6-plus',
            totalBudget: 10000,
            materialNeeds: [
                { type: 'character', resolvedDepth: 'L3', maxItems: 5 },
            ],
        });
        expect(result.zones.characters.used).toBeGreaterThan(0);
    });
});
