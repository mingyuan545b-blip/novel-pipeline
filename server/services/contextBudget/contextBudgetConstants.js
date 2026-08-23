const CONTEXT_BUDGETS = {
    'gpt-4o': 16000, 'gpt-4o-mini': 12000, 'gpt-4-turbo': 16000,
    'deepseek-chat': 24000, 'deepseek-reasoner': 24000,
    'qwen-max': 16000, 'qwen-plus': 12000, 'qwen-long': 80000,
    'qwen-max-latest': 16000, 'qwen-plus-latest': 12000, 'qwen-turbo': 12000,
    'qwen3.5-plus': 256000, 'qwen3.5-max': 128000,
    'qwen3-235b-a22b': 128000, 'qwen3-32b': 128000,
    'Qwen3.5-27B': 128000, 'Qwen3.5-397B-A17B': 128000,
    'qwen3.6-plus': 800000, 'Qwen3.6-plus': 800000,
    'qwen3-30b-a3b': 512000, 'Qwen3-30B-A3B': 512000,
    'Qwen3.6-35B-A3B': 256000, 'qwen3.6-35b-a3b': 256000,
    'Qwen3.6-35B-A3B-Q8_0': 256000,
    'glm-4-plus': 16000, 'glm-4': 12000,
    'moonshot-v1-128k': 32000, 'moonshot-v1-32k': 16000,
    'default': 16000
};

const COMPACT_MODELS = ['gpt-4o-mini', 'qwen-turbo'];
const LONG_CONTEXT_MODELS = ['qwen3.6-plus', 'Qwen3.6-plus', 'qwen3.5-plus', 'qwen-long', 'moonshot-v1-128k'];
const ULTRA_LONG_CONTEXT_MODELS = ['qwen3-30b-a3b', 'Qwen3-30B-A3B', 'qwen3.6-plus', 'Qwen3.6-plus', 'Qwen3.6-35B-A3B', 'qwen3.6-35b-a3b', 'Qwen3.6-35B-A3B-Q8_0'];

const COMPACT_PRIORITIES = {
    agent_prompt: { priority: 100, maxRatio: 0.08, label: 'Agent提示词' },
    worldview_materials: { priority: 99, maxRatio: 0.10, label: '世界观素材' },
    character_materials: { priority: 99, maxRatio: 0.10, label: '角色素材' },
    style_guidance: { priority: 98, maxRatio: 0.04, label: '风格指导(写作手法)' },
    constraint_rules: { priority: 95, maxRatio: 0.03, label: '架构约束(精简)' },
    memory_context: { priority: 90, maxRatio: 0.12, label: '分层记忆(精简)' },
    other_materials: { priority: 80, maxRatio: 0.06, label: '其他素材' },
    style_template: { priority: 78, maxRatio: 0.03, label: '风格模板' },
    foreshadowing: { priority: 75, maxRatio: 0.04, label: '伏笔追踪' },
    character_states: { priority: 72, maxRatio: 0.05, label: '角色状态' },
    chapter_outline: { priority: 70, maxRatio: 0.08, label: '章节大纲' },
    previous_chapter: { priority: 60, maxRatio: 0.15, label: '前序章节' },
    review_feedback: { priority: 50, maxRatio: 0.08, label: '审核反馈' },
    chapter_content: { priority: 40, maxRatio: 0.30, label: '章节正文' }
};

const LONG_PRIORITIES = {
    ...COMPACT_PRIORITIES,
    worldview_materials: { priority: 99, maxRatio: 0.15, label: '世界观素材' },
    character_materials: { priority: 99, maxRatio: 0.15, label: '角色素材' },
    style_guidance: { priority: 98, maxRatio: 0.06, label: '风格指导' },
    constraint_rules: { priority: 95, maxRatio: 0.04, label: '架构约束' },
    memory_context: { priority: 90, maxRatio: 0.15, label: '分层记忆' },
    other_materials: { priority: 80, maxRatio: 0.08, label: '其他素材' },
    previous_chapter: { priority: 60, maxRatio: 0.20, label: '前序章节' },
    chapter_content: { priority: 40, maxRatio: 0.40, label: '章节正文' }
};

const ULTRA_LONG_PRIORITIES = {
    ...LONG_PRIORITIES,
    worldview_materials: { priority: 99, maxRatio: 0.20, label: '世界观素材(完整)' },
    character_materials: { priority: 99, maxRatio: 0.20, label: '角色素材(完整)' },
    style_guidance: { priority: 98, maxRatio: 0.08, label: '风格指导(完整)' },
    constraint_rules: { priority: 95, maxRatio: 0.05, label: '架构约束(完整)' },
    memory_context: { priority: 90, maxRatio: 0.20, label: '分层记忆(完整)' },
    other_materials: { priority: 80, maxRatio: 0.10, label: '其他素材(完整)' },
    previous_chapter: { priority: 60, maxRatio: 0.30, label: '前序章节(多章)' },
    chapter_content: { priority: 40, maxRatio: 0.50, label: '章节正文(多章)' }
};

