const PROVIDERS = {
    aliyunCoding: {
        id: 'aliyunCoding',
        name: '阿里云百炼(Coding Plan)',
        baseURL: 'https://coding.dashscope.aliyuncs.com/v1',
        models: ['qwen3.6-plus'],
        defaultModel: 'qwen3.6-plus',
        needsGroupId: false,
        envKey: 'ALIYUN_CODING_API_KEY',
        envModel: 'ALIYUN_CODING_MODEL',
        noApiKey: false
    },
    minimax: {
        id: 'minimax',
        name: 'MiniMax',
        baseURL: 'https://api.minimaxi.com/v1',
        models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M1', 'MiniMax-Text-01'],
        defaultModel: 'MiniMax-M2.7',
        needsGroupId: true,
        envKey: 'MINIMAX_API_KEY',
        envModel: 'MINIMAX_MODEL',
        envGroupId: 'MINIMAX_GROUP_ID',
        noApiKey: false
    },
    openai: {
        id: 'openai',
        name: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini'],
        defaultModel: 'gpt-4o',
        needsGroupId: false,
        envKey: 'OPENAI_API_KEY',
        envModel: 'OPENAI_MODEL',
        noApiKey: false
    },
    deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        baseURL: 'https://api.deepseek.com',
        models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-pro'],
        defaultModel: 'deepseek-chat',
        needsGroupId: false,
        envKey: 'DEEPSEEK_API_KEY',
        envModel: 'DEEPSEEK_MODEL',
        envBaseURL: 'DEEPSEEK_BASE_URL',
        noApiKey: false
    },
    siliconflow: {
        id: 'siliconflow',
        name: '硅基流动',
        baseURL: 'https://api.siliconflow.cn/v1',
        models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-32B-Instruct', 'Qwen/Qwen2.5-Coder-32B-Instruct', 'Qwen/Qwen3-235B-A22B', 'Qwen/Qwen3-32B', 'Qwen/Qwen3.5-27B'],
        defaultModel: 'deepseek-ai/DeepSeek-V3',
        needsGroupId: false,
        envKey: 'SILICONFLOW_API_KEY',
        envModel: 'SILICONFLOW_MODEL',
        noApiKey: false
    },
    lmstudio: {
        id: 'lmstudio',
        name: 'LM Studio (本地)',
        baseURL: 'http://localhost:1234/v1',
        models: [],
        defaultModel: 'default',
        needsGroupId: false,
        envKey: 'LMSTUDIO_API_KEY',
        envModel: 'LMSTUDIO_MODEL',
        envBaseURL: 'LMSTUDIO_BASE_URL',
        noApiKey: true
    },
    zhipu: {
        id: 'zhipu',
        name: '智谱AI',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        models: ['glm-4-plus', 'glm-4-0520', 'glm-4-air', 'glm-4-airx', 'glm-4-long', 'glm-4-flash', 'glm-4-flashx'],
        defaultModel: 'glm-4-plus',
        needsGroupId: false,
        envKey: 'ZHIPU_API_KEY',
        envModel: 'ZHIPU_MODEL',
        noApiKey: false
    },
    moonshot: {
        id: 'moonshot',
        name: '月之暗面',
        baseURL: 'https://api.moonshot.cn/v1',
        models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'],
        defaultModel: 'moonshot-v1-128k',
        needsGroupId: false,
        envKey: 'MOONSHOT_API_KEY',
        envModel: 'MOONSHOT_MODEL',
        noApiKey: false
    },
    custom: {
        id: 'custom',
        name: '自定义',
        baseURL: '',
        models: [],
        defaultModel: '',
        needsGroupId: false,
        noApiKey: false
    }
};

const DEFAULT_STEP_ASSIGNMENTS = {
    aliyunCoding: ['writer', 'reader', 'adjuster', 'reviser', 'intent-planner', 'material-manager', 'polisher', 'first-review', 'second-review', 'fast-review', 'final-editor'],
    minimax: [],
    lmstudio: []
};

function getProviderList() {
    return Object.entries(PROVIDERS).map(([key, val]) => ({
        key,
        name: val.name,
        baseURL: val.baseURL,
        models: val.models,
        needsGroupId: val.needsGroupId,
        defaultModel: val.defaultModel,
        available: !!(process.env[val.envKey] || val.noApiKey)
    }));
}

function getProviderConfig(providerKey) {
    return PROVIDERS[providerKey] || null;
}

function getEnvVar(key) {
    return process.env[key] || '';
}

function fillProviderConfig(cfg) {
    const provider = cfg.provider || 'minimax';
    const pDefaults = PROVIDERS[provider];
    if (!pDefaults) return cfg;

    let apiKey = cfg.apiKey;
    if (!apiKey && !pDefaults.noApiKey) {
        apiKey = getEnvVar(pDefaults.envKey);
    }
    if (!apiKey && pDefaults.noApiKey) {
        apiKey = 'lmstudio';
    }

    return {
        provider,
        apiKey: apiKey || '',
        groupId: cfg.groupId || (pDefaults.envGroupId ? getEnvVar(pDefaults.envGroupId) : '') || '',
        model: cfg.model || getEnvVar(pDefaults.envModel) || pDefaults.defaultModel,
        baseURL: cfg.baseURL || (pDefaults.envBaseURL ? getEnvVar(pDefaults.envBaseURL) : '') || pDefaults.baseURL
    };
}

