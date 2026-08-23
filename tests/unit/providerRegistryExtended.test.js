const {
    resolveProviderKey, getProviderConfig, fillProviderConfig,
    validateConfig, getAvailableProviders, getOutlineApiConfig,
    PROVIDERS
} = require('../../server/config/providerRegistry');

describe('providerRegistry - extended', () => {
    describe('resolveProviderKey', () => {
        test('returns key for known provider', () => {
            expect(resolveProviderKey('aliyunCoding')).toBe('aliyunCoding');
        });
        test('returns null for unknown provider', () => {
            expect(resolveProviderKey('unknown')).toBeNull();
        });
        test('resolves alias to provider key', () => {
            const aliyun = PROVIDERS.aliyunCoding;
            if (aliyun?.aliases?.length > 0) {
                expect(resolveProviderKey(aliyun.aliases[0])).toBe('aliyunCoding');
            }
        });
    });

    describe('getProviderConfig', () => {
        test('returns config for known provider', () => {
            const config = getProviderConfig('aliyunCoding');
            expect(config).toBeTruthy();
            expect(config.name).toBeTruthy();
        });
        test('returns null for unknown provider', () => {
            expect(getProviderConfig('unknown')).toBeNull();
        });
    });

    describe('fillProviderConfig', () => {
        test('fills with default provider when not specified', () => {
            const result = fillProviderConfig({});
            expect(result.provider).toBe('aliyunCoding');
        });
        test('preserves explicit apiKey', () => {
            const result = fillProviderConfig({ provider: 'aliyunCoding', apiKey: 'my-key' });
            expect(result.apiKey).toBe('my-key');
        });
        test('preserves explicit model', () => {
            const result = fillProviderConfig({ provider: 'aliyunCoding', model: 'custom-model' });
            expect(result.model).toBe('custom-model');
        });
        test('falls back unknown provider to aliyunCoding', () => {
            const result = fillProviderConfig({ provider: 'unknown' });
            expect(result.provider).toBe('aliyunCoding');
        });
    });

    describe('validateConfig', () => {
        test('valid config', () => {
            const result = validateConfig({ provider: 'aliyunCoding', apiKey: 'key', model: 'model' });
            expect(result.valid).toBe(true);
        });
        test('invalid without provider', () => {
            const result = validateConfig({ apiKey: 'key', model: 'model' });
            expect(result.valid).toBe(false);
        });
        test('invalid without apiKey', () => {
            const result = validateConfig({ provider: 'aliyunCoding', model: 'model' });
            expect(result.valid).toBe(false);
        });
        test('invalid without model', () => {
            const result = validateConfig({ provider: 'aliyunCoding', apiKey: 'key' });
            expect(result.valid).toBe(false);
        });
    });

    describe('getAvailableProviders', () => {
        test('returns array with provider info', () => {
            const providers = getAvailableProviders();
            expect(Array.isArray(providers)).toBe(true);
            expect(providers.length).toBeGreaterThan(0);
            expect(providers[0]).toHaveProperty('id');
            expect(providers[0]).toHaveProperty('label');
        });
    });

    describe('getOutlineApiConfig', () => {
        const origEnv = process.env;
        beforeEach(() => { process.env = { ...origEnv }; });
        afterAll(() => { process.env = origEnv; });

        test('returns undefined when no API keys available', () => {
            delete process.env.LLM_PROVIDER;
            delete process.env.ALIYUN_CODING_API_KEY;
            delete process.env.DEEPSEEK_API_KEY;
            const result = getOutlineApiConfig();
            expect(result).toBeUndefined();
        });
        test('returns aliyun config when API key is set', () => {
            delete process.env.LLM_PROVIDER;
            process.env.ALIYUN_CODING_API_KEY = 'test-key';
            const result = getOutlineApiConfig();
            expect(result.provider).toBe('aliyunCoding');
            expect(result.apiKey).toBe('test-key');
        });
    });
});
