'use strict';

// 配合 jest.config.js 的 moduleNameMapper 统一 axios 解析路径
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
    getProviderList: jest.fn(() => []),
    getProviderConfig: jest.fn(),
    resolveProviderKey: jest.fn((k) => k),
    PROVIDERS: { aliyunCoding: { tpmLimit: 100000 }, siliconflow: { tpmLimit: 100000 }, deepseek: { tpmLimit: 100000 } }
}));
jest.mock('../../server/config/modelResolver', () => ({ DEFAULT_MODEL: 'default-model' }));
jest.mock('../../server/config/systemConfig', () => ({
    PROVIDER_DEFAULTS: { DEFAULT_PROVIDER: 'aliyunCoding', ALIYUN_CODING_BASE_URL: 'https://a.test', SILICONFLOW_BASE_URL: 'https://s.test', DEEPSEEK_BASE_URL: 'https://d.test' },
    LLM_DEFAULTS: { REQUEST_TIMEOUT_MS: 600000 }
}));

const axios = require('axios');
const { testConnection } = require('../../server/services/llm');
const llmConfig = require('../../server/services/llmConfig');
const { classifyAndHandleError } = require('../../server/services/llmRequestBuilder');

const VALID_CONFIG = { provider: 'aliyunCoding', apiKey: 'sk-test-key-1234567890', model: 'qwen3-plus', baseURL: 'https://test.api.com' };
const SUCCESS_RESP = { data: { choices: [{ message: { content: 'Hello' }, finish_reason: 'stop' }], model: 'qwen3-plus', usage: { total_tokens: 100 } } };
const THROW_API_ERR = { shouldThrow: true, error: new Error('API Error: unknown') };

// testConnection 内部从 process.env 读取 API key 作为 fallback
// 测试需清理这些变量，避免真实环境变量干扰断言
const ENV_KEYS = ['ALIYUN_CODING_API_KEY', 'SILICONFLOW_API_KEY', 'DEEPSEEK_API_KEY', 'LLM_PROVIDER', 'ALIYUN_CODING_MODEL', 'ALIYUN_CODING_BASE_URL'];
const savedEnv = {};

describe('llm.testConnection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ENV_KEYS.forEach(k => { savedEnv[k] = process.env[k]; delete process.env[k]; });
        axios.post.mockReset();
        axios.post.mockResolvedValue({ ...SUCCESS_RESP });
        llmConfig.resolveConfig.mockImplementation(async (cfg) => {
            if (!cfg?.apiKey) return { ...VALID_CONFIG, apiKey: '' };
            return { ...VALID_CONFIG, ...cfg };
        });
        classifyAndHandleError.mockReturnValue({ ...THROW_API_ERR });
    });

    afterEach(() => {
        ENV_KEYS.forEach(k => {
            if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k];
            else delete process.env[k];
        });
    });

    test('成功应返回 success 对象', async () => {
        const result = await testConnection({ provider: 'aliyunCoding', apiKey: 'sk-test', model: 'qwen3-plus', baseURL: 'https://test.api.com', agentLabel: '执笔人' });
        expect(result.success).toBe(true);
        expect(result.provider).toBe('aliyunCoding');
        expect(result.agentLabel).toBe('执笔人');
    });

    test('无 apiKey 应返回失败', async () => {
        const result = await testConnection({ provider: 'aliyunCoding' });
        expect(result.success).toBe(false);
        expect(result.message).toContain('API Key');
    });

    test('chat 失败应返回失败', async () => {
        axios.post.mockRejectedValue(new Error('Network error'));
        classifyAndHandleError.mockReturnValue({ shouldThrow: true, error: new Error('Network error') });
        const result = await testConnection({ provider: 'aliyunCoding', apiKey: 'sk-test' });
        expect(result.success).toBe(false);
        expect(result.message).toContain('Network error');
    });

    test('siliconflow 有 apiKey 应成功', async () => {
        const result = await testConnection({ provider: 'siliconflow', apiKey: 'sk-silicon', baseURL: 'https://api.siliconflow.cn' });
        expect(result.success).toBe(true);
    });

    test('siliconflow 无 apiKey 走默认配置并失败', async () => {
        const result = await testConnection({ provider: 'siliconflow' });
        expect(result.success).toBe(false);
        expect(result.message).toContain('API Key');
    });

    test('deepseek 有 apiKey 应成功', async () => {
        const result = await testConnection({ provider: 'deepseek', apiKey: 'sk-deepseek', baseURL: 'https://api.deepseek.com' });
        expect(result.success).toBe(true);
    });

    test('deepseek 无 apiKey 走默认配置并失败', async () => {
        const result = await testConnection({ provider: 'deepseek' });
        expect(result.success).toBe(false);
        expect(result.message).toContain('API Key');
    });

    test('未指定 provider 应使用默认', async () => {
        const result = await testConnection({ apiKey: 'sk-test' });
        expect(result.success).toBe(true);
    });

    test('响应无 choices 应返回 empty response', async () => {
        axios.post.mockResolvedValue({ data: { model: 'qwen3-plus', usage: { total_tokens: 10 } } });
        const result = await testConnection({ provider: 'aliyunCoding', apiKey: 'sk-test' });
        expect(result.success).toBe(true);
        expect(result.message).toBe('(empty response)');
    });
});
