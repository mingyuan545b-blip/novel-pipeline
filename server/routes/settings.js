const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const llm = require('../services/llm');
const providerRegistry = require('../config/providerRegistry');
const { PROVIDER_DEFAULTS } = require('../config/systemConfig');
const { getConfigStatus, getLLMConfigSummary } = require('../config/configManifest');

const ENV_PATH = path.join(__dirname, '..', '..', '.env');

function maskKey(value) {
    if (!value) return '';
    if (value.length > 8) return value.substring(0, 8) + '***';
    return '***configured***';
}

function updateEnvFile(updates) {
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
        envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    }
    for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null) continue;
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            envContent += `\n${key}=${value}`;
        }
        process.env[key] = value;
    }
    fs.writeFileSync(ENV_PATH, envContent.trim() + '\n', 'utf-8');
}

// GET /api/settings — 当前LLM配置状态
router.get('/', (req, res) => {
    const provider = process.env.LLM_PROVIDER || PROVIDER_DEFAULTS.DEFAULT_PROVIDER;
    const resolved = providerRegistry.resolveProviderKey(provider);
    const pConfig = providerRegistry.getProviderConfig(resolved || 'aliyunCoding');

    const apiKey = pConfig ? (process.env[pConfig.envKey] || '') : '';
    const model = pConfig ? (process.env[pConfig.envModel] || pConfig.defaultModel) : '';
    const baseURL = pConfig ? (pConfig.envBaseURL ? (process.env[pConfig.envBaseURL] || '') : pConfig.baseURL) : '';

    res.json({
        provider,
        providerName: pConfig?.name || provider,
        apiKey: maskKey(apiKey),
        hasKey: !!apiKey,
        model,
        baseURL,
        providers: providerRegistry.getAvailableProviders()
    });
});

// POST /api/settings — 更新LLM配置
router.post('/', (req, res) => {
    const { apiKey, model, provider, baseURL } = req.body;
    const updates = {};

    if (provider) {
        updates.LLM_PROVIDER = provider;
    }

    const resolved = providerRegistry.resolveProviderKey(provider || process.env.LLM_PROVIDER || PROVIDER_DEFAULTS.DEFAULT_PROVIDER);
    const pConfig = providerRegistry.getProviderConfig(resolved || 'aliyunCoding');

    if (pConfig) {
        if (apiKey) {
            updates[pConfig.envKey] = apiKey;
        }
        if (model) {
            updates[pConfig.envModel] = model;
        }
        if (baseURL && pConfig.envBaseURL) {
            updates[pConfig.envBaseURL] = baseURL;
        }
    }

    updateEnvFile(updates);
    res.json({ success: true, message: 'Settings saved' });
});

// POST /api/settings/test — 测试LLM连接
router.post('/test', async (req, res) => {
    try {
        const overrideConfig = req.body?.apiConfig || undefined;
        const result = await llm.testConnection(overrideConfig);
        res.json(result);
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// GET /api/settings/providers — 获取所有可用provider
router.get('/providers', (req, res) => {
    res.json(providerRegistry.getAvailableProviders());
});

// GET /api/settings/config-status — 配置清单状态（供AI新会话快速发现配置）
router.get('/config-status', (req, res) => {
    const clientEnvPath = path.join(__dirname, '..', '..', 'client', '.env.local');
    const clientEnvExists = fs.existsSync(clientEnvPath);
    let clientEnvSynced = false;
    if (clientEnvExists) {
        const content = fs.readFileSync(clientEnvPath, 'utf8');
        const secret = process.env.REQUEST_SECRET || '';
        clientEnvSynced = content.includes(`VITE_REQUEST_SECRET=${secret}`);
    }
    res.json({
        envFile: ENV_PATH,
        envFileExists: fs.existsSync(ENV_PATH),
        clientEnvSynced,
        clientEnvExists,
        authEnabled: !!process.env.REQUEST_SECRET,
        llm: getLLMConfigSummary(),
        items: getConfigStatus()
    });
});

module.exports = router;
