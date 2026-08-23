const { waitForRetry, classifyApiError } = require('../../server/services/llmRetryUtils');

describe('llmRetryUtils', () => {
    describe('waitForRetry', () => {
        test('resolves after delay', async () => {
            const start = Date.now();
            await waitForRetry(50);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(40);
        });

        test('rejects immediately if signal already aborted', async () => {
            const controller = new AbortController();
            controller.abort();
            await expect(waitForRetry(1000, controller.signal)).rejects.toThrow('aborted');
        });

        test('rejects when signal aborts during wait', async () => {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 20);
            await expect(waitForRetry(5000, controller.signal)).rejects.toThrow('aborted');
        });

        test('works without external signal', async () => {
            await expect(waitForRetry(10)).resolves.toBeUndefined();
        });
    });

    describe('classifyApiError', () => {
        test('detects overload by status code 529', () => {
            const result = classifyApiError('error', 529);
            expect(result.isOverloaded).toBe(true);
        });

        test('detects overload by status code 2064', () => {
            const result = classifyApiError('error', 2064);
            expect(result.isOverloaded).toBe(true);
        });

        test('detects overload by throttling keyword', () => {
            const result = classifyApiError('throttling: usage allocated quota exceeded', 400);
            expect(result.isOverloaded).toBe(true);
        });

        test('detects overload by rate limit keyword', () => {
            const result = classifyApiError('rate limit exceeded', 429);
            expect(result.isOverloaded).toBe(true);
        });

        test('detects network error', () => {
            const result = classifyApiError('ECONNRESET connection reset', null);
            expect(result.isNetworkError).toBe(true);
        });

        test('detects context overflow by maximum context length', () => {
            const result = classifyApiError('maximum context length exceeded', 400);
            expect(result.isContextOverflow).toBe(true);
        });

        test('detects context overflow by token limit', () => {
            const result = classifyApiError('token limit exceeded', 400);
            expect(result.isContextOverflow).toBe(true);
        });

        test('detects context overflow by too many tokens', () => {
            const result = classifyApiError('too many tokens in request', 400);
            expect(result.isContextOverflow).toBe(true);
        });

        test('detects context overflow by input too long', () => {
            const result = classifyApiError('input is too long', 400);
            expect(result.isContextOverflow).toBe(true);
        });

        test('detects context overflow by context_length status', () => {
            const result = classifyApiError('context_length exceeded', 400);
            expect(result.isContextOverflow).toBe(true);
        });

        test('returns all false for unknown error', () => {
            const result = classifyApiError('unknown error', 500);
            expect(result.isOverloaded).toBe(false);
            expect(result.isNetworkError).toBe(false);
            expect(result.isContextOverflow).toBe(false);
        });

        test('handles null error message', () => {
            const result = classifyApiError(null, 500);
            expect(result.isOverloaded).toBe(false);
            expect(result.isNetworkError).toBeFalsy();
            expect(result.isContextOverflow).toBeFalsy();
        });

        test('detects overload by server overloaded keyword', () => {
            const result = classifyApiError('server overloaded, please retry', 503);
            expect(result.isOverloaded).toBe(true);
        });
    });
});
