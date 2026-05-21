const { PROVIDERS, resolveStepConfig, resolveConfig, validateConfig, getAvailableProviders, getOutlineApiConfig, fillProviderConfig } = require('../../server/config/providerRegistry');

describe('Provider Registry', () => {
    test('PROVIDERS has expected providers', () => {
        const expected = ['aliyunCoding', 'minimax', 'openai', 'deepseek', 'siliconflow', 'lmstudio', 'zhipu', 'moonshot', 'custom'];
        for (const id of expected) {
            expect(PROVIDERS[id]).toBeDefined();
            expect(PROVIDERS[id].id).toBe(id);
            expect(PROVIDERS[id].name).toBeDefined();
            expect(PROVIDERS[id].baseURL).toBeDefined();
        }
    });

    test('each provider has required fields', () => {
        for (const [id, p] of Object.entries(PROVIDERS)) {
            expect(p.id).toBe(id);
            expect(p.name).toBeTruthy();
            expect(p.defaultModel).toBeDefined();
            expect(p.models).toBeInstanceOf(Array);
            expect(typeof p.needsGroupId).toBe('boolean');
        }
    });

    test('minimax needs groupId', () => {
        expect(PROVIDERS.minimax.needsGroupId).toBe(true);
        expect(PROVIDERS.minimax.envGroupId).toBe('MINIMAX_GROUP_ID');
    });

    test('lmstudio has noApiKey', () => {
        expect(PROVIDERS.lmstudio.noApiKey).toBe(true);
    });
});

describe('fillProviderConfig', () => {
    test('fills missing fields from provider defaults', () => {
        const config = fillProviderConfig({ provider: 'minimax' });
        expect(config.provider).toBe('minimax');
        expect(config.model).toBe('MiniMax-M2.7');
        expect(config.baseURL).toContain('minimaxi');
    });

    test('preserves explicit values', () => {
        const config = fillProviderConfig({ provider: 'minimax', model: 'MiniMax-Text-01', apiKey: 'test-key' });
        expect(config.model).toBe('MiniMax-Text-01');
        expect(config.apiKey).toBe('test-key');
    });

    test('lmstudio gets default apiKey', () => {
        const config = fillProviderConfig({ provider: 'lmstudio' });
        expect(config.apiKey).toBe('lmstudio');
    });
});

describe('validateConfig', () => {
    test('valid config passes', () => {
        const result = validateConfig({ provider: 'minimax', apiKey: 'test', model: 'MiniMax-M2.7' });
        expect(result.valid).toBe(true);
    });

    test('missing provider fails', () => {
        const result = validateConfig({ apiKey: 'test', model: 'test' });
        expect(result.valid).toBe(false);
    });

    test('missing apiKey fails for non-lmstudio', () => {
        const result = validateConfig({ provider: 'minimax', model: 'test' });
        expect(result.valid).toBe(false);
    });

    test('lmstudio without apiKey is valid', () => {
        const result = validateConfig({ provider: 'lmstudio', model: 'default' });
        expect(result.valid).toBe(true);
    });
});

describe('resolveStepConfig', () => {
    test('returns default config without project', () => {
        const config = resolveStepConfig('writer', null);
        expect(config.provider).toBeDefined();
        expect(config.model).toBeDefined();
    });

    test('project-level config takes priority', () => {
        const project = {
            agentModelConfig: {
                writer: { provider: 'deepseek', apiKey: 'test-key', model: 'deepseek-chat' }
            }
        };
        const config = resolveStepConfig('writer', project);
        expect(config.provider).toBe('deepseek');
        expect(config.model).toBe('deepseek-chat');
    });

    test('keyId-based config resolves from store', () => {
        const project = {
            agentModelConfig: {
                writer: { keyId: 'nonexistent-key', provider: 'minimax' }
            }
        };
        const config = resolveStepConfig('writer', project);
        expect(config).toBeDefined();
    });
});

describe('getAvailableProviders', () => {
    test('returns list of all providers', () => {
        const providers = getAvailableProviders();
        expect(providers.length).toBeGreaterThanOrEqual(8);
        providers.forEach(p => {
            expect(p.id).toBeDefined();
            expect(p.label).toBeDefined();
            expect(typeof p.available).toBe('boolean');
        });
    });
});

describe('llmConfig backward compatibility', () => {
    test('llmConfig re-exports resolveStepConfig', () => {
        const llmConfig = require('../../server/services/llmConfig');
        expect(llmConfig.resolveStepConfig).toBeDefined();
        expect(typeof llmConfig.resolveStepConfig).toBe('function');
    });

    test('llmConfig re-exports resolveConfig', () => {
        const llmConfig = require('../../server/services/llmConfig');
        expect(llmConfig.resolveConfig).toBeDefined();
        expect(typeof llmConfig.resolveConfig).toBe('function');
    });

    test('llmConfig PROVIDER_DEFAULTS is PROVIDERS', () => {
        const llmConfig = require('../../server/services/llmConfig');
        expect(llmConfig.PROVIDER_DEFAULTS).toBe(PROVIDERS);
    });
});
