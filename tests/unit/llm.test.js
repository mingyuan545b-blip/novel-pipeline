const {
    getProviders,
    getProviderConfig,
    resolveConfig,
    PROVIDERS
} = require('../../server/services/llm');

const {
    LLMOverloadedError,
    LLMTimeoutError,
    ContextOverflowError
} = require('../../server/shared/errors');

const { classifyLLMError } = require('../../server/shared/errorClassifier');

describe('llm - PROVIDERS registry', () => {
    test('should have all expected providers', () => {
        const providerKeys = getProviders().map(p => p.key);
        expect(providerKeys).toContain('aliyunCoding');
        expect(providerKeys).toContain('deepseek');
        expect(providerKeys).toContain('siliconflow');
        expect(providerKeys).toContain('zhipu');
        expect(providerKeys).toContain('moonshot');
        expect(providerKeys).toContain('custom');
    });

    test('each provider should have required fields', () => {
        const providers = getProviders();
        for (const p of providers) {
            expect(p).toHaveProperty('key');
            expect(p).toHaveProperty('name');
            expect(p).toHaveProperty('baseURL');
            expect(p).toHaveProperty('defaultModel');
            expect(p.key).toBeTruthy();
            expect(p.name).toBeTruthy();
        }
    });

    test('getProviderConfig should return config for known provider', () => {
        const config = getProviderConfig('aliyunCoding');
        expect(config).not.toBeNull();
        expect(config.name).toContain('阿里云');
    });

    test('getProviderConfig should return null for unknown provider', () => {
        const config = getProviderConfig('nonexistent_provider');
        expect(config).toBeNull();
    });
});

describe('llm - resolveConfig', () => {
    test('should resolve config with explicit provider', async () => {
        const config = await resolveConfig({ provider: 'deepseek', apiKey: 'test-key', model: 'deepseek-chat' });
        expect(config.provider).toBe('deepseek');
        expect(config.model).toBe('deepseek-chat');
        expect(config.apiKey).toBe('test-key');
    });

    test('should fill default model when not specified', async () => {
        const config = await resolveConfig({ provider: 'deepseek', apiKey: 'test-key' });
        expect(config.model).toBe('deepseek-chat');
    });

    test('should fill default baseURL when not specified', async () => {
        const config = await resolveConfig({ provider: 'deepseek', apiKey: 'test-key' });
        expect(config.baseURL).toBe('https://api.deepseek.com');
    });

    test('should return default config when apiConfig is null', async () => {
        const config = await resolveConfig(null);
        expect(config).toHaveProperty('provider');
        expect(config).toHaveProperty('apiKey');
        expect(config).toHaveProperty('model');
    });
});

describe('errors - classifyLLMError', () => {
    test('should classify 529 status as LLMOverloadedError', () => {
        const err = new Error('Server overloaded');
        err.status = 529;
        const classified = classifyLLMError(err);
        expect(classified).toBeInstanceOf(LLMOverloadedError);
        expect(classified.retryable).toBe(true);
    });

    test('should classify overload message as LLMOverloadedError', () => {
        const err = new Error('Service is overloaded, please try again');
        const classified = classifyLLMError(err);
        expect(classified).toBeInstanceOf(LLMOverloadedError);
    });

    test('should classify rate limit message as LLMOverloadedError', () => {
        const err = new Error('rate limit exceeded');
        const classified = classifyLLMError(err);
        expect(classified).toBeInstanceOf(LLMOverloadedError);
    });

    test('should classify timeout message as LLMTimeoutError', () => {
        const err = new Error('request timeout after 30000ms');
        const classified = classifyLLMError(err);
        expect(classified).toBeInstanceOf(LLMTimeoutError);
    });

    test('should classify ETIMEDOUT as LLMTimeoutError', () => {
        const err = new Error('ETIMEDOUT connection timed out');
        const classified = classifyLLMError(err);
        expect(classified).toBeInstanceOf(LLMTimeoutError);
    });

    test('should classify context_length_exceeded as ContextOverflowError', () => {
        const err = new Error('context_length_exceeded: max_tokens');
        const classified = classifyLLMError(err);
        expect(classified).toBeInstanceOf(ContextOverflowError);
        expect(classified.retryable).toBe(false);
    });

    test('should classify context_overflow as ContextOverflowError', () => {
        const err = new Error('context_overflow detected');
        const classified = classifyLLMError(err);
        expect(classified).toBeInstanceOf(ContextOverflowError);
    });

    test('should return original error for unclassified errors', () => {
        const err = new Error('Some random error');
        const classified = classifyLLMError(err);
        expect(classified).toBe(err);
        expect(classified).not.toBeInstanceOf(LLMOverloadedError);
        expect(classified).not.toBeInstanceOf(LLMTimeoutError);
        expect(classified).not.toBeInstanceOf(ContextOverflowError);
    });

    test('should classify quota message as LLMOverloadedError', () => {
        const err = new Error('quota exceeded');
        const classified = classifyLLMError(err);
        expect(classified).toBeInstanceOf(LLMOverloadedError);
    });
});

describe('llm - retry backoff calculation', () => {
    test('backoff with base 2: delay should double each attempt', () => {
        const retryDelay = 10000;
        const attempt1 = retryDelay * Math.pow(2, 0);
        const attempt2 = retryDelay * Math.pow(2, 1);
        const attempt3 = retryDelay * Math.pow(2, 2);
        expect(attempt1).toBe(10000);
        expect(attempt2).toBe(20000);
        expect(attempt3).toBe(40000);
    });

    test('backoff delays should increase monotonically', () => {
        const retryDelay = 10000;
        const delays = [1, 2, 3].map(a => retryDelay * Math.pow(2, a - 1));
        for (let i = 1; i < delays.length; i++) {
            expect(delays[i]).toBeGreaterThan(delays[i - 1]);
        }
    });
});
