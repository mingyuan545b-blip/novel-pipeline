'use strict';

/**
 * llmConfig + providerRegistry 单元测试（S3）
 *
 * 测试策略：
 * - 不 mock providerRegistry（测试真实逻辑）
 * - mock cryptoUtil（resolveStepConfig 中的解密路径）
 * - mock store（resolveStepConfig 中的 keyId 路径）
 * - 覆盖 fillProviderConfig/resolveStepConfig/resolveConfig/validateConfig/getAvailableProviders
 * - 覆盖 getProviderList/resolveProviderKey/getProviderConfig/getOutlineApiConfig
 *
 * 文件位置：tests/unit/llmConfig.test.js
 */

jest.mock('../../server/shared/logger', () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));

// mock cryptoUtil
jest.mock('../../server/services/cryptoUtil', () => ({
    decrypt: jest.fn(),
    isEncrypted: jest.fn(() => false)
}));

// mock store
const mockStore = new Map();
jest.mock('../../server/store', () => ({
    getItem: jest.fn(async (type, id) => mockStore.get(`${type}:${id}`) || null)
}));

const llmConfig = require('../../server/services/llmConfig');
const providerRegistry = require('../../server/config/providerRegistry');
const { PROVIDERS, DEFAULT_STEP_ASSIGNMENTS } = require('../../server/config/providerDefs');
const cryptoUtil = require('../../server/services/cryptoUtil');
const store = require('../../server/store');

// 保存原始 env
const originalEnv = { ...process.env };

