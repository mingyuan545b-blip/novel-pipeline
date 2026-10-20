/**
 * budgetManager.test.js — 动态预算管理器测试
 */
const { calculateBudget, MODEL_BUDGETS, DEGRADATION_THRESHOLDS } = require('../../server/services/pipeline/unifiedBudgetPool');

describe('budgetManager', () => {
    const sampleNeeds = [
        { type: 'character', resolvedDepth: 'L3', required: true, maxItems: 5 },
        { type: 'worldview', resolvedDepth: 'L2', required: true, maxItems: 2 },
        { type: 'equipment', resolvedDepth: 'L1', required: false, maxItems: 3 },
        { type: 'foreshadowing', resolvedDepth: 'L2', required: false, maxItems: 3 },
    ];

    test('calculateBudget returns allocations for all types', () => {
        const result = calculateBudget({
            model: 'qwen3.6-plus',
            resolvedNeeds: sampleNeeds,
            sceneTypes: [],
            totalBudget: 8000,
        });
        expect(result.allocations.character).toBeDefined();
        expect(result.allocations.worldview).toBeDefined();
        expect(result.totalAllocated).toBeGreaterThan(0);
    });

    test('calculateBudget assesses budget status', () => {
        const result = calculateBudget({
            model: 'qwen3.6-plus',
            resolvedNeeds: sampleNeeds,
            sceneTypes: [],
            totalBudget: 8000,
        });
        expect(result.status).toBeDefined();
        expect(result.status.level).toMatch(/green|yellow|orange|red/);
    });

    test('calculateBudget prioritizes required needs', () => {
        const result = calculateBudget({
            model: 'qwen3.6-plus',
            resolvedNeeds: sampleNeeds,
            sceneTypes: [],
            totalBudget: 8000,
        });
        expect(result.allocations.character.priority).toBeGreaterThan(result.allocations.equipment.priority);
    });

    test('MODEL_BUDGETS has default config', () => {
        expect(MODEL_BUDGETS.default).toBeDefined();
        expect(MODEL_BUDGETS.default.maxInput).toBeGreaterThan(0);
    });

    test('DEGRADATION_THRESHOLDS has all levels', () => {
        expect(DEGRADATION_THRESHOLDS.green).toBeDefined();
        expect(DEGRADATION_THRESHOLDS.yellow).toBeDefined();
        expect(DEGRADATION_THRESHOLDS.orange).toBeDefined();
        expect(DEGRADATION_THRESHOLDS.red).toBeDefined();
    });

    test('calculateBudget with tight budget creates degradation plan', () => {
        const manyNeeds = Array.from({ length: 20 }, (_, i) => ({
            type: `type-${i}`, resolvedDepth: 'L3', required: i < 5, maxItems: 10,
        }));
        const result = calculateBudget({
            model: 'qwen-turbo',
            resolvedNeeds: manyNeeds,
            sceneTypes: [],
            totalBudget: 50000,
        });
        if (result.status.level !== 'green') {
            expect(result.degradationPlan).toBeDefined();
            expect(result.degradationPlan.steps.length).toBeGreaterThan(0);
        }
    });
});
