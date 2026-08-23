const { PROVIDERS, getProviderList, resolveProviderKey, getProviderConfig, fillProviderConfig, validateConfig, getAvailableProviders, getOutlineApiConfig } = require('../../server/config/providerRegistry');

describe('providerRegistry', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('PROVIDERS', () => {
        test('has aliyunCoding', () => {
            expect(PROVIDERS.aliyunCoding).toBeDefined();
            expect(PROVIDERS.aliyunCoding.name).toContain('阿里云');
            expect(PROVIDERS.aliyunCoding.envKey).toBe('ALIYUN_CODING_API_KEY');
        });

        test('has deepseek', () => {
            expect(PROVIDERS.deepseek).toBeDefined();
            expect(PROVIDERS.deepseek.envKey).toBe('DEEPSEEK_API_KEY');
        });

        test('each provider has required fields', () => {
            for (const [id, p] of Object.entries(PROVIDERS)) {
                expect(p.name).toBeDefined();
                if (id === 'custom') continue;
                expect(p.defaultModel).toBeDefined();
                if (!p.noApiKey) expect(p.envKey).toBeDefined();
            }
        });
    });

    describe('getProviderList', () => {
        test('returns array of provider info', () => {
            const list = getProviderList();
            expect(Array.isArray(list)).toBe(true);
            expect(list.length).toBeGreaterThan(0);
        });

        test('each item has key, name, available', () => {
            const list = getProviderList();
            for (const p of list) {
                expect(p.key).toBeDefined();
                expect(p.name).toBeDefined();
                expect(typeof p.available).toBe('boolean');
            }
        });
    });

    describe('resolveProviderKey', () => {
        test('resolves direct key', () => {
            expect(resolveProviderKey('aliyunCoding')).toBe('aliyunCoding');
        });

        test('resolves alias', () => {
            expect(resolveProviderKey('aliyun-coding')).toBe('aliyunCoding');
            expect(resolveProviderKey('aliyun')).toBe('aliyunCoding');
        });

        test('returns null for unknown key', () => {
            expect(resolveProviderKey('unknown-provider')).toBeNull();
        });
    });

    describe('getProviderConfig', () => {
        test('returns provider config by key', () => {
            const config = getProviderConfig('aliyunCoding');
            expect(config).toBeDefined();
            expect(config.name).toContain('阿里云');
        });

        test('returns null for unknown provider', () => {
            expect(getProviderConfig('unknown')).toBeNull();
        });

        test('resolves aliases', () => {
            const config = getProviderConfig('aliyun');
            expect(config).toBeDefined();
        });
    });

    describe('fillProviderConfig', () => {
        test('fills aliyunCoding from env', () => {
            process.env.ALIYUN_CODING_API_KEY = 'sk-test';
            const config = fillProviderConfig({ provider: 'aliyunCoding' });
            expect(config.apiKey).toBe('sk-test');
            expect(config.model).toBeDefined();
            expect(config.baseURL).toBeDefined();
        });

        test('preserves explicit values', () => {
            const config = fillProviderConfig({ provider: 'aliyunCoding', apiKey: 'explicit', model: 'custom' });
            expect(config.apiKey).toBe('explicit');
            expect(config.model).toBe('custom');
        });

        test('falls back unknown provider to aliyunCoding', () => {
            const config = fillProviderConfig({ provider: 'unknown', apiKey: 'test' });
            expect(config.provider).toBe('aliyunCoding');
        });
    });

    describe('validateConfig', () => {
        test('validates complete config', () => {
            const result = validateConfig({ provider: 'aliyunCoding', apiKey: 'sk-test', model: 'qwen' });
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('invalidates missing apiKey', () => {
            const result = validateConfig({ provider: 'aliyunCoding', model: 'qwen' });
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('invalidates missing model', () => {
            const result = validateConfig({ provider: 'aliyunCoding', apiKey: 'sk-test' });
            expect(result.valid).toBe(false);
        });
    });

    describe('getAvailableProviders', () => {
        test('returns providers with availability info', () => {
            process.env.ALIYUN_CODING_API_KEY = 'sk-test';
            const providers = getAvailableProviders();
            expect(providers.length).toBeGreaterThan(0);
            const ac = providers.find(p => p.id === 'aliyunCoding');
            expect(ac).toBeDefined();
            expect(ac.available).toBe(true);
        });
    });

    describe('getOutlineApiConfig', () => {
        test('returns aliyunCoding config by default', () => {
            process.env.ALIYUN_CODING_API_KEY = 'sk-test';
            delete process.env.LLM_PROVIDER;
            const config = getOutlineApiConfig();
            expect(config).toBeDefined();
            expect(config.provider).toBe('aliyunCoding');
        });

        test('returns deepseek when configured', () => {
            process.env.LLM_PROVIDER = 'deepseek';
            process.env.DEEPSEEK_API_KEY = 'ds-test';
            const config = getOutlineApiConfig();
            expect(config.provider).toBe('deepseek');
        });

        test('returns undefined when no keys available', () => {
            delete process.env.ALIYUN_CODING_API_KEY;
            delete process.env.LLM_PROVIDER;
            delete process.env.DEEPSEEK_API_KEY;
            const config = getOutlineApiConfig();
            expect(config).toBeUndefined();
        });
    });
});
