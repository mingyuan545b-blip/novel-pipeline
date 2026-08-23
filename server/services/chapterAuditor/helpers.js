const { PROVIDER_DEFAULTS } = require('../../config/systemConfig');
const { DEFAULT_MODEL } = require('../../config/modelResolver');

function _getDefaultRepairConfig(project, agentModelConfig) {
    const reviserConfig = agentModelConfig?.reviser;
    if (reviserConfig) {
        const cfg = { ...reviserConfig };
        if (cfg.provider === 'aliyunCoding' && !cfg.apiKey && process.env.ALIYUN_CODING_API_KEY) {
            cfg.apiKey = process.env.ALIYUN_CODING_API_KEY;
            if (!cfg.model) cfg.model = process.env.ALIYUN_CODING_MODEL || DEFAULT_MODEL;
            if (!cfg.baseURL) cfg.baseURL = PROVIDER_DEFAULTS.ALIYUN_CODING_BASE_URL;
        }
        if (cfg.provider === 'siliconflow' && !cfg.apiKey && process.env.SILICONFLOW_API_KEY) {
            cfg.apiKey = process.env.SILICONFLOW_API_KEY;
            if (!cfg.baseURL) cfg.baseURL = PROVIDER_DEFAULTS.SILICONFLOW_BASE_URL;
        }
        if (cfg.provider === 'deepseek' && !cfg.apiKey && process.env.DEEPSEEK_API_KEY) {
            cfg.apiKey = process.env.DEEPSEEK_API_KEY;
            if (!cfg.baseURL) cfg.baseURL = PROVIDER_DEFAULTS.DEEPSEEK_BASE_URL;
        }
        return cfg;
    }
    if (process.env.ALIYUN_CODING_API_KEY) {
        return { provider: 'aliyunCoding', apiKey: process.env.ALIYUN_CODING_API_KEY, model: process.env.ALIYUN_CODING_MODEL || DEFAULT_MODEL, baseURL: PROVIDER_DEFAULTS.ALIYUN_CODING_BASE_URL };
    }
    return { provider: 'aliyunCoding', apiKey: process.env.ALIYUN_CODING_API_KEY || '', model: process.env.ALIYUN_CODING_MODEL || DEFAULT_MODEL, baseURL: PROVIDER_DEFAULTS.ALIYUN_CODING_BASE_URL };
}

function _buildApiConfig(provider, model) {
    if (provider === 'aliyunCoding') {
        return { provider: 'aliyunCoding', apiKey: process.env.ALIYUN_CODING_API_KEY || '', model: model || process.env.ALIYUN_CODING_MODEL || DEFAULT_MODEL, baseURL: PROVIDER_DEFAULTS.ALIYUN_CODING_BASE_URL };
    }
    return { provider, model: model || 'default', apiKey: process.env.LLM_API_KEY || '', baseURL: process.env.LLM_BASE_URL || '' };
}

function _generateDiff(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const diff = [];
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
        const oldLine = oldLines[i] || '';
        const newLine = newLines[i] || '';
        if (oldLine.trim() !== newLine.trim()) {
            diff.push({ line: i + 1, before: oldLine.substring(0, 200), after: newLine.substring(0, 200) });
        }
    }
    return diff.slice(0, 50);
}

async function _updateMaterial(projectId, chapterId, oldContent, newContent, store) {
    const materials = (await store.queryItems('materials')).filter(m => m.projectId === projectId && !m.archived);
    for (const mat of materials) {
        if (mat.currentContent && oldContent.includes(mat.currentContent.substring(0, 50))) {
            const oldSnippet = mat.currentContent;
            const snippetStart = newContent.indexOf(oldSnippet.substring(0, 30));
            if (snippetStart === -1) {
                const idx = newContent.indexOf(mat.currentContent.substring(0, 20));
                if (idx >= 0) {
                    const updatedSnippet = newContent.substring(idx, Math.min(idx + oldSnippet.length, newContent.length));
                    if (updatedSnippet !== oldSnippet) {
                        mat.currentContent = updatedSnippet;
                        mat.updatedAt = new Date().toISOString();
                        if (!mat.changeLog) mat.changeLog = [];
                        mat.changeLog.push({ type: 'repair-update', timestamp: new Date().toISOString(), oldContent: oldSnippet.substring(0, 200), newContent: updatedSnippet.substring(0, 200) });
                        if (mat.changeLog.length > 5) mat.changeLog = mat.changeLog.slice(-5);
                        store.setItem('materials', mat.id, mat);
                    }
                }
            }
        }
    }
}

module.exports = { _getDefaultRepairConfig, _buildApiConfig, _generateDiff, _updateMaterial };
