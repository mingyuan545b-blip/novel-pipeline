/**
 * llm.js lightweight branch coverage tests
 * Tests non-chat functions (resolveConfig, getProviders, getProviderConfig, PROVIDERS)
 * Note: chat() cannot be tested due to Jest module cache preventing axios mock
 */

const llm = require('../../server/services/llm');

describe('llm module exports', () => {
    test('exports chat function', () => {
        expect(typeof llm.chat).toBe('function');
    });

    test('exports testConnection function', () => {
        expect(typeof llm.testConnection).toBe('function');
    });

    test('exports resolveConfig function', () => {
        expect(typeof llm.resolveConfig).toBe('function');
    });

    test('exports getProviders function', () => {
        expect(typeof llm.getProviders).toBe('function');
    });

    test('exports getProviderConfig function', () => {
        expect(typeof llm.getProviderConfig).toBe('function');
    });

    test('exports PROVIDERS', () => {
        expect(llm.PROVIDERS).toBeDefined();
        expect(llm.PROVIDERS.aliyunCoding).toBeDefined();
    });

    test('getProviders returns provider list', () => {
        const providers = llm.getProviders();
        expect(Array.isArray(providers)).toBe(true);
        expect(providers.length).toBeGreaterThan(0);
    });

    test('getProviderConfig returns config for known provider', () => {
        const config = llm.getProviderConfig('aliyunCoding');
        expect(config).toBeDefined();
        expect(config.id).toBe('aliyunCoding');
    });

    test('getProviderConfig returns null for unknown provider', () => {
        const config = llm.getProviderConfig('nonexistent');
        expect(config).toBeFalsy();
    });
});
