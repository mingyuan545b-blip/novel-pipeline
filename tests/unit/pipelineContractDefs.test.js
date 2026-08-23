const { PIPELINE_CONTRACT, validateStepOutput, isTerminalStatus, isReviewStep, getNextStep } = require('../../server/services/pipeline/pipelineContractDefs');

describe('pipelineContractDefs', () => {
    describe('PIPELINE_CONTRACT', () => {
        test('has VERSION', () => {
            expect(PIPELINE_CONTRACT.VERSION).toBe('3.0');
        });

        test('has STEP_ORDER with all steps', () => {
            expect(PIPELINE_CONTRACT.STEP_ORDER).toContain('outline-generator');
            expect(PIPELINE_CONTRACT.STEP_ORDER).toContain('writer');
            expect(PIPELINE_CONTRACT.STEP_ORDER).toContain('first-review');
            expect(PIPELINE_CONTRACT.STEP_ORDER).toContain('final-editor');
            expect(PIPELINE_CONTRACT.STEP_ORDER).toContain('polisher');
            expect(PIPELINE_CONTRACT.STEP_ORDER).toContain('material-manager');
        });

        test('has TERMINAL_STATUSES', () => {
            expect(PIPELINE_CONTRACT.TERMINAL_STATUSES).toContain('approved');
            expect(PIPELINE_CONTRACT.TERMINAL_STATUSES).toContain('cooldown-waiting');
        });

        test('has REVIEW_STATUSES', () => {
            expect(PIPELINE_CONTRACT.REVIEW_STATUSES).toContain('first-review');
            expect(PIPELINE_CONTRACT.REVIEW_STATUSES).toContain('second-review');
        });

        test('has REQUIRED_OUTPUT_FIELDS for all steps', () => {
            for (const step of PIPELINE_CONTRACT.STEP_ORDER) {
                expect(PIPELINE_CONTRACT.REQUIRED_OUTPUT_FIELDS[step]).toBeDefined();
                expect(Array.isArray(PIPELINE_CONTRACT.REQUIRED_OUTPUT_FIELDS[step])).toBe(true);
            }
        });

        test('has word count limits', () => {
            expect(PIPELINE_CONTRACT.MAX_WORD_COUNT).toBeGreaterThan(0);
            expect(PIPELINE_CONTRACT.MIN_WORD_COUNT).toBeGreaterThan(0);
            expect(PIPELINE_CONTRACT.MAX_WORD_COUNT).toBeGreaterThan(PIPELINE_CONTRACT.MIN_WORD_COUNT);
        });
    });

    describe('validateStepOutput', () => {
        test('returns invalid for null output', () => {
            const result = validateStepOutput('writer', null);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('No output provided');
        });

        test('returns valid for unknown step', () => {
            const result = validateStepOutput('unknown-step', { foo: 'bar' });
            expect(result.valid).toBe(true);
        });

        test('validates writer output', () => {
            const result = validateStepOutput('writer', { content: 'text', wordCount: 2000 });
            expect(result.valid).toBe(true);
        });

        test('detects missing writer fields', () => {
            const result = validateStepOutput('writer', { content: 'text' });
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('wordCount');
        });

        test('validates outline-generator output', () => {
            const result = validateStepOutput('outline-generator', { outlines: [] });
            expect(result.valid).toBe(true);
        });

        test('validates review output', () => {
            const result = validateStepOutput('first-review', { passed: true, issues: [] });
            expect(result.valid).toBe(true);
        });

        test('detects missing review fields', () => {
            const result = validateStepOutput('first-review', { passed: true });
            expect(result.valid).toBe(false);
        });
    });

    describe('isTerminalStatus', () => {
        test('approved is terminal', () => {
            expect(isTerminalStatus('approved')).toBe(true);
        });

        test('cooldown-waiting is terminal', () => {
            expect(isTerminalStatus('cooldown-waiting')).toBe(true);
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
        test('returns next step in order', () => {
            expect(getNextStep('outline-generator')).toBe('writer');
            expect(getNextStep('writer')).toBe('first-review');
        });

        test('returns null for last step', () => {
            expect(getNextStep('consistency-constraint')).toBeNull();
        });

        test('returns null for unknown step', () => {
            expect(getNextStep('unknown')).toBeNull();
        });
    });
});
