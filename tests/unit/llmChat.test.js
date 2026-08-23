'use strict';

// 配合 jest.config.js 的 moduleNameMapper 统一 axios 解析路径
// 背景：server/package.json 独立声明 axios，与根目录是两个实例
// moduleNameMapper 强制统一到根目录，使此 mock 在 llm.js 内也生效
jest.mock('axios', () => ({
    post: jest.fn(),
    get: jest.fn(),
    create: jest.fn(() => ({ post: jest.fn(), get: jest.fn() })),
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }
}));
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../server/services/rateLimiter', () => ({
    getRateLimiter: jest.fn(() => ({ acquire: jest.fn().mockResolvedValue(undefined) })),
    getTokenBucket: jest.fn(() => ({ acquire: jest.fn().mockResolvedValue(undefined), reportUsage: jest.fn() }))
}));
jest.mock('../../server/services/llmMetrics', () => ({ recordTokenUsage: jest.fn() }));
jest.mock('../../server/services/llmResponseParser', () => ({ normalizeMessageContent: jest.fn() }));
jest.mock('../../server/services/llmRetryUtils', () => ({ waitForRetry: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../server/services/llmConfig', () => ({ resolveConfig: jest.fn() }));
jest.mock('../../server/services/llmRequestBuilder', () => ({
    buildRequestPayload: jest.fn((c, m, o) => ({
        model: o.model || c.model, messages: m,
        temperature: o.temperature ?? 0.7, max_tokens: o.maxTokens ?? 8192, stream: false
    })),
    buildRequestHeaders: jest.fn(() => ({ 'Content-Type': 'application/json' })),
    classifyAndHandleError: jest.fn()
}));
jest.mock('../../server/config/providerRegistry', () => ({
    getProviderList: jest.fn(() => ['aliyunCoding', 'siliconflow']),
    getProviderConfig: jest.fn((k) => ({ provider: k, tpmLimit: 100000 })),
    resolveProviderKey: jest.fn((k) => k),
    PROVIDERS: { aliyunCoding: { tpmLimit: 100000 }, siliconflow: { tpmLimit: 100000 }, deepseek: { tpmLimit: 100000 } }
}));
jest.mock('../../server/config/modelResolver', () => ({ DEFAULT_MODEL: 'default-model' }));
jest.mock('../../server/config/systemConfig', () => ({
    PROVIDER_DEFAULTS: { DEFAULT_PROVIDER: 'aliyunCoding', ALIYUN_CODING_BASE_URL: 'https://a.test', SILICONFLOW_BASE_URL: 'https://s.test', DEEPSEEK_BASE_URL: 'https://d.test' }
}));

const axios = require('axios');
const { chat, getProviders, getProviderConfig } = require('../../server/services/llm');
const llmConfig = require('../../server/services/llmConfig');
const llmMetrics = require('../../server/services/llmMetrics');
const providerRegistry = require('../../server/config/providerRegistry');
const { waitForRetry } = require('../../server/services/llmRetryUtils');
const { classifyAndHandleError, buildRequestPayload } = require('../../server/services/llmRequestBuilder');

const VALID_CONFIG = { provider: 'aliyunCoding', apiKey: 'sk-test-key-1234567890', model: 'qwen3-plus', baseURL: 'https://test.api.com' };
const SUCCESS_RESP = { data: { choices: [{ message: { content: 'Hello' }, finish_reason: 'stop' }], model: 'qwen3-plus', usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 } } };
const THROW_API_ERR = { shouldThrow: true, error: new Error('API Error: unknown') };

describe('llm 辅助函数', () => {
    test('getProviders 返回 provider 列表', () => {
        const result = getProviders();
        expect(providerRegistry.getProviderList).toHaveBeenCalled();
        expect(result).toEqual(['aliyunCoding', 'siliconflow']);
    });

    test('getProviderConfig 返回指定 provider 配置', () => {
        const result = getProviderConfig('aliyunCoding');
        expect(providerRegistry.getProviderConfig).toHaveBeenCalledWith('aliyunCoding');
        expect(result).toEqual({ provider: 'aliyunCoding', tpmLimit: 100000 });
    });
});

describe('llm.chat', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        axios.post.mockReset();
        axios.post.mockResolvedValue({ ...SUCCESS_RESP });
        llmConfig.resolveConfig.mockResolvedValue({ ...VALID_CONFIG });
        classifyAndHandleError.mockReturnValue({ ...THROW_API_ERR });
    });

    test('API Key 缺失应抛出错误', async () => {
        llmConfig.resolveConfig.mockResolvedValue({ ...VALID_CONFIG, apiKey: '' });
        await expect(chat([{ role: 'user', content: 'test' }], {})).rejects.toThrow('API Key not configured');
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('正常请求应返回响应数据并上报 token', async () => {
        const result = await chat([{ role: 'user', content: 'test' }], { apiConfig: {} });
        expect(result).toEqual(SUCCESS_RESP.data);
        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(llmMetrics.recordTokenUsage).toHaveBeenCalledWith('aliyunCoding', 'qwen3-plus', SUCCESS_RESP.data.usage, true, expect.any(Number));
    });

    test('无 usage 时正常返回', async () => {
        axios.post.mockResolvedValue({ data: { choices: [{ message: { content: 'Hi' } }], model: 'qwen3-plus' } });
        const result = await chat([{ role: 'user', content: 'test' }], { apiConfig: {} });
        expect(result).toEqual({ choices: [{ message: { content: 'Hi' } }], model: 'qwen3-plus' });
    });

    test('529 过载应触发重试后成功', async () => {
        axios.post.mockRejectedValueOnce(new Error('overloaded'));
        axios.post.mockResolvedValueOnce({ ...SUCCESS_RESP });
        classifyAndHandleError.mockReturnValue({ shouldRetry: true, delay: 1, reason: 'overloaded', statusCode: 529 });
        const result = await chat([{ role: 'user', content: 'test' }], { apiConfig: {}, maxRetries: 3, retryDelay: 1 });
        expect(axios.post).toHaveBeenCalledTimes(2);
        expect(waitForRetry).toHaveBeenCalledTimes(1);
        expect(result).toEqual(SUCCESS_RESP.data);
    });

    test('达到最大重试次数后抛出错误', async () => {
        axios.post.mockRejectedValue(new Error('overloaded'));
        classifyAndHandleError.mockImplementation((e, c, max, attempt) => {
            if (attempt < max) return { shouldRetry: true, delay: 1, reason: 'overloaded', statusCode: 529 };
            return { shouldThrow: true, error: new Error('API Error: overloaded') };
        });
        await expect(chat([{ role: 'user', content: 'test' }], { apiConfig: {}, maxRetries: 2, retryDelay: 1 })).rejects.toThrow(/API Error/);
        expect(axios.post).toHaveBeenCalledTimes(2);
        expect(waitForRetry).toHaveBeenCalledTimes(1);
    });

    test('上下文溢出应立即抛出不重试', async () => {
        axios.post.mockRejectedValue(new Error('context exceeded'));
        classifyAndHandleError.mockReturnValue({ shouldThrow: true, error: new Error('CONTEXT_OVERFLOW') });
        await expect(chat([{ role: 'user', content: 'test' }], { apiConfig: {}, maxRetries: 3 })).rejects.toThrow(/CONTEXT_OVERFLOW/);
        expect(waitForRetry).not.toHaveBeenCalled();
    });

    test('请求取消应立即抛出', async () => {
        axios.post.mockRejectedValue(new Error('canceled'));
        classifyAndHandleError.mockReturnValue({ shouldThrow: true, error: new Error('LLM request was cancelled') });
        await expect(chat([{ role: 'user', content: 'test' }], { apiConfig: {}, maxRetries: 3 })).rejects.toThrow(/cancelled/);
        expect(waitForRetry).not.toHaveBeenCalled();
    });

    test('外部 signal 已 aborted 应在请求前抛出', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(chat([{ role: 'user', content: 'test' }], { apiConfig: {}, signal: controller.signal })).rejects.toThrow(/aborted/);
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('外部 signal 未 aborted 应正常请求', async () => {
        const controller = new AbortController();
        const result = await chat([{ role: 'user', content: 'test' }], { apiConfig: {}, signal: controller.signal });
        expect(result).toEqual(SUCCESS_RESP.data);
        expect(axios.post).toHaveBeenCalledTimes(1);
    });

    test('ECONNABORTED 超时应立即抛出', async () => {
        axios.post.mockRejectedValue(new Error('timeout'));
        classifyAndHandleError.mockReturnValue({ shouldThrow: true, error: new Error('API 请求超时') });
        await expect(chat([{ role: 'user', content: 'test' }], { apiConfig: {}, maxRetries: 3 })).rejects.toThrow(/超时/);
    });

    test('自定义 maxTokens 应传递到 payload', async () => {
        await chat([{ role: 'user', content: 'test' }], { apiConfig: {}, maxTokens: 1024 });
        expect(axios.post.mock.calls[0][1].max_tokens).toBe(1024);
        expect(buildRequestPayload).toHaveBeenCalled();
    });

    test('自定义 temperature 应传递到 payload', async () => {
        await chat([{ role: 'user', content: 'test' }], { apiConfig: {}, temperature: 0.5 });
        expect(axios.post.mock.calls[0][1].temperature).toBe(0.5);
    });

    test('网络错误应触发重试', async () => {
        axios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        axios.post.mockResolvedValueOnce({ ...SUCCESS_RESP });
        classifyAndHandleError.mockReturnValue({ shouldRetry: true, delay: 1, reason: 'Network', statusCode: 0 });
        const result = await chat([{ role: 'user', content: 'test' }], { apiConfig: {}, maxRetries: 3, retryDelay: 1 });
        expect(axios.post).toHaveBeenCalledTimes(2);
        expect(result).toEqual(SUCCESS_RESP.data);
    });

    test('未分类错误应立即抛出', async () => {
        axios.post.mockRejectedValue(new Error('unknown'));
        classifyAndHandleError.mockReturnValue({ shouldThrow: true, error: new Error('API Error: unknown') });
        await expect(chat([{ role: 'user', content: 'test' }], { apiConfig: {}, maxRetries: 3 })).rejects.toThrow(/API Error/);
        expect(waitForRetry).not.toHaveBeenCalled();
    });

    test('所有重试均未分类应返回 undefined', async () => {
        axios.post.mockRejectedValue(new Error('unknown'));
        classifyAndHandleError.mockReturnValue({});
        const result = await chat([{ role: 'user', content: 'test' }], { apiConfig: {}, maxRetries: 2, retryDelay: 1 });
        expect(result).toBeUndefined();
        expect(axios.post).toHaveBeenCalledTimes(2);
    });
});