function resolveStepConfig(step, project) {
    const { decrypt: decryptApiKey, isEncrypted: isApiKeyEncrypted } = require('../services/cryptoUtil');
    const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '';

    function safeDecryptApiKey(encryptedKey) {
        if (!ENCRYPTION_SECRET || !isApiKeyEncrypted(encryptedKey)) return encryptedKey;
        try { return decryptApiKey(encryptedKey, ENCRYPTION_SECRET); } catch (_) { return encryptedKey; }
    }

    if (project?.agentModelConfig?.[step]?.keyId) {
        const store = require('../store');
        const keyData = store.getItem('api-keys', project.agentModelConfig[step].keyId);
        if (keyData?.apiKey) {
            const provider = project.agentModelConfig[step].provider || 'minimax';
            const pDefaults = PROVIDERS[provider];
            return {
                provider,
                apiKey: safeDecryptApiKey(keyData.apiKey),
                groupId: keyData.groupId || '',
                model: keyData.model || pDefaults?.defaultModel || 'MiniMax-M2.7',
                baseURL: keyData.baseURL || pDefaults?.baseURL || 'https://api.minimaxi.com/v1'
            };
        }
    }

    if (project?.agentModelConfig?.[step]) {
        return fillProviderConfig({ ...project.agentModelConfig[step] });
    }

    const stepOverrides = project?.agentStepOverrides || {};
    const mergedAssignments = {};
    for (const [provider, steps] of Object.entries(DEFAULT_STEP_ASSIGNMENTS)) {
        mergedAssignments[provider] = [...steps, ...(stepOverrides[provider] || [])];
    }

    for (const [provider, steps] of Object.entries(mergedAssignments)) {
        if (steps.includes(step)) {
            const pDefaults = PROVIDERS[provider];
            if (!pDefaults) continue;
            const apiKey = getEnvVar(pDefaults.envKey);
            if (apiKey || pDefaults.noApiKey) {
                return {
                    provider,
                    apiKey: apiKey || 'lmstudio',
                    groupId: pDefaults.envGroupId ? getEnvVar(pDefaults.envGroupId) : '',
                    model: getEnvVar(pDefaults.envModel) || pDefaults.defaultModel,
                    baseURL: pDefaults.envBaseURL ? getEnvVar(pDefaults.envBaseURL) : pDefaults.baseURL
                };
            }
        }
    }

    const globalProvider = getEnvVar('LLM_PROVIDER') || 'minimax';
    const pDefaults = PROVIDERS[globalProvider] || PROVIDERS.minimax;
    return {
        provider: globalProvider,
        apiKey: getEnvVar('LLM_API_KEY') || getEnvVar(pDefaults.envKey) || (pDefaults.noApiKey ? 'lmstudio' : ''),
        groupId: getEnvVar('LLM_GROUP_ID') || getEnvVar(pDefaults.envGroupId || '') || '',
        model: getEnvVar('LLM_MODEL') || getEnvVar(pDefaults.envModel) || pDefaults.defaultModel,
        baseURL: getEnvVar('LLM_BASE_URL') || getEnvVar(pDefaults.envBaseURL || '') || pDefaults.baseURL
    };
}

function resolveConfig(apiConfig) {
    if (!apiConfig) {
        return resolveStepConfig('_default', null);
    }
    return fillProviderConfig(apiConfig);
}

function validateConfig(config) {
    const errors = [];
    if (!config.provider) errors.push('provider 未指定');
    if (!config.apiKey && config.provider !== 'lmstudio') errors.push(`${config.provider} apiKey 未配置`);
    if (!config.model) errors.push('model 未指定');
    return { valid: errors.length === 0, errors };
}

function getAvailableProviders() {
    const providers = [];
    for (const [id, p] of Object.entries(PROVIDERS)) {
        const apiKey = getEnvVar(p.envKey);
        providers.push({
            id,
            label: p.name,
            available: !!(apiKey || p.noApiKey),
            defaultModel: p.defaultModel,
            models: p.models || [p.defaultModel]
        });
    }
    return providers;
}

function getOutlineApiConfig() {
    const globalProvider = getEnvVar('LLM_PROVIDER');
    if (globalProvider === 'lmstudio') {
        return { provider: 'lmstudio', apiKey: 'lmstudio', model: getEnvVar('LMSTUDIO_MODEL') || 'default', baseURL: getEnvVar('LMSTUDIO_BASE_URL') || 'http://localhost:1234/v1' };
    }
    if (globalProvider === 'deepseek' && getEnvVar('DEEPSEEK_API_KEY')) {
        return { provider: 'deepseek', apiKey: getEnvVar('DEEPSEEK_API_KEY'), model: getEnvVar('DEEPSEEK_MODEL') || 'deepseek-chat', baseURL: getEnvVar('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com' };
    }
    const aliyunKey = getEnvVar('ALIYUN_CODING_API_KEY');
    if (aliyunKey) {
        return { provider: 'aliyunCoding', apiKey: aliyunKey, model: getEnvVar('ALIYUN_CODING_MODEL') || 'qwen3.6-plus', baseURL: 'https://coding.dashscope.aliyuncs.com/v1' };
    }
    if (getEnvVar('MINIMAX_API_KEY')) {
        return { provider: 'minimax', apiKey: getEnvVar('MINIMAX_API_KEY'), groupId: getEnvVar('MINIMAX_GROUP_ID') || '', model: getEnvVar('MINIMAX_MODEL') || 'MiniMax-M2.7', baseURL: 'https://api.minimaxi.com/v1' };
    }
    return undefined;
}

module.exports = {
    PROVIDERS,
    DEFAULT_STEP_ASSIGNMENTS,
    getProviderList,
    getProviderConfig,
    fillProviderConfig,
    resolveStepConfig,
    resolveConfig,
    validateConfig,
    getAvailableProviders,
    getOutlineApiConfig
};
