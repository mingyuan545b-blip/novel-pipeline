/**
 * providerRegistryBranch.test.js
 * 补充providerRegistry.js分支覆盖率
 * 重点：resolveStepConfig的keyId路径、agentModelConfig路径、stepOverrides路径
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn()
}));

jest.mock('../../server/services/cryptoUtil', () => ({
    decrypt: jest.fn((key) => key),
    isEncrypted: jest.fn(() => false)
}));

const store = require('../../server/store');
const { resolveStepConfig, fillProviderConfig, validateConfig, resolveConfig, getOutlineApiConfig } = require('../../server/config/providerRegistry');

describe('providerRegistry branch coverage', () => {
    const origEnv = process.env;

    beforeEach(() => {
        process.env = { ...origEnv, ALIYUN_CODING_API_KEY: 'test-key' };
        store.getItem.mockReset();
    });

    afterAll(() => {
        process.env = origEnv;
    });

    describe('resolveStepConfig — keyId path', () => {
        test('returns config from keyId when keyData has apiKey', async () => {
            store.getItem.mockResolvedValue({ apiKey: 'stored-key', model: 'qwen-test' });
            const project = { agentModelConfig: { writer: { keyId: 'key-1', provider: 'aliyunCoding' } } };
            const config = await resolveStepConfig('writer', project);
            // safeDecryptApiKey returns the key as-is when not encrypted
            expect(config.apiKey).toBe('stored-key');
            expect(config.provider).toBe('aliyunCoding');
        });

        test('falls back to aliyunCoding when keyId has unknown provider', async () => {
            store.getItem.mockResolvedValue({ apiKey: 'stored-key' });
            const project = { agentModelConfig: { writer: { keyId: 'key-1', provider: 'unknownProvider' } } };
            const config = await resolveStepConfig('writer', project);
            expect(config.provider).toBe('aliyunCoding');
        });

        test('falls through when keyData has no apiKey', async () => {
            store.getItem.mockResolvedValue({ model: 'qwen-test' });
            const project = { agentModelConfig: { writer: { keyId: 'key-1' } } };
            process.env.ALIYUN_CODING_API_KEY = 'fallback-key';
            const config = await resolveStepConfig('writer', project);
            expect(config.apiKey).toBeTruthy();
        });
    });

    describe('resolveStepConfig — agentModelConfig without keyId', () => {
        test('uses fillProviderConfig when step config exists without keyId', async () => {
            const project = { agentModelConfig: { writer: { provider: 'aliyunCoding', apiKey: 'direct-key' } } };
            const config = await resolveStepConfig('writer', project);
            expect(config.apiKey).toBe('direct-key');
        });
    });

    describe('resolveStepConfig — stepOverrides path', () => {
        test('checks step overrides when no agentModelConfig', async () => {
            process.env.ALIYUN_CODING_API_KEY = 'override-key';
            const project = { agentStepOverrides: { aliyunCoding: ['writer'] } };
            const config = await resolveStepConfig('writer', project);
            expect(config.provider).toBe('aliyunCoding');
        });
    });

    describe('fillProviderConfig — edge cases', () => {
        test('handles missing provider gracefully', () => {
            const config = fillProviderConfig({ provider: 'nonexistent' });
            expect(config.provider).toBe('aliyunCoding');
        });

        test('uses env vars when apiKey not provided', () => {
            process.env.ALIYUN_CODING_API_KEY = 'env-key';
            const config = fillProviderConfig({ provider: 'aliyunCoding' });
            expect(config.apiKey).toBe('env-key');
        });
    });

    describe('validateConfig', () => {
        test('returns errors for missing fields', () => {
            const result = validateConfig({ provider: '', apiKey: '', model: '' });
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('returns valid for complete config', () => {
            const result = validateConfig({ provider: 'aliyunCoding', apiKey: 'key', model: 'qwen' });
            expect(result.valid).toBe(true);
        });
    });

    describe('resolveConfig', () => {
        test('resolves default when no apiConfig', async () => {
            process.env.ALIYUN_CODING_API_KEY = 'default-key';
            const config = await resolveConfig(null);
            expect(config.provider).toBe('aliyunCoding');
        });

        test('fills provider config when apiConfig provided', async () => {
            const config = await resolveConfig({ provider: 'aliyunCoding', apiKey: 'cfg-key' });
            expect(config.apiKey).toBe('cfg-key');
        });
    });

    describe('getOutlineApiConfig', () => {
        test('returns undefined when no keys configured', () => {
            process.env.ALIYUN_CODING_API_KEY = '';
            process.env.LLM_PROVIDER = '';
            delete process.env.ALIYUN_CODING_API_KEY;
            const config = getOutlineApiConfig();
            expect(config).toBeUndefined();
        });
    });
});
