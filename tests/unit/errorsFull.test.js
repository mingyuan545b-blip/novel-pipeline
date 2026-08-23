const {
    AppError, DomainError, InfrastructureError, ValidationError,
    NotFoundError, StateTransitionError, PipelineError,
    LLMOverloadedError, LLMTimeoutError, ContextOverflowError,
    ReviewRejectionError, PipelineStoppedError, StorageError,
    ConcurrencyError, DataCorruptionError, AuthError,
    classifyLLMError, isLLMOverloaded, isLLMTimeout,
    isCodeBug, isNetworkError, isContextOverflow,
    OVERLOAD_PATTERNS, TIMEOUT_PATTERNS, CONTEXT_OVERFLOW_PATTERNS
} = require('../../server/shared/errors');

describe('errors', () => {
    describe('Error classes', () => {
        test('AppError has code, statusCode, timestamp', () => {
            const err = new AppError('test', 'TEST_CODE', 500);
            expect(err.message).toBe('test');
            expect(err.code).toBe('TEST_CODE');
            expect(err.statusCode).toBe(500);
            expect(err.timestamp).toBeDefined();
        });

        test('DomainError defaults to 422', () => {
            const err = new DomainError('domain issue', 'DOMAIN_ERR');
            expect(err.statusCode).toBe(422);
        });

        test('InfrastructureError defaults to 500', () => {
            const err = new InfrastructureError('infra issue', 'INFRA_ERR');
            expect(err.statusCode).toBe(500);
        });

        test('ValidationError has field', () => {
            const err = new ValidationError('invalid', 'name');
            expect(err.code).toBe('VALIDATION_ERROR');
            expect(err.statusCode).toBe(400);
            expect(err.field).toBe('name');
        });

        test('NotFoundError has resource and id', () => {
            const err = new NotFoundError('Project', 'p1');
            expect(err.code).toBe('NOT_FOUND');
            expect(err.statusCode).toBe(404);
            expect(err.resource).toBe('Project');
            expect(err.resourceId).toBe('p1');
        });

        test('StateTransitionError has from/to', () => {
            const err = new StateTransitionError('draft', 'approved', 'missing review');
            expect(err.code).toBe('INVALID_TRANSITION');
            expect(err.fromState).toBe('draft');
            expect(err.toState).toBe('approved');
        });

        test('PipelineError is not retryable', () => {
            const err = new PipelineError('pipeline failed');
            expect(err.retryable).toBe(false);
            expect(err.code).toBe('PIPELINE_ERROR');
        });

        test('LLMOverloadedError is retryable', () => {
            const err = new LLMOverloadedError('overloaded');
            expect(err.retryable).toBe(true);
            expect(err.code).toBe('LLM_OVERLOADED');
        });

        test('LLMTimeoutError is retryable', () => {
            const err = new LLMTimeoutError('timeout');
            expect(err.retryable).toBe(true);
            expect(err.code).toBe('LLM_TIMEOUT');
        });

        test('ContextOverflowError has tokens info', () => {
            const err = new ContextOverflowError('overflow', 8000, 4096);
            expect(err.retryable).toBe(false);
            expect(err.estimatedTokens).toBe(8000);
            expect(err.budget).toBe(4096);
        });

        test('ReviewRejectionError has reviewOutput', () => {
            const err = new ReviewRejectionError('rejected', 'review text', 'minor');
            expect(err.reviewOutput).toBe('review text');
            expect(err.overrideType).toBe('minor');
        });

        test('PipelineStoppedError has projectId', () => {
            const err = new PipelineStoppedError('proj1');
            expect(err.projectId).toBe('proj1');
        });

        test('AuthError has 401 status', () => {
            const err = new AuthError('unauthorized');
            expect(err.statusCode).toBe(401);
        });

        test('ConcurrencyError defaults message', () => {
            const err = new ConcurrencyError();
            expect(err.message).toContain('Concurrent');
            expect(err.code).toBe('CONCURRENCY_ERROR');
        });

        test('DataCorruptionError has type and id', () => {
            const err = new DataCorruptionError('corrupt', 'chapters', 'c1');
            expect(err.dataType).toBe('chapters');
            expect(err.dataId).toBe('c1');
        });
    });

    describe('classifyLLMError', () => {
        test('classifies overload by status 529', () => {
            const err = new Error('server busy');
            err.status = 529;
            const result = classifyLLMError(err);
            expect(result).toBeInstanceOf(LLMOverloadedError);
        });

        test('classifies overload by message', () => {
            const err = new Error('throttling: usage allocated quota exceeded');
            const result = classifyLLMError(err);
            expect(result).toBeInstanceOf(LLMOverloadedError);
        });

        test('classifies timeout by message', () => {
            const err = new Error('request timed out');
            const result = classifyLLMError(err);
            expect(result).toBeInstanceOf(LLMTimeoutError);
        });

        test('classifies context overflow by message', () => {
            const err = new Error('context_length_exceeded');
            const result = classifyLLMError(err);
            expect(result).toBeInstanceOf(ContextOverflowError);
        });

        test('returns original error for unknown', () => {
            const err = new Error('something else');
            const result = classifyLLMError(err);
            expect(result).toBe(err);
        });
    });

    describe('isLLMOverloaded', () => {
        test('detects LLMOverloadedError instance', () => {
            expect(isLLMOverloaded(new LLMOverloadedError('test'))).toBe(true);
        });

        test('detects by status code', () => {
            const err = { message: '', status: 529 };
            expect(isLLMOverloaded(err)).toBe(true);
        });

        test('detects by message pattern', () => {
            expect(isLLMOverloaded({ message: 'rate limit exceeded' })).toBe(true);
        });

        test('returns false for normal error', () => {
            expect(isLLMOverloaded(new Error('normal'))).toBe(false);
        });
    });

    describe('isLLMTimeout', () => {
        test('detects timeout message', () => {
            expect(isLLMTimeout({ message: 'request timeout' })).toBe(true);
        });

        test('returns false for non-timeout', () => {
            expect(isLLMTimeout({ message: 'normal error' })).toBe(false);
        });
    });

    describe('isCodeBug', () => {
        test('detects ReferenceError', () => {
            expect(isCodeBug({ message: 'x is not defined' })).toBe(true);
        });

        test('detects TypeError', () => {
            expect(isCodeBug({ message: 'cannot read property of undefined' })).toBe(true);
        });

        test('returns false for normal error', () => {
            expect(isCodeBug({ message: 'API error' })).toBe(false);
        });
    });

    describe('isNetworkError', () => {
        test('detects ECONNRESET', () => {
            expect(isNetworkError({ message: 'ECONNRESET' })).toBe(true);
        });

        test('detects fetch failed', () => {
            expect(isNetworkError({ message: 'fetch failed' })).toBe(true);
        });

        test('returns false for non-network', () => {
            expect(isNetworkError({ message: 'normal error' })).toBe(false);
        });
    });

    describe('isContextOverflow', () => {
        test('detects ContextOverflowError instance', () => {
            expect(isContextOverflow(new ContextOverflowError('overflow'))).toBe(true);
        });

        test('detects by isContextOverflow flag', () => {
            expect(isContextOverflow({ message: 'err', isContextOverflow: true })).toBe(true);
        });

        test('detects by message', () => {
            expect(isContextOverflow({ message: 'context_length_exceeded' })).toBe(true);
        });
    });

    describe('pattern constants', () => {
        test('OVERLOAD_PATTERNS includes throttling', () => {
            expect(OVERLOAD_PATTERNS).toContain('throttling');
        });

        test('TIMEOUT_PATTERNS includes timeout', () => {
            expect(TIMEOUT_PATTERNS).toContain('timeout');
        });

        test('CONTEXT_OVERFLOW_PATTERNS includes context_length', () => {
            expect(CONTEXT_OVERFLOW_PATTERNS).toContain('context_length');
        });
    });
});
