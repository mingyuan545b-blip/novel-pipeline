/**
 * pipelinePhases tests - Pipeline阶段辅助函数
 */
const { formatReviewFeedback, classifyError, checkWordCountHardGate, preflightMaterialCheck } = require('../../server/services/pipeline/pipelinePhases');

describe('pipelinePhases', () => {
    describe('formatReviewFeedback', () => {
        it('should return empty string for null feedback', () => {
            expect(formatReviewFeedback(null)).toBe('');
        });

        it('should format summary only', () => {
            expect(formatReviewFeedback({ summary: 'Test' })).toBe('【总结】Test');
        });

        it('should format issues with severity', () => {
            const fb = {
                issues: [
                    { severity: 'critical', description: 'Issue 1' },
                    'Issue 2'
                ]
            };
            const result = formatReviewFeedback(fb);
            expect(result).toContain('[critical] Issue 1');
            expect(result).toContain('Issue 2');
        });

        it('should format suggestions', () => {
            const fb = { suggestions: ['Add more detail', 'Fix dialogue'] };
            const result = formatReviewFeedback(fb);
            expect(result).toContain('Add more detail');
            expect(result).toContain('Fix dialogue');
        });
    });

    describe('classifyError', () => {
        it('should classify throttling as overloaded', () => {
            const err = new Error('throttling: usage allocated quota exceeded');
            const result = classifyError(err);
            expect(result.isOverloaded).toBe(true);
        });

        it('should classify timeout error', () => {
            const err = new Error('Request timeout after 30000ms');
            const result = classifyError(err);
            expect(result.isTimeout).toBe(true);
        });

        it('should classify normal error as none', () => {
            const err = new Error('Something went wrong');
            const result = classifyError(err);
            expect(result.isOverloaded).toBe(false);
            expect(result.isContextErr).toBe(false);
            expect(result.isTimeout).toBe(false);
        });
    });

    describe('checkWordCountHardGate', () => {
        it('should return null for non-review steps', () => {
            expect(checkWordCountHardGate(100, 1500, 5000, 'writer')).toBeNull();
        });

        it('should block under-min word count for review steps', () => {
            const result = checkWordCountHardGate(800, 1500, 5000, 'first-review');
            expect(result).toBeDefined();
            expect(result.passed).toBe(false);
            expect(result.type).toBe('under');
        });

        it('should block over-max word count for review steps', () => {
            const result = checkWordCountHardGate(6000, 1500, 5000, 'fast-review');
            expect(result).toBeDefined();
            expect(result.passed).toBe(false);
            expect(result.type).toBe('over');
        });

        it('should pass for valid word count', () => {
            const result = checkWordCountHardGate(2500, 1500, 5000, 'second-review');
            expect(result).toBeNull();
        });
    });

    describe('preflightMaterialCheck', () => {
        it('should return ok for empty materials', () => {
            expect(preflightMaterialCheck([], 'writer').ok).toBe(true);
        });

        it('should return ok for null materials', () => {
            expect(preflightMaterialCheck(null, 'writer').ok).toBe(true);
        });
    });
});
