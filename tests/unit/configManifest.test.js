const { getConfigStatus, getLLMConfigSummary, isEnvFilePresent, CONFIG_MANIFEST } = require('../../server/config/configManifest');

describe('configManifest', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('CONFIG_MANIFEST', () => {
        test('is an array of config items', () => {
            expect(Array.isArray(CONFIG_MANIFEST)).toBe(true);
            expect(CONFIG_MANIFEST.length).toBeGreaterThan(0);
        });

        test('each item has required fields', () => {
            for (const item of CONFIG_MANIFEST) {
                expect(item.key).toBeDefined();
                expect(item.label).toBeDefined();
                expect(item.category).toBeDefined();
                expect(typeof item.required).toBe('boolean');
                expect(typeof item.sensitive).toBe('boolean');
            }
        });
    });

    describe('getConfigStatus', () => {
        test('returns array of status items', () => {
            const status = getConfigStatus();
            expect(Array.isArray(status)).toBe(true);
            expect(status.length).toBe(CONFIG_MANIFEST.length);
        });

        test('each item has level and isSet', () => {
            const status = getConfigStatus();
            for (const item of status) {
                expect(item.level).toBeDefined();
                expect(typeof item.isSet).toBe('boolean');
                expect(item.key).toBeDefined();
            }
        });

        test('reports error for missing required key', () => {
            delete process.env.ALIYUN_CODING_API_KEY;
            const status = getConfigStatus();
            const llmKey = status.find(s => s.key === 'ALIYUN_CODING_API_KEY');
            // 前置条件本身成为断言（不满足即失败，不再静默跳过）
            expect(llmKey).toBeDefined();
            expect(llmKey.required).toBe(true);
            expect(llmKey.level).toBe('error');
        });

        test('reports ok for set required key', () => {
            process.env.ALIYUN_CODING_API_KEY = 'sk-test-key-12345678';
            const status = getConfigStatus();
            const llmKey = status.find(s => s.key === 'ALIYUN_CODING_API_KEY');
            expect(llmKey).toBeDefined();
            expect(llmKey.isSet).toBe(true);
            expect(llmKey.level).toBe('ok');
        });

        test('masks sensitive values', () => {
            process.env.ALIYUN_CODING_API_KEY = 'sk-very-long-key-12345678';
            const status = getConfigStatus();
            const llmKey = status.find(s => s.key === 'ALIYUN_CODING_API_KEY');
            expect(llmKey).toBeDefined();
            expect(llmKey.sensitive).toBe(true);
            expect(llmKey.displayValue).toContain('***');
            expect(llmKey.displayValue).not.toBe(process.env.ALIYUN_CODING_API_KEY);
        });
    });

    describe('getLLMConfigSummary', () => {
        test('returns current provider info', () => {
            process.env.LLM_PROVIDER = 'aliyunCoding';
            process.env.ALIYUN_CODING_API_KEY = 'sk-test-key-12345678';
            const summary = getLLMConfigSummary();
            expect(summary.currentProvider).toBe('aliyunCoding');
            expect(summary.hasAnyKey).toBe(true);
        });

        test('detects multiple providers', () => {
            process.env.ALIYUN_CODING_API_KEY = 'sk-test-key-12345678';
            process.env.DEEPSEEK_API_KEY = 'ds-test-key-12345678';
            const summary = getLLMConfigSummary();
            expect(summary.providers.length).toBeGreaterThanOrEqual(2);
        });

        test('reports no keys when none set', () => {
            delete process.env.ALIYUN_CODING_API_KEY;
            delete process.env.DEEPSEEK_API_KEY;
            delete process.env.SILICONFLOW_API_KEY;
            const summary = getLLMConfigSummary();
            expect(summary.hasAnyKey).toBe(false);
        });
    });

    describe('isEnvFilePresent', () => {
        test('returns boolean', () => {
            expect(typeof isEnvFilePresent()).toBe('boolean');
        });
    });
});
