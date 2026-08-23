const { CONFIG_MANIFEST } = require('./configManifestDefs');
const { DEFAULT_MODEL } = require('./modelResolver');

function getConfigStatus() {
    const results = [];
    for (const item of CONFIG_MANIFEST) {
        const rawValue = process.env[item.key] || '';
        const isSet = !!rawValue;
        let displayValue = rawValue;
        if (item.sensitive && rawValue) {
            displayValue = rawValue.length > 8 ? rawValue.substring(0, 8) + '***' : '***configured***';
        }
        const level = item.required && !isSet ? 'error' : (!item.required && !isSet && item.key !== 'PORT' ? 'warning' : 'ok');
        results.push({ key: item.key, label: item.label, category: item.category, required: item.required, sensitive: item.sensitive, isSet, displayValue, level, description: item.description, recommendation: item.recommendation || '' });
    }
    return results;
}

function getLLMConfigSummary() {
    const provider = process.env.LLM_PROVIDER || 'unknown';
    const providers = [];
    if (process.env.ALIYUN_CODING_API_KEY) providers.push({ id: 'aliyun-coding', name: '阿里云百炼', model: process.env.ALIYUN_CODING_MODEL || DEFAULT_MODEL, keyPrefix: process.env.ALIYUN_CODING_API_KEY.substring(0, 8) + '...' });
    if (process.env.DEEPSEEK_API_KEY) providers.push({ id: 'deepseek', name: 'DeepSeek', model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', keyPrefix: process.env.DEEPSEEK_API_KEY.substring(0, 8) + '...' });
    if (process.env.SILICONFLOW_API_KEY) providers.push({ id: 'siliconflow', name: '硅基流动', keyPrefix: process.env.SILICONFLOW_API_KEY.substring(0, 8) + '...' });
    return { currentProvider: provider, hasAnyKey: providers.length > 0, providers, envFile: '.env (项目根目录)' };
}

function getEnvFilePath() { return require('path').join(__dirname, '..', '..', '.env'); }
function isEnvFilePresent() { return require('fs').existsSync(getEnvFilePath()); }

module.exports = { CONFIG_MANIFEST, getConfigStatus, getLLMConfigSummary, getEnvFilePath, isEnvFilePresent };
