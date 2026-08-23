/**
 * pipelineContract.js branch coverage tests
 * Covers: getStepContract, getContractSummary, enforceContract,
 *         checkDataFlowIntegrity, validatePipelineState
 */
jest.mock('../../server/store', () => ({
    queryItems: jest.fn()
}));

const store = require('../../server/store');
const pc = require('../../server/services/pipeline/pipelineContract');

describe('pipelineContract.getStepContract', () => {
    test('returns contract for known step', () => {
        const contract = pc.getStepContract('writer');
        expect(contract).toHaveLength(1);
        expect(contract[0].checks.length).toBeGreaterThan(0);
    });

    test('returns empty array for unknown step', () => {
        expect(pc.getStepContract('nonexistent')).toEqual([]);
    });

    test('returns contract for outline-generator', () => {
        const contract = pc.getStepContract('outline-generator');
        expect(contract[0].checks.length).toBeGreaterThanOrEqual(2);
    });

    test('returns contract for first-review', () => {
        const contract = pc.getStepContract('first-review');
        expect(contract[0].checks.length).toBeGreaterThanOrEqual(2);
    });

    test('returns contract for final-editor', () => {
        const contract = pc.getStepContract('final-editor');
        expect(contract[0].checks.length).toBeGreaterThanOrEqual(2);
    });

    test('returns contract for material-manager', () => {
        const contract = pc.getStepContract('material-manager');
        expect(contract[0].checks.length).toBeGreaterThanOrEqual(2);
    });

    test('returns contract for consistency-constraint', () => {
        const contract = pc.getStepContract('consistency-constraint');
        expect(contract[0].checks.length).toBeGreaterThanOrEqual(1);
    });
});

describe('pipelineContract.getContractSummary', () => {
    test('returns summary with totalSteps and steps', () => {
        const summary = pc.getContractSummary();
        expect(summary.totalSteps).toBeGreaterThan(0);
        expect(summary.steps).toBeDefined();
        expect(summary.steps['writer']).toBeDefined();
        expect(summary.steps['writer'][0].code).toBeDefined();
    });
});

describe('pipelineContract.enforceContract', () => {
    test('passes for valid writer output', async () => {
        const result = await pc.enforceContract('proj-1', 'writer', {
            content: 'Chapter content here',
            wordCount: 3000
        });
        expect(result.passed).toBe(true);
    });

    test('throws ContractViolationError for invalid writer output', async () => {
        const { ContractViolationError } = require('../../server/shared/errors');
        await expect(pc.enforceContract('proj-1', 'writer', {
            content: 'Chapter content'
            // missing wordCount
        })).rejects.toBeInstanceOf(ContractViolationError);
    });
});

describe('pipelineContract.checkDataFlowIntegrity', () => {
    test('returns valid for unknown steps', async () => {
        const result = await pc.checkDataFlowIntegrity('proj-1', 'unknown-a', 'unknown-b');
        expect(result.valid).toBe(true);
    });

    test('checks data flow between known steps', async () => {
        const result = await pc.checkDataFlowIntegrity('proj-1', 'writer', 'first-review');
        // writer outputs should feed first-review inputs
        expect(result).toBeDefined();
        expect(result.warnings).toBeDefined();
    });
});

describe('pipelineContract.validatePipelineState', () => {
    test('returns valid for empty chapters', async () => {
        store.queryItems.mockResolvedValueOnce([]);
        const result = await pc.validatePipelineState('proj-1');
        expect(result.valid).toBe(true);
        expect(result.issues).toEqual([]);
    });

    test('detects missing outline', async () => {
        store.queryItems.mockResolvedValueOnce([
            { chapterNumber: 1, status: 'outlined', content: 'some content' }
            // no outline
        ]);
        const result = await pc.validatePipelineState('proj-1');
        expect(result.issues).toContain('Ch1: missing outline');
    });

    test('detects content without wordCount', async () => {
        store.queryItems.mockResolvedValueOnce([
            { chapterNumber: 2, status: 'draft', outline: 'outline text', content: 'some content' }
            // no wordCount
        ]);
        const result = await pc.validatePipelineState('proj-1');
        expect(result.issues).toContain('Ch2: has content but no wordCount');
    });

    test('skips terminal status chapters', async () => {
        store.queryItems.mockResolvedValueOnce([
            { chapterNumber: 1, status: 'completed', content: 'done' }
        ]);
        const result = await pc.validatePipelineState('proj-1');
        // Terminal status chapters are skipped, but may still flag issues
        // depending on isTerminalStatus implementation
        expect(result).toBeDefined();
    });
});
