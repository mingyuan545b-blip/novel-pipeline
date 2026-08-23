const {
    getStepContract, enforceContract, checkDataFlowIntegrity, validatePipelineState,
    validateStepOutput, isTerminalStatus, isReviewStep, getNextStep
} = require('../../server/services/pipeline/pipelineContract');

describe('pipelineContract - extended', () => {
    describe('getStepContract', () => {
        test('returns contract for writer step', () => {
            const contract = getStepContract('writer');
            expect(contract.length).toBeGreaterThan(0);
            expect(contract[0].checks.length).toBeGreaterThan(0);
        });
        test('returns contract for outline-generator step', () => {
            const contract = getStepContract('outline-generator');
            expect(contract.length).toBeGreaterThan(0);
        });
        test('returns empty for unknown step', () => {
            expect(getStepContract('unknown-step')).toEqual([]);
        });
        test('writer WR-IN-001 passes with outline', () => {
            const contract = getStepContract('writer');
            const check = contract[0].checks.find(c => c.code === 'WR-IN-001');
            expect(check.check({ chapter: { outline: '大纲' } })).toBeTruthy();
        });
        test('writer WR-IN-001 fails without outline', () => {
            const contract = getStepContract('writer');
            const check = contract[0].checks.find(c => c.code === 'WR-IN-001');
            expect(check.check({ chapter: {} })).toBeFalsy();
        });
        test('writer WR-IN-003 fails without project', () => {
            const contract = getStepContract('writer');
            const check = contract[0].checks.find(c => c.code === 'WR-IN-003');
            expect(check.check({})).toBeFalsy();
        });
        test('first-review FR-IN-001 passes with content', () => {
            const contract = getStepContract('first-review');
            const check = contract[0].checks.find(c => c.code === 'FR-IN-001');
            expect(check.check({ chapter: { content: '内容' } })).toBeTruthy();
        });
        test('second-review SR-IN-002 passes with firstReviewOutput', () => {
            const contract = getStepContract('second-review');
            const check = contract[0].checks.find(c => c.code === 'SR-IN-002');
            expect(check.check({ chapter: { firstReviewOutput: '初审结果' } })).toBeTruthy();
        });
        test('material-manager MM-IN-002 passes with materials', () => {
            const contract = getStepContract('material-manager');
            const check = contract[0].checks.find(c => c.code === 'MM-IN-002');
            expect(check.check({ materials: [] })).toBe(true);
        });
    });

    describe('enforceContract', () => {
        test('enforceContract returns passed for valid writer output', async () => {
            const result = await enforceContract('p1', 'writer', { content: 'a'.repeat(500), wordCount: 500 });
            expect(result.passed).toBe(true);
        });
        test('throws ContractViolationError for invalid writer output', async () => {
            const { ContractViolationError } = require('../../server/shared/errors');
            await expect(enforceContract('p1', 'writer', {})).rejects.toBeInstanceOf(ContractViolationError);
        });
    });

    describe('checkDataFlowIntegrity', () => {
        test('returns valid for unknown steps', async () => {
            const result = await checkDataFlowIntegrity('p1', 'unknown-from', 'unknown-to');
            expect(result.valid).toBe(true);
        });
    });

    describe('validateStepOutput', () => {
        test('returns valid for unknown step', () => {
            const result = validateStepOutput('unknown-step', {});
            expect(result.valid).toBe(true);
        });
    });

    describe('isTerminalStatus', () => {
        test('approved is terminal', () => {
            expect(isTerminalStatus('approved')).toBe(true);
        });
        test('outlined is not terminal', () => {
            expect(isTerminalStatus('outlined')).toBe(false);
        });
    });

    describe('isReviewStep', () => {
        test('first-review is review step', () => {
            expect(isReviewStep('first-review')).toBe(true);
        });
        test('writer is not review step', () => {
            expect(isReviewStep('writer')).toBe(false);
        });
    });

    describe('getNextStep', () => {
        test('writer leads to first-review', () => {
            expect(getNextStep('writer')).toBe('first-review');
        });
        test('unknown step returns null', () => {
            expect(getNextStep('unknown')).toBeNull();
        });
    });
});
