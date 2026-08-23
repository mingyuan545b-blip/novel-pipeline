const logger = require('../shared/logger');
const { PROVIDER_DEFAULTS } = require('./systemConfig');
const { DEFAULT_MODEL } = require('./modelResolver');
const { PROVIDERS, DEFAULT_STEP_ASSIGNMENTS } = require('./providerDefs');

function getProviderList() {
    return Object.entries(PROVIDERS).map(([key, val]) => ({
        key,
        name: val.name,
        baseURL: val.baseURL,
        models: val.models,
        needsGroupId: val.needsGroupId,
        defaultModel: val.defaultModel,
        available: !!process.env[val.envKey]
    }));
}

function resolveProviderKey(key) {
    if (PROVIDERS[key]) return key;
    for (const [id, p] of Object.entries(PROVIDERS)) {
        if (p.aliases && p.aliases.includes(key)) return id;
    }
    return null;
}

function getProviderConfig(providerKey) {
    return PROVIDERS[resolveProviderKey(providerKey)] || null;
}

function getEnvVar(key) {
    return process.env[key] || '';
}

function fillProviderConfig(cfg) {
    let provider = cfg.provider || 'aliyunCoding';
    const pDefaults = PROVIDERS[provider];
    if (!pDefaults) {
        logger.warn('providerRegistry', `Unknown provider "${cfg.provider}", falling back to aliyunCoding`);
        provider = 'aliyunCoding';
    }
    const resolved = PROVIDERS[provider];

    let apiKey = cfg.apiKey;
    if (!apiKey) {
        apiKey = getEnvVar(resolved.envKey);
    }

    return {
        provider,
        apiKey: apiKey || '',
        groupId: cfg.groupId || (resolved.envGroupId ? getEnvVar(resolved.envGroupId) : '') || '',
        model: cfg.model || getEnvVar(resolved.envModel) || resolved.defaultModel,
        baseURL: cfg.baseURL || (resolved.envBaseURL ? getEnvVar(resolved.envBaseURL) : '') || resolved.baseURL
    };
}

async function resolveStepConfig(step, project) {
    const { decrypt: decryptApiKey, isEncrypted: isApiKeyEncrypted } = require('../services/cryptoUtil');
    const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '';

    function safeDecryptApiKey(encryptedKey) {
        if (!ENCRYPTION_SECRET || !isApiKeyEncrypted(encryptedKey)) return encryptedKey;
        try { return decryptApiKey(encryptedKey, ENCRYPTION_SECRET); } catch (_) { return encryptedKey; }
    }

    if (project?.agentModelConfig?.[step]?.keyId) {
        const store = require('../store');
        const keyData = await store.getItem('api-keys', project.agentModelConfig[step].keyId);
        if (keyData?.apiKey) {
            let provider = project.agentModelConfig[step].provider || 'aliyunCoding';
            const pDefaults = PROVIDERS[provider];
            if (!pDefaults) {
                logger.warn('providerRegistry', `Unknown provider "${provider}" in keyId path, falling back to aliyunCoding`);
                provider = 'aliyunCoding';
            }
            const resolved = PROVIDERS[provider];
            return {
                provider,
                apiKey: safeDecryptApiKey(keyData.apiKey),
                groupId: keyData.groupId || '',
                model: keyData.model || resolved.defaultModel,
                baseURL: keyData.baseURL || resolved.baseURL || PROVIDER_DEFAULTS.ALIYUN_CODING_BASE_URL
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
            if (apiKey) {
                return {
                    provider,
                    apiKey,
                    groupId: pDefaults.envGroupId ? getEnvVar(pDefaults.envGroupId) : '',
                    model: getEnvVar(pDefaults.envModel) || pDefaults.defaultModel,
                    baseURL: pDefaults.envBaseURL ? getEnvVar(pDefaults.envBaseURL) : pDefaults.baseURL
                };
            }
        }
    }

    const globalProvider = resolveProviderKey(getEnvVar('LLM_PROVIDER')) || 'aliyunCoding';
    const pDefaults = PROVIDERS[globalProvider] || PROVIDERS.aliyunCoding;
    const apiKey = getEnvVar('LLM_API_KEY') || getEnvVar(pDefaults.envKey) || '';
    logger.info('providerRegistry', `[PROVIDER-DEBUG] globalProvider=${globalProvider}, pDefaults.envKey=${pDefaults.envKey}, apiKey=${apiKey ? apiKey.substring(0, 10) + '...' : '(empty)'}`);
    return {
        provider: globalProvider,
        apiKey,
        groupId: getEnvVar('LLM_GROUP_ID') || getEnvVar(pDefaults.envGroupId || '') || '',
        model: getEnvVar('LLM_MODEL') || getEnvVar(pDefaults.envModel) || pDefaults.defaultModel,
        baseURL: getEnvVar('LLM_BASE_URL') || getEnvVar(pDefaults.envBaseURL || '') || pDefaults.baseURL
    };
}

async function resolveConfig(apiConfig) {
    if (!apiConfig) {
        return resolveStepConfig('_default', null);
    }
    return fillProviderConfig(apiConfig);
}

function validateConfig(config) {
    const errors = [];
    if (!config.provider) errors.push('provider 未指定');
    if (!config.apiKey) errors.push(`${config.provider} apiKey 未配置`);
    if (!config.model) errors.push('model 未指定');
    return { valid: errors.length === 0, errors };
}

function getAvailableProviders() {
    const providers = [];
    for (const [id, p] of Object.entries(PROVIDERS)) {
        const apiKey = getEnvVar(p.envKey);
        providers.push({
            id, label: p.name, available: !!apiKey,
            defaultModel: p.defaultModel, models: p.models || [p.defaultModel]
        });
    }
    return providers;
}

function getOutlineApiConfig() {
    const globalProvider = getEnvVar('LLM_PROVIDER');
    const aliyunBaseURL = getEnvVar('ALIYUN_CODING_BASE_URL') || PROVIDER_DEFAULTS.ALIYUN_CODING_BASE_URL;
    if (globalProvider === 'aliyunCoding' && getEnvVar('ALIYUN_CODING_API_KEY')) {
        return { provider: 'aliyunCoding', apiKey: getEnvVar('ALIYUN_CODING_API_KEY'), model: getEnvVar('ALIYUN_CODING_MODEL') || DEFAULT_MODEL, baseURL: aliyunBaseURL };
    }
    if (globalProvider === 'deepseek' && getEnvVar('DEEPSEEK_API_KEY')) {
        return { provider: 'deepseek', apiKey: getEnvVar('DEEPSEEK_API_KEY'), model: getEnvVar('DEEPSEEK_MODEL') || 'deepseek-chat', baseURL: getEnvVar('DEEPSEEK_BASE_URL') || PROVIDER_DEFAULTS.DEEPSEEK_BASE_URL };
    }
    const aliyunKey = getEnvVar('ALIYUN_CODING_API_KEY');
    if (aliyunKey) {
        return { provider: 'aliyunCoding', apiKey: aliyunKey, model: getEnvVar('ALIYUN_CODING_MODEL') || DEFAULT_MODEL, baseURL: aliyunBaseURL };
    }
    return undefined;
}

module.exports = {
    PROVIDERS,
    DEFAULT_STEP_ASSIGNMENTS,
    getProviderList,
    resolveProviderKey,
    getProviderConfig,
    getEnvVar,
    fillProviderConfig,
    resolveStepConfig,
    resolveConfig,
    validateConfig,
    getAvailableProviders,
    getOutlineApiConfig
};
