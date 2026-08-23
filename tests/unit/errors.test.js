const {
    AppError, DomainError, InfrastructureError, ValidationError, NotFoundError,
    StateTransitionError, PipelineError, LLMOverloadedError, LLMTimeoutError,
    ContextOverflowError, ReviewRejectionError, PipelineStoppedError,
    StorageError, ConcurrencyError, DataCorruptionError, AuthError,
    classifyLLMError, isLLMOverloaded, isLLMTimeout, isCodeBug, isNetworkError, isContextOverflow
} = require('../../server/shared/errors');

describe('errors', () => {
    describe('AppError', () => {
        test('has code, statusCode, timestamp', () => {
            const err = new AppError('test', 'TEST_CODE', 500);
            expect(err.message).toBe('test');
            expect(err.code).toBe('TEST_CODE');
            expect(err.statusCode).toBe(500);
            expect(err.timestamp).toBeDefined();
        });
    });

    describe('DomainError', () => {
        test('defaults to 422', () => {
            const err = new DomainError('test', 'DOMAIN');
            expect(err.statusCode).toBe(422);
        });
    });

    describe('InfrastructureError', () => {
        test('defaults to 500', () => {
            const err = new InfrastructureError('test', 'INFRA');
            expect(err.statusCode).toBe(500);
        });
    });

    describe('ValidationError', () => {
        test('has field property', () => {
            const err = new ValidationError('invalid', 'email');
            expect(err.statusCode).toBe(400);
            expect(err.code).toBe('VALIDATION_ERROR');
            expect(err.field).toBe('email');
        });
    });

    describe('NotFoundError', () => {
        test('formats message with resource and id', () => {
            const err = new NotFoundError('Project', '123');
            expect(err.message).toContain('Project');
            expect(err.message).toContain('123');
            expect(err.statusCode).toBe(404);
            expect(err.resource).toBe('Project');
            expect(err.resourceId).toBe('123');
        });
    });

    describe('StateTransitionError', () => {
        test('has fromState and toState', () => {
            const err = new StateTransitionError('outlined', 'completed', 'skip steps');
            expect(err.fromState).toBe('outlined');
            expect(err.toState).toBe('completed');
            expect(err.code).toBe('INVALID_TRANSITION');
        });
    });

    describe('LLMOverloadedError', () => {
        test('is retryable', () => {
            const err = new LLMOverloadedError('overloaded');
            expect(err.retryable).toBe(true);
            expect(err.code).toBe('LLM_OVERLOADED');
        });
    });

    describe('LLMTimeoutError', () => {
        test('is retryable', () => {
            const err = new LLMTimeoutError('timed out');
            expect(err.retryable).toBe(true);
            expect(err.code).toBe('LLM_TIMEOUT');
        });
    });

    describe('ContextOverflowError', () => {
        test('is not retryable', () => {
            const err = new ContextOverflowError('overflow', 8000, 4096);
            expect(err.retryable).toBe(false);
            expect(err.estimatedTokens).toBe(8000);
            expect(err.budget).toBe(4096);
        });
    });

    describe('ReviewRejectionError', () => {
        test('has reviewOutput', () => {
            const err = new ReviewRejectionError('rejected', 'review text', 'word-count');
            expect(err.reviewOutput).toBe('review text');
            expect(err.overrideType).toBe('word-count');
        });
    });

    describe('PipelineStoppedError', () => {
        test('includes projectId', () => {
            const err = new PipelineStoppedError('proj-1');
            expect(err.projectId).toBe('proj-1');
            expect(err.code).toBe('PIPELINE_STOPPED');
        });
    });

    describe('ConcurrencyError', () => {
        test('has default message', () => {
            const err = new ConcurrencyError();
            expect(err.message).toContain('Concurrent');
            expect(err.code).toBe('CONCURRENCY_ERROR');
        });
    });

    describe('DataCorruptionError', () => {
        test('has dataType and dataId', () => {
            const err = new DataCorruptionError('corrupt', 'chapters', 'ch-1');
            expect(err.dataType).toBe('chapters');
            expect(err.dataId).toBe('ch-1');
        });
    });

    describe('AuthError', () => {
        test('has 401 status', () => {
            const err = new AuthError('unauthorized');
            expect(err.statusCode).toBe(401);
        });
    });

    describe('classifyLLMError', () => {
        test('classifies overload error', () => {
            const err = new Error('throttling: quota exceeded');
            const result = classifyLLMError(err);
            expect(result).toBeInstanceOf(LLMOverloadedError);
        });

        test('classifies timeout error', () => {
            const err = new Error('request timed out');
            const result = classifyLLMError(err);
            expect(result).toBeInstanceOf(LLMTimeoutError);
        });

        test('classifies context overflow', () => {
            const err = new Error('context_length_exceeded');
            const result = classifyLLMError(err);
            expect(result).toBeInstanceOf(ContextOverflowError);
        });

        test('returns original error for unknown', () => {
            const err = new Error('unknown error');
            const result = classifyLLMError(err);
            expect(result).toBe(err);
        });

        test('classifies by status code 529', () => {
            const err = new Error('error');
            err.status = 529;
            const result = classifyLLMError(err);
            expect(result).toBeInstanceOf(LLMOverloadedError);
        });
    });

    describe('isLLMOverloaded', () => {
        test('returns true for LLMOverloadedError', () => {
            expect(isLLMOverloaded(new LLMOverloadedError('test'))).toBe(true);
        });

        test('returns true for throttling message', () => {
            expect(isLLMOverloaded(new Error('throttling: rate limited'))).toBe(true);
        });

        test('returns false for normal error', () => {
            expect(isLLMOverloaded(new Error('normal error'))).toBe(false);
        });
    });

    describe('isLLMTimeout', () => {
        test('returns true for timeout message', () => {
            expect(isLLMTimeout(new Error('request timeout'))).toBe(true);
        });

        test('returns false for non-timeout', () => {
            expect(isLLMTimeout(new Error('other error'))).toBe(false);
        });
    });

    describe('isCodeBug', () => {
        test('returns true for TypeError', () => {
            expect(isCodeBug(new Error('TypeError: cannot read property'))).toBe(true);
        });

        test('returns true for ReferenceError', () => {
            expect(isCodeBug(new Error('ReferenceError: x is not defined'))).toBe(true);
        });

        test('returns false for normal error', () => {
            expect(isCodeBug(new Error('normal error'))).toBe(false);
        });
    });

    describe('isNetworkError', () => {
        test('returns true for ECONNRESET', () => {
            expect(isNetworkError(new Error('ECONNRESET connection reset'))).toBe(true);
        });

        test('returns false for non-network', () => {
            expect(isNetworkError(new Error('normal error'))).toBe(false);
        });
    });

    describe('isContextOverflow', () => {
        test('returns true for ContextOverflowError', () => {
            expect(isContextOverflow(new ContextOverflowError('test', 100, 50))).toBe(true);
        });

        test('returns true for isContextOverflow flag', () => {
            const err = new Error('overflow');
            err.isContextOverflow = true;
            expect(isContextOverflow(err)).toBe(true);
        });

        test('returns false for normal error', () => {
            expect(isContextOverflow(new Error('normal error'))).toBe(false);
        });
    });
});
