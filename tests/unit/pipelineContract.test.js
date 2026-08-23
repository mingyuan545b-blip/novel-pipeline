/**
 * pipelineContract.test.js
 * 覆盖 pipelineContract 核心函数
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    queryItems: jest.fn()
}));

const store = require('../../server/store');
const pipelineContract = require('../../server/services/pipeline/pipelineContract');

describe('pipelineContract', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('getStepContract', () => {
        test('returns contract for known step', () => {
            const contract = pipelineContract.getStepContract('writer');
            expect(contract).toBeDefined();
        });
        test('returns empty array for unknown step', () => {
            const contract = pipelineContract.getStepContract('nonexistent-step');
            expect(contract).toEqual([]);
        });
    });

    describe('validateStepOutput', () => {
        test('validates writer output with content', () => {
            const result = pipelineContract.validateStepOutput('writer', { content: '正文内容', passed: true });
            expect(result).toBeDefined();
        });
        test('validates outline output', () => {
            const result = pipelineContract.validateStepOutput('outliner', { outline: '大纲', passed: true });
            expect(result).toBeDefined();
        });
    });

    describe('isTerminalStatus', () => {
        test('identifies approved as terminal', () => {
            expect(pipelineContract.isTerminalStatus('approved')).toBe(true);
        });
        test('identifies cooldown-waiting as terminal', () => {
            expect(pipelineContract.isTerminalStatus('cooldown-waiting')).toBe(true);
        });
        test('identifies non-terminal statuses', () => {
            expect(pipelineContract.isTerminalStatus('outlined')).toBe(false);
        });
    });

    describe('isReviewStep', () => {
        test('identifies review steps', () => {
            expect(pipelineContract.isReviewStep('first-review')).toBe(true);
        });
        test('identifies non-review steps', () => {
            expect(pipelineContract.isReviewStep('writer')).toBe(false);
        });
    });

    describe('PIPELINE_CONTRACT', () => {
        test('has STEP_ORDER', () => {
            expect(pipelineContract.PIPELINE_CONTRACT.STEP_ORDER).toBeDefined();
        });
        test('has TERMINAL_STATUSES', () => {
            expect(pipelineContract.PIPELINE_CONTRACT.TERMINAL_STATUSES).toBeDefined();
        });
    });

    describe('getNextStep', () => {
        test('returns next step for known step', () => {
            expect(pipelineContract.getNextStep('writer')).toBe('first-review');
        });
        test('returns null for last step', () => {
            expect(pipelineContract.getNextStep('consistency-constraint')).toBeNull();
        });
        test('returns null for unknown step', () => {
            expect(pipelineContract.getNextStep('unknown')).toBeNull();
        });
    });

    describe('getContractSummary', () => {
        test('returns summary with totalSteps and steps', () => {
            const summary = pipelineContract.getContractSummary();
            expect(summary.totalSteps).toBeGreaterThan(0);
            expect(summary.steps).toBeDefined();
            expect(Object.keys(summary.steps).length).toBeGreaterThan(0);
        });
        test('summary steps have code/label/severity', () => {
            const summary = pipelineContract.getContractSummary();
            for (const [step, checks] of Object.entries(summary.steps)) {
                expect(Array.isArray(checks)).toBe(true);
                for (const c of checks) {
                    expect(c.code).toBeDefined();
                    expect(c.label).toBeDefined();
                    expect(c.severity).toBeDefined();
                }
            }
        });
    });

    describe('enforceContract', () => {
        test('valid output returns passed=true', async () => {
            const result = await pipelineContract.enforceContract('p1', 'writer', { content: '正文', wordCount: 100 });
            expect(result.passed).toBe(true);
        });

        test('invalid output throws ContractViolationError', async () => {
            await expect(pipelineContract.enforceContract('p1', 'writer', {}))
                .rejects.toThrow(/failed contract validation/);
        });

        test('output=null returns invalid', async () => {
            await expect(pipelineContract.enforceContract('p1', 'writer', null))
                .rejects.toThrow(/No output provided/);
        });

        test('unknown step returns valid (no required fields)', async () => {
            const result = await pipelineContract.enforceContract('p1', 'unknown-step', { foo: 'bar' });
            expect(result.passed).toBe(true);
        });
    });

    describe('checkDataFlowIntegrity', () => {
        test('unknown steps return valid', async () => {
            const result = await pipelineContract.checkDataFlowIntegrity('p1', 'unknown-from', 'unknown-to');
            expect(result.valid).toBe(true);
        });

        test('known steps return warnings for missing inputs', async () => {
            const result = await pipelineContract.checkDataFlowIntegrity('p1', 'writer', 'first-review');
            expect(result.warnings).toBeDefined();
        });
    });

    describe('validatePipelineState', () => {
        test('empty chapters return valid', async () => {
            store.queryItems.mockResolvedValue([]);
            const result = await pipelineContract.validatePipelineState('p1');
            expect(result.valid).toBe(true);
        });

        test('chapter with content but no wordCount is invalid', async () => {
            store.queryItems.mockResolvedValue([
                { chapterNumber: 1, status: 'outlined', content: '正文' }
            ]);
            const result = await pipelineContract.validatePipelineState('p1');
            expect(result.valid).toBe(false);
            expect(result.issues.some(i => i.includes('wordCount'))).toBe(true);
        });

        test('chapter missing outline is invalid', async () => {
            store.queryItems.mockResolvedValue([
                { chapterNumber: 1, status: 'outlined' }
            ]);
            const result = await pipelineContract.validatePipelineState('p1');
            expect(result.valid).toBe(false);
            expect(result.issues.some(i => i.includes('outline'))).toBe(true);
        });

        test('terminal status chapters are skipped', async () => {
            store.queryItems.mockResolvedValue([
                { chapterNumber: 1, status: 'approved', content: '正文' }
            ]);
            const result = await pipelineContract.validatePipelineState('p1');
            expect(result.valid).toBe(true);
        });

        test('chapter 0 without outline is valid', async () => {
            store.queryItems.mockResolvedValue([
                { chapterNumber: 0, status: 'outlined' }
            ]);
            const result = await pipelineContract.validatePipelineState('p1');
            expect(result.valid).toBe(true);
        });
    });

    describe('validateStepOutput - edge cases', () => {
        test('null output returns invalid', () => {
            const result = pipelineContract.validateStepOutput('writer', null);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toBe('No output provided');
        });

        test('unknown step returns valid', () => {
            const result = pipelineContract.validateStepOutput('unknown', { foo: 'bar' });
            expect(result.valid).toBe(true);
        });

        test('missing required field returns invalid', () => {
            const result = pipelineContract.validateStepOutput('writer', { content: '正文' });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('wordCount'))).toBe(true);
        });
    });
});
