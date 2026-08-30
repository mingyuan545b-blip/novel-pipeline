const {
    STORE_SIZE_LIMITS, STORE_DEFAULT_MAX_SIZE, STORE_TRIMMING,
    PIPELINE, PIPELINE_METRICS, CONSTRAINT_DEFAULTS, CONSTRAINT_TIERS,
    METRICS_STORAGE, AGENT_DEFAULTS, LLM_DEFAULTS, PROVIDER_DEFAULTS,
    SERVER_DEFAULTS, CACHE_CONFIG, JSON_STORE, HEALTH_MONITOR_CONFIG, PIPELINE_LOG_LIMITS,
    PIPELINE_CONTRACT, WRITER_BUDGETS, CONTEXT_BUDGET_MODELS, CONTEXT_MODEL_CATEGORIES
} = require('./systemConfigDefs');

function getAgentConfig(agentType) {
    return AGENT_DEFAULTS[agentType] || { maxTokens: 8192, defaultTemperature: 0.7 };
}

function resolveModelBudget(model) {
    const ml = model ? model.toLowerCase() : '';
    if (ml.includes('qwen3.8')) return 262144;
    if (ml.includes('qwen3-30b-a3b')) return 512000;
    if (ml.includes('qwen3.6-35b-a3b') || ml.includes('qwen3.6-35b')) return 256000;
    if (ml.includes('qwen3.6-plus')) return 800000;
    if (ml.includes('qwen3.5-plus')) return 256000;
    if (ml.includes('qwen-turbo')) return 32000;
    if (ml.includes('qwen3-235b') || ml.includes('qwen3-32b')) return 128000;
    if (ml.includes('qwen-long')) return 80000;
    if (ml.includes('deepseek')) return 24000;
    if (ml.includes('gpt-4o') || ml.includes('gpt-4-turbo')) return 16000;
    if (ml.includes('moonshot-v1-128k')) return 32000;
    if (ml.includes('glm-4')) return 16000;
    return CONTEXT_BUDGET_MODELS['default'];
}

function resolveModelCategory(model) {
    const ml = model.toLowerCase();
    if (CONTEXT_MODEL_CATEGORIES.ultra_long.some(m => ml.includes(m.toLowerCase()))) return 'ultra_long';
    if (CONTEXT_MODEL_CATEGORIES.long.some(m => ml.includes(m.toLowerCase()))) return 'long';
    if (CONTEXT_MODEL_CATEGORIES.compact.some(m => ml.includes(m.toLowerCase()))) return 'compact';
    const budget = resolveModelBudget(model);
    if (budget >= 400000) return 'ultra_long';
    if (budget >= 100000) return 'long';
    if (budget <= 40000) return 'compact';
    return 'standard';
}

module.exports = {
    STORE_SIZE_LIMITS, STORE_DEFAULT_MAX_SIZE, STORE_TRIMMING,
    PIPELINE, PIPELINE_METRICS, CONSTRAINT_DEFAULTS, CONSTRAINT_TIERS,
    METRICS_STORAGE, AGENT_DEFAULTS, LLM_DEFAULTS, PROVIDER_DEFAULTS, SERVER_DEFAULTS,
    CACHE_CONFIG, JSON_STORE, HEALTH_MONITOR_CONFIG, PIPELINE_LOG_LIMITS,
    PIPELINE_CONTRACT, WRITER_BUDGETS, CONTEXT_BUDGET_MODELS, CONTEXT_MODEL_CATEGORIES,
    getAgentConfig, resolveModelBudget, resolveModelCategory
};
