const { buildRequestPayload, buildRequestHeaders, classifyAndHandleError } = require('../../server/services/llmRequestBuilder');

describe('llmRequestBuilder', () => {
    describe('buildRequestPayload', () => {
        test('builds basic payload', () => {
            const config = { provider: 'aliyunCoding', model: 'qwen3.6-plus' };
            const messages = [{ role: 'user', content: 'hello' }];
            const result = buildRequestPayload(config, messages, {});
            expect(result.model).toBe('qwen3.6-plus');
            expect(result.messages).toBe(messages);
            expect(result.temperature).toBe(0.7);
            expect(result.max_tokens).toBe(8192);
            expect(result.stream).toBe(false);
            expect(result.enable_thinking).toBe(false);
        });

        test('uses custom options', () => {
            const config = { provider: 'aliyunCoding', model: 'qwen3.6-plus' };
            const result = buildRequestPayload(config, [], {
                model: 'custom-model',
                temperature: 0.5,
                maxTokens: 4096,
                enableThinking: true
            });
            expect(result.model).toBe('custom-model');
            expect(result.temperature).toBe(0.5);
            expect(result.max_tokens).toBe(4096);
            expect(result.enable_thinking).toBe(true);
        });

        test('defaults temperature to 0.7', () => {
            const config = { provider: 'deepseek', model: 'deepseek-chat' };
            const result = buildRequestPayload(config, [], {});
            expect(result.temperature).toBe(0.7);
        });

        test('defaults max_tokens to 8192', () => {
            const config = { provider: 'deepseek', model: 'deepseek-chat' };
            const result = buildRequestPayload(config, [], {});
            expect(result.max_tokens).toBe(8192);
        });
    });

    describe('buildRequestHeaders', () => {
        test('builds basic headers', () => {
            const config = { provider: 'aliyunCoding', model: 'qwen3.6-plus', apiKey: 'sk-test' };
            const result = buildRequestHeaders(config);
            expect(result['Content-Type']).toBe('application/json');
            expect(result['Authorization']).toBe('Bearer sk-test');
        });

        test('includes coding plan headers for coding.dashscope', () => {
            const config = { provider: 'aliyunCoding', apiKey: 'sk-test', baseURL: 'https://coding.dashscope.aliyuncs.com/v1' };
            const result = buildRequestHeaders(config);
            expect(result['User-Agent']).toBe('OpenAI/JS 4.73.0');
            expect(result['X-Stainless-Lang']).toBe('js');
            expect(result['X-Stainless-Runtime']).toBe('node');
        });

        test('omits coding plan headers for non-coding URL', () => {
            const config = { provider: 'aliyunCoding', apiKey: 'sk-test', baseURL: 'https://dashscope.aliyuncs.com/v1' };
            const result = buildRequestHeaders(config);
            expect(result['User-Agent']).toBeUndefined();
        });
    });

    describe('classifyAndHandleError', () => {
        test('handles CancelledError', () => {
            const err = new Error('cancelled');
            err.name = 'CanceledError';
            const result = classifyAndHandleError(err, { provider: 'test', model: 'test' }, 3, 1, 1000);
            expect(result.shouldThrow).toBe(true);
            expect(result.error.message).toContain('cancelled');
        });

        test('handles AbortError', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            const result = classifyAndHandleError(err, { provider: 'test', model: 'test' }, 3, 1, 1000);
            expect(result.shouldThrow).toBe(true);
        });

        test('handles ECONNABORTED', () => {
            const err = new Error('timeout');
            err.code = 'ECONNABORTED';
            const result = classifyAndHandleError(err, { provider: 'test', model: 'test' }, 3, 1, 1000);
            expect(result.shouldThrow).toBe(true);
            expect(result.error.message).toContain('超时');
        });

        test('handles API returned error', () => {
            const err = new Error('API returned error: something went wrong');
            const result = classifyAndHandleError(err, { provider: 'test', model: 'test' }, 3, 1, 1000);
            expect(result.shouldThrow).toBe(true);
        });

        test('retries on throttling error', () => {
            const err = new Error('throttling: usage allocated quota exceeded');
            err.response = { data: { error: { message: 'throttling: usage allocated quota exceeded' } }, status: 400 };
            const result = classifyAndHandleError(err, { provider: 'aliyunCoding', model: 'qwen3.6-plus' }, 3, 1, 1000);
            expect(result.shouldRetry).toBe(true);
        });

        test('throws on context overflow', () => {
            const err = new Error('maximum context length exceeded');
            err.response = { data: { error: { message: 'maximum context length exceeded' } }, status: 400 };
            const result = classifyAndHandleError(err, { provider: 'test', model: 'test' }, 3, 1, 1000);
            expect(result.shouldThrow).toBe(true);
            expect(result.error.isContextOverflow).toBe(true);
        });

        test('throws on non-retryable error', () => {
            const err = new Error('Bad request');
            err.response = { status: 400, data: { error: { message: 'Bad request', code: 'invalid_request' } } };
            const result = classifyAndHandleError(err, { provider: 'test', model: 'test' }, 3, 1, 1000);
            expect(result.shouldThrow).toBe(true);
        });
    });
});