describe('llmConfig + providerRegistry (S3)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStore.clear();
        // 清理 env
        for (const k of Object.keys(process.env)) {
            if (k.startsWith('LLM_') || k.startsWith('ALIYUN_') || k.startsWith('DEEPSEEK_') || k.startsWith('SILICONFLOW_') || k.startsWith('ZHIPU_') || k.startsWith('MOONSHOT_') || k.startsWith('LMSTUDIO_') || k === 'ENCRYPTION_SECRET') {
                delete process.env[k];
            }
        }
    });

    afterAll(() => {
        // 恢复 env
        for (const k of Object.keys(process.env)) {
            if (!(k in originalEnv)) delete process.env[k];
        }
        Object.assign(process.env, originalEnv);
    });

    describe('llmConfig re-exports', () => {
        test('导出 loadEnv 函数', () => {
            expect(typeof llmConfig.loadEnv).toBe('function');
        });

        test('导出 resolveStepConfig', () => {
            expect(typeof llmConfig.resolveStepConfig).toBe('function');
        });

        test('导出 resolveConfig', () => {
            expect(typeof llmConfig.resolveConfig).toBe('function');
        });

        test('导出 fillProviderConfig', () => {
            expect(typeof llmConfig.fillProviderConfig).toBe('function');
        });

        test('导出 validateConfig', () => {
            expect(typeof llmConfig.validateConfig).toBe('function');
        });

        test('导出 PROVIDER_DEFAULTS', () => {
            expect(llmConfig.PROVIDER_DEFAULTS).toBe(PROVIDERS);
        });

        test('导出 DEFAULT_STEP_ASSIGNMENTS', () => {
            expect(llmConfig.DEFAULT_STEP_ASSIGNMENTS).toBe(DEFAULT_STEP_ASSIGNMENTS);
        });

        test('loadEnv 调用 getEnvVar', () => {
            process.env.LLM_PROVIDER = 'deepseek';
            expect(() => llmConfig.loadEnv()).not.toThrow();
        });
    });

    describe('PROVIDERS 常量', () => {
        test('包含 aliyunCoding/deepseek/siliconflow/zhipu/moonshot/lmstudio/custom', () => {
            expect(PROVIDERS.aliyunCoding).toBeDefined();
            expect(PROVIDERS.deepseek).toBeDefined();
            expect(PROVIDERS.siliconflow).toBeDefined();
            expect(PROVIDERS.zhipu).toBeDefined();
            expect(PROVIDERS.moonshot).toBeDefined();
            expect(PROVIDERS.lmstudio).toBeDefined();
            expect(PROVIDERS.custom).toBeDefined();
        });

        test('lmstudio 声明 noThinkMarker/noThinkSystemDirective/requestTimeoutMs 与环境变量三件套（本地思考模型治理）', () => {
            expect(PROVIDERS.lmstudio.noThinkMarker).toBe(' /no_think');
            expect(PROVIDERS.lmstudio.noThinkSystemDirective).toContain('禁止输出任何思考过程');
            expect(PROVIDERS.lmstudio.requestTimeoutMs).toBe(1800000);
            expect(PROVIDERS.lmstudio.envKey).toBe('LMSTUDIO_API_KEY');
            expect(PROVIDERS.lmstudio.envModel).toBe('LMSTUDIO_MODEL');
            expect(PROVIDERS.lmstudio.envBaseURL).toBe('LMSTUDIO_BASE_URL');
            expect(PROVIDERS.lmstudio.aliases).toContain('lm-studio');
        });

        test('aliyunCoding 有 aliases', () => {
            expect(PROVIDERS.aliyunCoding.aliases).toContain('aliyun');
            expect(PROVIDERS.aliyunCoding.aliases).toContain('aliyun-coding');
        });

        test('每个 provider 有 envKey 和 defaultModel', () => {
            for (const [id, p] of Object.entries(PROVIDERS)) {
                if (id === 'custom') continue;
                expect(p.envKey).toBeDefined();
                expect(p.defaultModel).toBeDefined();
            }
        });
    });

    describe('DEFAULT_STEP_ASSIGNMENTS', () => {
        test('aliyunCoding 覆盖所有 11 个 Agent step', () => {
            // 修复：代码已扩展至11个step（新增final-editor等），测试断言未同步（铁律原则2：显式契约）
            // 权威来源：server/config/providerDefs.js 的 DEFAULT_STEP_ASSIGNMENTS
            const steps = DEFAULT_STEP_ASSIGNMENTS.aliyunCoding;
            expect(steps).toContain('writer');
            expect(steps).toContain('reader');
            expect(steps).toContain('reviser');
            expect(steps).toContain('first-review');
            expect(steps).toContain('final-editor');
            expect(steps).toContain('material-organizer');
            expect(steps).toHaveLength(11);
        });
    });

    describe('getProviderList', () => {
        test('返回所有 provider 的列表', () => {
            const list = providerRegistry.getProviderList();
            expect(list.length).toBeGreaterThanOrEqual(6);
            const keys = list.map(p => p.key);
            expect(keys).toContain('aliyunCoding');
            expect(keys).toContain('deepseek');
        });

        test('available 字段反映 envKey 是否设置', () => {
            process.env.ALIYUN_CODING_API_KEY = 'test-key';
            const list = providerRegistry.getProviderList();
            const aliyun = list.find(p => p.key === 'aliyunCoding');
            expect(aliyun.available).toBe(true);
        });

        test('未设置 envKey 时 available=false', () => {
            const list = providerRegistry.getProviderList();
            const deepseek = list.find(p => p.key === 'deepseek');
            expect(deepseek.available).toBe(false);
        });
    });

    describe('resolveProviderKey', () => {
        test('直接匹配 key', () => {
            expect(providerRegistry.resolveProviderKey('aliyunCoding')).toBe('aliyunCoding');
            expect(providerRegistry.resolveProviderKey('deepseek')).toBe('deepseek');
        });

        test('通过 alias 匹配', () => {
            expect(providerRegistry.resolveProviderKey('aliyun')).toBe('aliyunCoding');
            expect(providerRegistry.resolveProviderKey('aliyun-coding')).toBe('aliyunCoding');
            expect(providerRegistry.resolveProviderKey('aliyun_coding')).toBe('aliyunCoding');
        });

        test('未知 key 返回 null', () => {
            expect(providerRegistry.resolveProviderKey('unknown')).toBeNull();
        });
    });

    describe('getProviderConfig', () => {
        test('返回 provider 配置', () => {
            const cfg = providerRegistry.getProviderConfig('aliyunCoding');
            expect(cfg).toBeDefined();
            expect(cfg.name).toContain('阿里云');
        });

        test('通过 alias 返回配置', () => {
            const cfg = providerRegistry.getProviderConfig('aliyun');
            expect(cfg).toBeDefined();
            expect(cfg.id).toBe('aliyunCoding');
        });

        test('未知 key 返回 null', () => {
            expect(providerRegistry.getProviderConfig('unknown')).toBeNull();
        });
    });

    describe('fillProviderConfig', () => {
        test('完整 cfg 原样保留', () => {
            const cfg = providerRegistry.fillProviderConfig({
                provider: 'deepseek',
                apiKey: 'key123',
                model: 'deepseek-chat',
                baseURL: 'https://custom.api.com',
                groupId: 'g1'
            });
            expect(cfg.provider).toBe('deepseek');
            expect(cfg.apiKey).toBe('key123');
            expect(cfg.model).toBe('deepseek-chat');
            expect(cfg.baseURL).toBe('https://custom.api.com');
            expect(cfg.groupId).toBe('g1');
        });

        test('cfg 缺失字段从 env/default 填充', () => {
            process.env.DEEPSEEK_API_KEY = 'env-key';
            const cfg = providerRegistry.fillProviderConfig({ provider: 'deepseek' });
            expect(cfg.apiKey).toBe('env-key');
            expect(cfg.model).toBe('deepseek-chat'); // defaultModel
        });

        test('未知 provider 回退到 aliyunCoding', () => {
            const cfg = providerRegistry.fillProviderConfig({ provider: 'unknown' });
            expect(cfg.provider).toBe('aliyunCoding');
        });

        test('provider 缺失默认 aliyunCoding', () => {
            const cfg = providerRegistry.fillProviderConfig({});
            expect(cfg.provider).toBe('aliyunCoding');
        });

        test('apiKey 空时从 envKey 读取', () => {
            process.env.ALIYUN_CODING_API_KEY = 'aliyun-key';
            const cfg = providerRegistry.fillProviderConfig({ provider: 'aliyunCoding' });
            expect(cfg.apiKey).toBe('aliyun-key');
        });

        test('envBaseURL 覆盖默认 baseURL', () => {
            process.env.ALIYUN_CODING_BASE_URL = 'https://custom.base.url';
            const cfg = providerRegistry.fillProviderConfig({ provider: 'aliyunCoding' });
            expect(cfg.baseURL).toBe('https://custom.base.url');
        });
    });

    describe('resolveStepConfig', () => {
        test('keyId 路径：从 api-keys store 读取', async () => {
            mockStore.set('api-keys:k1', {
                apiKey: 'key-from-store',
                groupId: 'g1',
                model: 'custom-model',
                baseURL: 'https://custom.url',
                provider: 'deepseek'
            });
            const project = { agentModelConfig: { writer: { keyId: 'k1', provider: 'deepseek' } } };
            const cfg = await providerRegistry.resolveStepConfig('writer', project);
            expect(cfg.apiKey).toBe('key-from-store');
            expect(cfg.provider).toBe('deepseek');
            expect(cfg.model).toBe('custom-model');
        });

        test('keyId 路径：未知 provider 回退 aliyunCoding', async () => {
            mockStore.set('api-keys:k1', { apiKey: 'key1', provider: 'unknown' });
            const project = { agentModelConfig: { writer: { keyId: 'k1', provider: 'unknown' } } };
            const cfg = await providerRegistry.resolveStepConfig('writer', project);
            expect(cfg.provider).toBe('aliyunCoding');
        });

        test('agentModelConfig 有 step 但无 keyId：走 fillProviderConfig', async () => {
            const project = { agentModelConfig: { writer: { provider: 'deepseek', apiKey: 'direct-key' } } };
            const cfg = await providerRegistry.resolveStepConfig('writer', project);
            expect(cfg.apiKey).toBe('direct-key');
            expect(cfg.provider).toBe('deepseek');
        });

        test('DEFAULT_STEP_ASSIGNMENTS 路径：env 有 key 时匹配', async () => {
            process.env.ALIYUN_CODING_API_KEY = 'aliyun-env-key';
            const cfg = await providerRegistry.resolveStepConfig('writer', null);
            expect(cfg.provider).toBe('aliyunCoding');
            expect(cfg.apiKey).toBe('aliyun-env-key');
        });

        test('DEFAULT_STEP_ASSIGNMENTS 路径：LMSTUDIO key 存在时优先本地（顺序在云端前）', async () => {
            process.env.LMSTUDIO_API_KEY = 'lm-studio';
            process.env.LMSTUDIO_BASE_URL = 'http://127.0.0.1:1234/v1';
            process.env.LMSTUDIO_MODEL = 'qwen3.8-27b';
            process.env.ALIYUN_CODING_API_KEY = 'aliyun-env-key';
            const cfg = await providerRegistry.resolveStepConfig('writer', null);
            expect(cfg.provider).toBe('lmstudio');
            expect(cfg.baseURL).toBe('http://127.0.0.1:1234/v1');
            expect(cfg.model).toBe('qwen3.8-27b');
        });

        test('DEFAULT_STEP_ASSIGNMENTS 路径：LMSTUDIO key 缺失时回落云端', async () => {
            process.env.ALIYUN_CODING_API_KEY = 'aliyun-env-key';
            const cfg = await providerRegistry.resolveStepConfig('first-review', null);
            expect(cfg.provider).toBe('aliyunCoding');
        });

        test('LLM_PROVIDER 全局回退路径', async () => {
            process.env.LLM_PROVIDER = 'deepseek';
            process.env.DEEPSEEK_API_KEY = 'deepseek-key';
            const cfg = await providerRegistry.resolveStepConfig('unknown-step', null);
            expect(cfg.provider).toBe('deepseek');
            expect(cfg.apiKey).toBe('deepseek-key');
        });

        test('LLM_PROVIDER 为 alias 时解析', async () => {
            process.env.LLM_PROVIDER = 'aliyun';
            process.env.ALIYUN_CODING_API_KEY = 'aliyun-key';
            const cfg = await providerRegistry.resolveStepConfig('unknown-step', null);
            expect(cfg.provider).toBe('aliyunCoding');
        });

        test('无任何配置时回退 aliyunCoding 空 key', async () => {
            const cfg = await providerRegistry.resolveStepConfig('writer', null);
            expect(cfg.provider).toBe('aliyunCoding');
            expect(cfg.apiKey).toBe('');
        });

        test('agentStepOverrides 合并到 DEFAULT_STEP_ASSIGNMENTS', async () => {
            process.env.ALIYUN_CODING_API_KEY = 'aliyun-key';
            // agentStepOverrides 只能扩展已有 provider 的 steps，不能添加新 provider
            const project = { agentStepOverrides: { aliyunCoding: ['custom-step'] } };
            const cfg = await providerRegistry.resolveStepConfig('custom-step', project);
            expect(cfg.provider).toBe('aliyunCoding');
            expect(cfg.apiKey).toBe('aliyun-key');
        });

        test('keyId 存在但 keyData 无 apiKey：回退到 agentModelConfig[step]', async () => {
            mockStore.set('api-keys:k1', { groupId: 'g1' }); // 无 apiKey
            const project = {
                agentModelConfig: { writer: { keyId: 'k1', provider: 'deepseek', apiKey: 'fallback-key' } }
            };
            const cfg = await providerRegistry.resolveStepConfig('writer', project);
            expect(cfg.apiKey).toBe('fallback-key');
        });

        test('加密 apiKey 解密成功', async () => {
            process.env.ENCRYPTION_SECRET = 'secret';
            cryptoUtil.isEncrypted.mockReturnValue(true);
            cryptoUtil.decrypt.mockReturnValue('decrypted-key');
            mockStore.set('api-keys:k1', { apiKey: 'enc-key', provider: 'deepseek' });
            const project = { agentModelConfig: { writer: { keyId: 'k1', provider: 'deepseek' } } };
            const cfg = await providerRegistry.resolveStepConfig('writer', project);
            expect(cfg.apiKey).toBe('decrypted-key');
        });

        test('加密 apiKey 解密失败回退原值', async () => {
            process.env.ENCRYPTION_SECRET = 'secret';
            cryptoUtil.isEncrypted.mockReturnValue(true);
            cryptoUtil.decrypt.mockImplementation(() => { throw new Error('decrypt failed'); });
            mockStore.set('api-keys:k1', { apiKey: 'enc-key', provider: 'deepseek' });
            const project = { agentModelConfig: { writer: { keyId: 'k1', provider: 'deepseek' } } };
            const cfg = await providerRegistry.resolveStepConfig('writer', project);
            expect(cfg.apiKey).toBe('enc-key');
        });
    });

    describe('resolveConfig', () => {
        test('apiConfig 为 null 时走 resolveStepConfig(_default)', async () => {
            process.env.ALIYUN_CODING_API_KEY = 'aliyun-key';
            const cfg = await providerRegistry.resolveConfig(null);
            expect(cfg.provider).toBe('aliyunCoding');
        });

        test('apiConfig 存在时走 fillProviderConfig', async () => {
            const cfg = await providerRegistry.resolveConfig({ provider: 'deepseek', apiKey: 'k1' });
            expect(cfg.provider).toBe('deepseek');
            expect(cfg.apiKey).toBe('k1');
        });
    });

    describe('validateConfig', () => {
        test('完整配置 valid=true', () => {
            const result = providerRegistry.validateConfig({ provider: 'deepseek', apiKey: 'k1', model: 'm1' });
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('缺 provider 报错', () => {
            const result = providerRegistry.validateConfig({ apiKey: 'k1', model: 'm1' });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('provider 未指定');
        });

        test('缺 apiKey 报错', () => {
            const result = providerRegistry.validateConfig({ provider: 'deepseek', model: 'm1' });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('apiKey'))).toBe(true);
        });

        test('缺 model 报错', () => {
            const result = providerRegistry.validateConfig({ provider: 'deepseek', apiKey: 'k1' });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('model 未指定');
        });

        test('多字段缺失报多条错误', () => {
            const result = providerRegistry.validateConfig({});
            expect(result.errors).toHaveLength(3);
        });
    });

    describe('getAvailableProviders', () => {
        test('返回所有 provider', () => {
            const list = providerRegistry.getAvailableProviders();
            expect(list.length).toBeGreaterThanOrEqual(6);
        });

        test('设置 envKey 的 provider available=true', () => {
            process.env.DEEPSEEK_API_KEY = 'key';
            const list = providerRegistry.getAvailableProviders();
            const deepseek = list.find(p => p.id === 'deepseek');
            expect(deepseek.available).toBe(true);
        });

        test('未设置 envKey 的 provider available=false', () => {
            const list = providerRegistry.getAvailableProviders();
            const moonshot = list.find(p => p.id === 'moonshot');
            expect(moonshot.available).toBe(false);
        });

        test('每个 provider 包含 label/defaultModel/models', () => {
            const list = providerRegistry.getAvailableProviders();
            for (const p of list) {
                expect(p.label).toBeDefined();
                expect(p.defaultModel).toBeDefined();
                expect(Array.isArray(p.models)).toBe(true);
            }
        });
    });

    describe('getOutlineApiConfig', () => {
        test('LLM_PROVIDER=aliyunCoding 且有 key 返回配置', () => {
            process.env.LLM_PROVIDER = 'aliyunCoding';
            process.env.ALIYUN_CODING_API_KEY = 'key';
            const cfg = providerRegistry.getOutlineApiConfig();
            expect(cfg.provider).toBe('aliyunCoding');
            expect(cfg.apiKey).toBe('key');
        });

        test('LLM_PROVIDER=deepseek 且有 key 返回配置', () => {
            process.env.LLM_PROVIDER = 'deepseek';
            process.env.DEEPSEEK_API_KEY = 'key';
            const cfg = providerRegistry.getOutlineApiConfig();
            expect(cfg.provider).toBe('deepseek');
            expect(cfg.apiKey).toBe('key');
        });

        test('LLM_PROVIDER 未设置但有 ALIYUN_CODING_API_KEY 回退', () => {
            process.env.ALIYUN_CODING_API_KEY = 'key';
            const cfg = providerRegistry.getOutlineApiConfig();
            expect(cfg.provider).toBe('aliyunCoding');
        });

        test('无任何 key 返回 undefined', () => {
            const cfg = providerRegistry.getOutlineApiConfig();
            expect(cfg).toBeUndefined();
        });
    });
});
