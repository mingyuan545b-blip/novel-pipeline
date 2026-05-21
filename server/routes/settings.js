const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const llm = require('../services/llm');

const ENV_PATH = path.join(__dirname, '..', '..', '.env');

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

router.get('/', (req, res) => {
    const provider = process.env.LLM_PROVIDER || 'minimax';
    res.json({
        apiKey: (process.env.MINIMAX_API_KEY || process.env.LLM_API_KEY) ? '***configured***' : '',
        groupId: process.env.MINIMAX_GROUP_ID || process.env.LLM_GROUP_ID || '',
        model: process.env.MINIMAX_MODEL || process.env.LLM_MODEL || 'MiniMax-M2.7',
        provider,
        baseURL: process.env.LLM_BASE_URL || '',
        hasKey: !!(process.env.MINIMAX_API_KEY || process.env.LLM_API_KEY)
    });
});

router.post('/', (req, res) => {
    const { apiKey, groupId, model, provider, baseURL } = req.body;
    const updates = {};
    if (apiKey) {
        updates.MINIMAX_API_KEY = apiKey;
        updates.LLM_API_KEY = apiKey;
    }
    if (groupId) {
        updates.MINIMAX_GROUP_ID = groupId;
        updates.LLM_GROUP_ID = groupId;
    }
    if (model) {
        updates.MINIMAX_MODEL = model;
        updates.LLM_MODEL = model;
    }
    if (provider) updates.LLM_PROVIDER = provider;
    if (baseURL) updates.LLM_BASE_URL = baseURL;
    updateEnvFile(updates);
    res.json({ success: true, message: 'Settings saved' });
});

router.post('/test', async (req, res) => {
    try {
        const overrideConfig = req.body?.apiConfig || undefined;
        const result = await llm.testConnection(overrideConfig);
        res.json(result);
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

router.get('/providers', (req, res) => {
    res.json(llm.getProviders());
});

module.exports = router;
