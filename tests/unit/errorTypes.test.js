const {
    PipelineError, LLMOverloadedError, LLMTimeoutError, ContextOverflowError,
    ReviewRejectionError, PipelineStoppedError, StorageError, ConcurrencyError,
    DataCorruptionError, AuthError, classifyLLMError
} = require('../../server/shared/errors');

describe('Error type hierarchy', () => {
    test('LLMOverloadedError is instanceof PipelineError', () => {
        const err = new LLMOverloadedError('test');
        expect(err instanceof PipelineError).toBe(true);
        expect(err instanceof Error).toBe(true);
        expect(err.retryable).toBe(true);
        expect(err.code).toBe('LLM_OVERLOADED');
    });

    test('LLMTimeoutError is instanceof PipelineError', () => {
        const err = new LLMTimeoutError('test');
        expect(err instanceof PipelineError).toBe(true);
        expect(err.retryable).toBe(true);
        expect(err.code).toBe('LLM_TIMEOUT');
    });

    test('ContextOverflowError is instanceof PipelineError', () => {
        const err = new ContextOverflowError('test', 100000, 8000);
        expect(err instanceof PipelineError).toBe(true);
        expect(err.retryable).toBe(false);
        expect(err.estimatedTokens).toBe(100000);
        expect(err.budget).toBe(8000);
    });

    test('ReviewRejectionError has reviewOutput', () => {
        const err = new ReviewRejectionError('bad', 'review text', 'dialect');
        expect(err.reviewOutput).toBe('review text');
        expect(err.overrideType).toBe('dialect');
    });

    test('PipelineStoppedError has projectId', () => {
        const err = new PipelineStoppedError('proj-123');
        expect(err.projectId).toBe('proj-123');
        expect(err.code).toBe('PIPELINE_STOPPED');
    });

    test('ConcurrencyError is instanceof StorageError', () => {
        const err = new ConcurrencyError();
        expect(err instanceof StorageError).toBe(true);
        expect(err.code).toBe('CONCURRENCY_ERROR');
    });

    test('DataCorruptionError has type and id', () => {
        const err = new DataCorruptionError('corrupt', 'chapters', 'ch-1');
        expect(err.dataType).toBe('chapters');
        expect(err.dataId).toBe('ch-1');
    });

    test('AuthError has statusCode 401', () => {
        const err = new AuthError('bad token');
        expect(err.statusCode).toBe(401);
    });
});

describe('classifyLLMError', () => {
    test('classifies 529 as LLMOverloadedError', () => {
        const original = new Error('Server returned 529');
        original.status = 529;
        const classified = classifyLLMError(original);
        expect(classified instanceof LLMOverloadedError).toBe(true);
    });

    test('classifies overload message as LLMOverloadedError', () => {
        const original = new Error('Service overloaded');
        const classified = classifyLLMError(original);
        expect(classified instanceof LLMOverloadedError).toBe(true);
    });

    test('classifies timeout as LLMTimeoutError', () => {
        const original = new Error('Request timed out');
        const classified = classifyLLMError(original);
        expect(classified instanceof LLMTimeoutError).toBe(true);
    });

    test('classifies context overflow as ContextOverflowError', () => {
        const original = new Error('context_length_exceeded');
        original.status = 400;
        const classified = classifyLLMError(original);
        expect(classified instanceof ContextOverflowError).toBe(true);
    });

    test('returns original error for unknown errors', () => {
        const original = new Error('Some random error');
        const classified = classifyLLMError(original);
        expect(classified).toBe(original);
    });
});
