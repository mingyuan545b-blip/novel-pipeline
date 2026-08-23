jest.mock('../../server/services/pipeline/pipelineHelpers', () => ({
    checkWordCountHardLimit: jest.fn(),
    formatFeedbackText: jest.fn(feedback => feedback?.summary || ''),
    runPostApproval: jest.fn()
}));

jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    queryItems: jest.fn(() => []),
    isFoundationMaterial: jest.fn()
}));

const { classifyError } = require('../../server/core/pipeline/errorRecovery');

describe('Pipeline Decomposition - ErrorRecovery', () => {
    test('classifyError identifies 529 overload', () => {
        const error = new Error('Service 529 overloaded');
        const result = classifyError(error, 'writer');
        expect(result.isOverloaded).toBe(true);
        expect(result.isContextErr).toBe(false);
        expect(result.isTimeout).toBe(false);
        expect(result.errorDetail).toContain('限流');
    });

    test('classifyError identifies context overflow', () => {
        const error = new Error('CONTEXT_OVERFLOW exceeded');
        const result = classifyError(error, 'writer');
        expect(result.isOverloaded).toBe(false);
        expect(result.isContextErr).toBe(true);
        expect(result.errorDetail).toContain('上下文溢出');
    });

    test('classifyError identifies timeout', () => {
        const error = new Error('Request timeout after 30000ms');
        const result = classifyError(error, 'first-review');
        expect(result.isTimeout).toBe(true);
        expect(result.errorDetail).toContain('超时');
    });

    test('classifyError identifies rate limit as overload', () => {
        const error = new Error('rate limit exceeded');
        const result = classifyError(error, 'writer');
        expect(result.isOverloaded).toBe(true);
    });

    test('classifyError identifies 2064 error code as overload', () => {
        const error = new Error('Error 2064: service busy');
        const result = classifyError(error, 'writer');
        expect(result.isOverloaded).toBe(true);
    });

    test('classifyError handles unknown errors', () => {
        const error = new Error('Something went wrong');
        const result = classifyError(error, 'writer');
        expect(result.isOverloaded).toBe(false);
        expect(result.isContextErr).toBe(false);
        expect(result.isTimeout).toBe(false);
        expect(result.errorDetail).toContain('Something went wrong');
    });

    test('classifyError uses step parameter in error detail', () => {
        const error = new Error('529');
        const result = classifyError(error, 'second-review');
        expect(result.errorDetail).toContain('second-review');
    });

    test('classifyError falls back to error._step when step not provided', () => {
        const error = new Error('529');
        error._step = 'final-editor';
        const result = classifyError(error);
        expect(result.errorDetail).toContain('final-editor');
    });

    test('classifyError identifies ETIMEDOUT as timeout', () => {
        const error = new Error('ETIMEDOUT connection failed');
        const result = classifyError(error, 'writer');
        expect(result.isTimeout).toBe(true);
    });

    test('classifyError identifies isContextOverflow flag', () => {
        const error = new Error('generic error');
        error.isContextOverflow = true;
        const result = classifyError(error, 'writer');
        expect(result.isContextErr).toBe(true);
    });
});
