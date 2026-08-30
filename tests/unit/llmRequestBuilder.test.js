/**
 * llmRequestBuilder.test.js
 * 覆盖 llmRequestBuilder.js 分支
 */
jest.mock('../../server/config/providerRegistry', () => ({
    PROVIDERS: {
        deepseek: { name: 'DeepSeek', baseURL: 'https://api.deepseek.com', defaultModel: 'deepseek-chat' },
        aliyunCoding: { name: '阿里云百炼', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen3.6-plus' },
        siliconflow: { name: '硅基流动', baseURL: 'https://api.siliconflow.cn/v1', defaultModel: 'Qwen/Qwen2.5-7B-Instruct' },
        lmstudio: { name: 'LM Studio(本地)', baseURL: '', defaultModel: 'qwen3.8-27b', noThinkMarker: ' /no_think', noThinkSystemDirective: '【输出纪律】直接输出最终结果，禁止输出任何思考过程。' }
    }
}));

const {
    buildRequestPayload,
    buildRequestHeaders,
    classifyAndHandleError
} = require('../../server/services/llmRequestBuilder');

describe('llmRequestBuilder', () => {
    describe('buildRequestPayload', () => {
        test('builds deepseek payload with enable_thinking=false', () => {
            const config = { provider: 'deepseek', model: 'deepseek-chat', apiKey: 'sk-test' };
            const messages = [{ role: 'user', content: 'hi' }];
            const payload = buildRequestPayload(config, messages, {});
            expect(payload.model).toBe('deepseek-chat');
            expect(payload.messages).toEqual(messages);
            expect(payload.enable_thinking).toBe(false);
        });

        test('builds aliyunCoding payload with enable_thinking=false', () => {
            const config = { provider: 'aliyunCoding', model: 'qwen3.6-plus', apiKey: 'sk-test' };
            const messages = [{ role: 'user', content: 'hi' }];
            const payload = buildRequestPayload(config, messages, {});
            expect(payload.model).toBe('qwen3.6-plus');
            expect(payload.enable_thinking).toBe(false);
        });

        test('builds siliconflow payload', () => {
            const config = { provider: 'siliconflow', model: 'Qwen/Qwen2.5-7B-Instruct', apiKey: 'sk-test' };
            const messages = [{ role: 'user', content: 'hi' }];
            const payload = buildRequestPayload(config, messages, {});
            expect(payload.model).toBe('Qwen/Qwen2.5-7B-Instruct');
        });

        test('includes temperature when provided', () => {
            const config = { provider: 'deepseek', model: 'deepseek-chat', apiKey: 'sk-test' };
            const payload = buildRequestPayload(config, [], { temperature: 0.7 });
            expect(payload.temperature).toBe(0.7);
        });

        test('includes max_tokens when provided', () => {
            const config = { provider: 'deepseek', model: 'deepseek-chat', apiKey: 'sk-test' };
            const payload = buildRequestPayload(config, [], { maxTokens: 2000 });
            expect(payload.max_tokens).toBe(2000);
        });

        test('enables thinking when option is set', () => {
            const config = { provider: 'aliyunCoding', model: 'qwen3.6-plus', apiKey: 'sk-test' };
            const payload = buildRequestPayload(config, [], { enableThinking: true });
            expect(payload.enable_thinking).toBe(true);
        });

        test('lmstudio：末条user消息追加 /no_think（本地思考模型治理）', () => {
            const config = { provider: 'lmstudio', model: 'qwen3.8-27b', apiKey: 'lm-studio' };
            const messages = [
                { role: 'system', content: 'sys' },
                { role: 'user', content: '第一章写什么' },
                { role: 'assistant', content: '旧正文' },
                { role: 'user', content: '继续写第二章' }
            ];
            const payload = buildRequestPayload(config, messages, {});
            expect(payload.messages[3].content).toBe('继续写第二章 /no_think');
            expect(payload.messages[1].content).toBe('第一章写什么');
            // 不得修改原数组（调用方可能复用messages）
            expect(messages[3].content).toBe('继续写第二章');
        });

        test('lmstudio：enableThinking=true 时不追加标记', () => {
            const config = { provider: 'lmstudio', model: 'qwen3.8-27b', apiKey: 'lm-studio' };
            const messages = [{ role: 'user', content: '正文' }];
            const payload = buildRequestPayload(config, messages, { enableThinking: true });
            expect(payload.messages[0].content).toBe('正文');
        });

        test('lmstudio：system消息追加输出纪律硬指令（双保险）', () => {
            const config = { provider: 'lmstudio', model: 'qwen3.8-27b', apiKey: 'lm-studio' };
            const messages = [
                { role: 'system', content: '你是执笔人。' },
                { role: 'user', content: '写正文' }
            ];
            const payload = buildRequestPayload(config, messages, {});
            expect(payload.messages[0].content).toBe('你是执笔人。\n【输出纪律】直接输出最终结果，禁止输出任何思考过程。');
            expect(payload.messages[1].content).toBe('写正文 /no_think');
            // 原数组不被修改
            expect(messages[0].content).toBe('你是执笔人。');
        });

        test('lmstudio：system已含指令不重复追加', () => {
            const config = { provider: 'lmstudio', model: 'qwen3.8-27b', apiKey: 'lm-studio' };
            const messages = [
                { role: 'system', content: '系统。【输出纪律】直接输出最终结果，禁止输出任何思考过程。' },
                { role: 'user', content: '写正文' }
            ];
            const payload = buildRequestPayload(config, messages, {});
            expect(payload.messages[0].content).toBe('系统。【输出纪律】直接输出最终结果，禁止输出任何思考过程。');
        });

        test('云端供应商不追加输出纪律指令', () => {
            const config = { provider: 'aliyunCoding', model: 'qwen3.6-plus', apiKey: 'sk-test' };
            const messages = [{ role: 'system', content: '你是执笔人。' }, { role: 'user', content: '写正文' }];
            const payload = buildRequestPayload(config, messages, {});
            expect(payload.messages[0].content).toBe('你是执笔人。');
        });

        test('lmstudio：已含标记不重复追加', () => {
            const config = { provider: 'lmstudio', model: 'qwen3.8-27b', apiKey: 'lm-studio' };
            const messages = [{ role: 'user', content: '正文 /no_think' }];
            const payload = buildRequestPayload(config, messages, {});
            expect(payload.messages[0].content).toBe('正文 /no_think');
        });

        test('lmstudio：数组块content追加到最后一个text块', () => {
            const config = { provider: 'lmstudio', model: 'qwen3.8-27b', apiKey: 'lm-studio' };
            const messages = [{ role: 'user', content: [{ type: 'image', url: 'x' }, { type: 'text', text: '正文' }] }];
            const payload = buildRequestPayload(config, messages, {});
            expect(payload.messages[0].content[1].text).toBe('正文 /no_think');
        });

        test('云端供应商不追加标记', () => {
            const config = { provider: 'aliyunCoding', model: 'qwen3.6-plus', apiKey: 'sk-test' };
            const messages = [{ role: 'user', content: '正文' }];
            const payload = buildRequestPayload(config, messages, {});
            expect(payload.messages[0].content).toBe('正文');
        });
    });

    describe('buildRequestHeaders', () => {
        test('builds deepseek headers with Bearer token', () => {
            const config = { provider: 'deepseek', apiKey: 'sk-test-key' };
            const headers = buildRequestHeaders(config);
            expect(headers['Authorization']).toBe('Bearer sk-test-key');
            expect(headers['Content-Type']).toBe('application/json');
        });

        test('builds aliyunCoding headers with Bearer token', () => {
            const config = { provider: 'aliyunCoding', apiKey: 'sk-test-key' };
            const headers = buildRequestHeaders(config);
            expect(headers['Authorization']).toBe('Bearer sk-test-key');
        });

        test('builds siliconflow headers with Bearer token', () => {
            const config = { provider: 'siliconflow', apiKey: 'sk-test' };
            const headers = buildRequestHeaders(config);
            expect(headers['Authorization']).toBe('Bearer sk-test');
            expect(headers['Content-Type']).toBe('application/json');
        });

        test('includes coding plan headers for coding.dashscope URL', () => {
            const config = { provider: 'aliyunCoding', apiKey: 'sk-test', baseURL: 'https://coding.dashscope.aliyuncs.com/v1' };
            const headers = buildRequestHeaders(config);
            expect(headers['User-Agent']).toBe('OpenAI/JS 4.73.0');
            expect(headers['X-Stainless-Lang']).toBe('js');
        });

        test('omits coding plan headers for non-coding URL', () => {
            const config = { provider: 'aliyunCoding', apiKey: 'sk-test', baseURL: 'https://dashscope.aliyuncs.com/v1' };
            const headers = buildRequestHeaders(config);
            expect(headers['User-Agent']).toBeUndefined();
        });
    });

    describe('classifyAndHandleError', () => {
        test('handles AbortError', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            const result = classifyAndHandleError(err, { provider: 'deepseek', model: 'test' }, 3, 1, 1000);
            expect(result.shouldThrow).toBe(true);
            expect(result.error.message).toContain('cancelled');
        });

        test('handles CanceledError', () => {
            const err = new Error('canceled');
            err.name = 'CanceledError';
            const result = classifyAndHandleError(err, { provider: 'deepseek', model: 'test' }, 3, 1, 1000);
            expect(result.shouldThrow).toBe(true);
        });

        test('handles ECONNABORTED timeout', () => {
            const err = new Error('timeout');
            err.code = 'ECONNABORTED';
            const result = classifyAndHandleError(err, { provider: 'deepseek', model: 'test' }, 3, 1, 1000);
            expect(result.shouldThrow).toBe(true);
            expect(result.error.message).toContain('超时');
        });

        test('handles API returned error passthrough', () => {
            const err = new Error('API returned error: something bad (code: 500)');
            const result = classifyAndHandleError(err, { provider: 'deepseek', model: 'test' }, 3, 1, 1000);
            expect(result.shouldThrow).toBe(true);
        });

        test('retries on network error', () => {
            const err = new Error('ECONNRESET: connection reset');
            err.response = { status: 0, data: {} };
            const result = classifyAndHandleError(err, { provider: 'deepseek', model: 'test' }, 3, 1, 1000);
            expect(result.shouldRetry).toBe(true);
            expect(result.reason).toContain('Network');
        });

        test('retries on overloaded error', () => {
            const err = new Error('Server overloaded');
            err.response = { status: 529, data: { error: { message: 'Server overloaded', code: 'server_overloaded' } } };
            const result = classifyAndHandleError(err, { provider: 'deepseek', model: 'test' }, 3, 1, 1000);
            expect(result.shouldRetry).toBe(true);
        });

        test('throws on context overflow', () => {
            const { ContextOverflowError } = require('../../server/shared/errors');
            const err = new Error('maximum context length exceeded');
            err.response = { status: 400, data: { error: { message: 'maximum context length exceeded', code: 'context_length_exceeded' } } };
            const result = classifyAndHandleError(err, { provider: 'deepseek', model: 'test' }, 3, 1, 1000);
            expect(result.shouldThrow).toBe(true);
            expect(result.error).toBeInstanceOf(ContextOverflowError);
        });

        test('throws on non-retryable error', () => {
            const err = new Error('Bad request');
            err.response = { status: 400, data: { error: { message: 'Bad request', code: 'invalid_request' } } };
            const result = classifyAndHandleError(err, { provider: 'deepseek', model: 'test' }, 3, 1, 1000);
            expect(result.shouldThrow).toBe(true);
        });

        test('throws when max retries reached on retryable error', () => {
            const err = new Error('ECONNRESET: connection reset');
            err.response = { status: 0, data: {} };
            const result = classifyAndHandleError(err, { provider: 'deepseek', model: 'test' }, 3, 3, 1000);
            expect(result.shouldThrow).toBe(true);
        });
    });
});
