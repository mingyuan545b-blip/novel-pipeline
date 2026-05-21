const {
    formatReviewFeedback,
    classifyError,
    checkWordCountHardGate,
    preflightMaterialCheck
} = require('../../server/services/pipeline/pipelinePhases');

describe('pipelinePhases', () => {
    describe('formatReviewFeedback', () => {
        test('formats feedback with summary, issues, and suggestions', () => {
            const feedback = {
                summary: 'Test summary',
                issues: [
                    { description: 'Issue 1', severity: 'critical' },
                    { description: 'Issue 2', severity: 'major' }
                ],
                suggestions: ['Fix issue 1', 'Fix issue 2']
            };
            const result = formatReviewFeedback(feedback);
            expect(result).toContain('【总结】Test summary');
            expect(result).toContain('【必须修改的问题】');
            expect(result).toContain('1. [critical] Issue 1');
            expect(result).toContain('2. [major] Issue 2');
            expect(result).toContain('【修改建议】');
            expect(result).toContain('1. Fix issue 1');
        });

        test('handles empty feedback', () => {
            expect(formatReviewFeedback(null)).toBe('');
            expect(formatReviewFeedback({})).toBe('');
        });

        test('handles feedback with only summary', () => {
            const result = formatReviewFeedback({ summary: 'Only summary' });
            expect(result).toBe('【总结】Only summary');
        });

        test('handles string issues', () => {
            const feedback = {
                issues: ['String issue 1', 'String issue 2']
            };
            const result = formatReviewFeedback(feedback);
            expect(result).toContain('1.  String issue 1');
            expect(result).toContain('2.  String issue 2');
        });
    });

    describe('classifyError', () => {
        test('identifies overloaded errors', () => {
            expect(classifyError({ message: 'Server 529 error' }).isOverloaded).toBe(true);
            expect(classifyError({ message: 'rate limit exceeded' }).isOverloaded).toBe(true);
            expect(classifyError({ message: '负载较高' }).isOverloaded).toBe(true);
            expect(classifyError({ message: 'normal error' }).isOverloaded).toBe(false);
        });

        test('identifies context overflow errors', () => {
            expect(classifyError({ message: 'CONTEXT_OVERFLOW detected', isContextOverflow: false }).isContextErr).toBe(true);
            expect(classifyError({ message: 'context_length exceeded', isContextOverflow: false }).isContextErr).toBe(true);
            expect(classifyError({ message: 'normal', isContextOverflow: true }).isContextErr).toBe(true);
            expect(classifyError({ message: 'normal error' }).isContextErr).toBe(false);
        });

        test('identifies timeout errors', () => {
            expect(classifyError({ message: '请求超时' }).isTimeout).toBe(true);
            expect(classifyError({ message: 'timeout occurred' }).isTimeout).toBe(true);
            expect(classifyError({ message: 'ETIMEDOUT' }).isTimeout).toBe(true);
            expect(classifyError({ message: 'request aborted' }).isTimeout).toBe(true);
            expect(classifyError({ message: 'normal error' }).isTimeout).toBe(false);
        });

        test('no false positives for normal errors', () => {
            const result = classifyError({ message: 'Something went wrong' });
            expect(result.isOverloaded).toBe(false);
            expect(result.isContextErr).toBe(false);
            expect(result.isTimeout).toBe(false);
        });
    });

    describe('checkWordCountHardGate', () => {
        test('returns null for non-review steps', () => {
            expect(checkWordCountHardGate(1000, 1800, 3500, 'writer')).toBeNull();
            expect(checkWordCountHardGate(1000, 1800, 3500, 'reviser')).toBeNull();
            expect(checkWordCountHardGate(1000, 1800, 3500, 'final-editor')).toBeNull();
        });

        test('returns under-limit gate for review steps with low word count', () => {
            const result = checkWordCountHardGate(1500, 1800, 3500, 'first-review');
            expect(result).not.toBeNull();
            expect(result.passed).toBe(false);
            expect(result.type).toBe('under');
            expect(result.feedback.issues[0].severity).toBe('critical');
        });

        test('returns over-limit gate for review steps with high word count', () => {
            const result = checkWordCountHardGate(4000, 1800, 3500, 'fast-review');
            expect(result).not.toBeNull();
            expect(result.passed).toBe(false);
            expect(result.type).toBe('over');
        });

        test('returns null for word count within range', () => {
            expect(checkWordCountHardGate(2500, 1800, 3500, 'second-review')).toBeNull();
        });

        test('works for all review step types', () => {
            const steps = ['first-review', 'fast-review', 'second-review'];
            for (const step of steps) {
                const result = checkWordCountHardGate(1500, 1800, 3500, step);
                expect(result).not.toBeNull();
                expect(result.passed).toBe(false);
            }
        });
    });
});