const MODEL_RATIOS = {
    qwen: { chinese: 1.2, latin: 0.25, number: 0.3, punctuation: 0.4, whitespace: 0.2 },
    deepseek: { chinese: 1.3, latin: 0.25, number: 0.3, punctuation: 0.45, whitespace: 0.2 },
    gpt: { chinese: 1.5, latin: 0.25, number: 0.35, punctuation: 0.5, whitespace: 0.2 },
    glm: { chinese: 1.3, latin: 0.25, number: 0.3, punctuation: 0.45, whitespace: 0.2 },
    moonshot: { chinese: 1.3, latin: 0.25, number: 0.3, punctuation: 0.45, whitespace: 0.2 }
};

const SAFETY_MARGIN = 1.15;
const DEFAULT_RATIOS = { chinese: 1.5, latin: 0.25, number: 0.35, punctuation: 0.5, whitespace: 0.2 };

function _getModelFamily(model) {
    if (!model) return null;
    const ml = model.toLowerCase();
    if (ml.includes('qwen')) return 'qwen';
    if (ml.includes('deepseek')) return 'deepseek';
    if (ml.includes('gpt')) return 'gpt';
    if (ml.includes('glm')) return 'glm';
    if (ml.includes('moonshot')) return 'moonshot';
    return null;
}

function estimateTokens(text, model) {
    if (!text) return 0;
    if (typeof text !== 'string') text = JSON.stringify(text);
    const ratios = (model ? (MODEL_RATIOS[_getModelFamily(model)] || DEFAULT_RATIOS) : DEFAULT_RATIOS);
    const chars = [...text];
    let chinese = 0, latin = 0, numbers = 0, punctuation = 0, whitespace = 0, other = 0;
    for (const c of chars) {
        const code = c.charCodeAt(0);
        if (code >= 0x4e00 && code <= 0x9fff) { chinese++; }
        else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) { latin++; }
        else if (code >= 0x30 && code <= 0x39) { numbers++; }
        else if (/\s/.test(c)) { whitespace++; }
        else if (/[^\w\s]/.test(c) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef) || (code >= 0x2000 && code <= 0x206f)) { punctuation++; }
        else { other++; }
    }
    const raw = chinese * ratios.chinese + latin * ratios.latin + numbers * ratios.number + punctuation * ratios.punctuation + whitespace * ratios.whitespace + other * 0.3;
    return Math.ceil(raw * SAFETY_MARGIN);
}

function truncateToTokens(text, maxTokens, model) {
    if (!text) return '';
    const est = estimateTokens(text, model);
    if (est <= maxTokens) return text;
    const ratio = maxTokens / est;
    const targetLen = Math.floor(text.length * ratio * 0.9);
    return text.substring(0, targetLen) + '...(已截断)';
}

function resolveModelBudget(model) {
    if (CONTEXT_BUDGETS[model]) return CONTEXT_BUDGETS[model];
    const ml = model.toLowerCase();
    if (ml.includes('qwen3.6-35b-a3b') || ml.includes('qwen3.6-35b') || ml.includes('qwen3-30b-a3b')) return 256000;
    if (ml.includes('qwen3.6-plus') || ml.includes('qwen3.6-plus')) return 800000;
    if (ml.includes('qwen3.5-plus')) return 256000;
    if (ml.includes('qwen3-235b') || ml.includes('qwen3-32b')) return 128000;
    if (ml.includes('qwen-long')) return 80000;
    if (ml.includes('deepseek')) return 24000;
    if (ml.includes('gpt-4o') || ml.includes('gpt-4-turbo')) return 16000;
    if (ml.includes('moonshot-v1-128k')) return 32000;
    if (ml.includes('glm-4')) return 16000;
    return CONTEXT_BUDGETS.default;
}

function resolveModelCategory(model) {
    const ml = model.toLowerCase();
    if (ml.includes('qwen3.6-35b-a3b') || ml.includes('qwen3-30b-a3b') || ml.includes('qwen3.6-plus')) return 'ultra_long';
    if (ml.includes('qwen3.5-plus') || ml.includes('qwen-long') || ml.includes('moonshot-v1-128k')) return 'long';
    if (ml.includes('gpt-4o-mini') || ml.includes('qwen-turbo')) return 'compact';
    return null;
}

module.exports = {
    CONTEXT_BUDGETS, COMPACT_MODELS, LONG_CONTEXT_MODELS, ULTRA_LONG_CONTEXT_MODELS,
    COMPACT_PRIORITIES, LONG_PRIORITIES, ULTRA_LONG_PRIORITIES,
    MODEL_RATIOS, SAFETY_MARGIN, DEFAULT_RATIOS,
    estimateTokens, truncateToTokens, resolveModelBudget, resolveModelCategory
};
