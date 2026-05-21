const STORE_SIZE_LIMITS = {
    chapters: 200 * 1024,
    materials: 50 * 1024,
    reviews: 30 * 1024,
    projects: 500 * 1024,
    'pipeline-logs': 100 * 1024,
    'infinite-pipeline-state': 50 * 1024,
    'circuit-breakers': 10 * 1024
};
const STORE_DEFAULT_MAX_SIZE = 200 * 1024;

const STORE_TRIMMING = {
    chapterHistoryKeep: 3,
    outputTruncateLength: 3000,
    readerOutputTruncate: 3000,
    adjusterOutputTruncate: 2000,
    materialChangeLogKeep: 5,
    projectChaptersKeep: 100,
    projectChapterIntentsKeep: 50,
    projectDescriptionMaxLength: 2000
};

const PIPELINE = {
    CIRCUIT_BREAKER_THRESHOLD: 3,
    CIRCUIT_BREAKER_COOLDOWN_CHAPTERS: 2,
    CIRCUIT_BREAKER_TEMPERATURE_BOOST: 0.15,
    MAX_CHAPTER_RETRIES: 5,
    WRITE_LOCK_TIMEOUT_MS: 10000,
    WRITE_LOCK_SPIN_MS: 50
};

const MODE_CONFIGS = {
    novel: {
        MAX_CHAPTER_WORDS: 3500,
        TARGET_MIN_WORDS: 2200,
        TARGET_MAX_WORDS: 2800,
        REJECT_MIN_WORDS: 1800
    },
    shuangwen: {
        MAX_CHAPTER_WORDS: 2800,
        TARGET_MIN_WORDS: 1800,
        TARGET_MAX_WORDS: 2500,
        REJECT_MIN_WORDS: 1200
    },
    'tomato-short': {
        MAX_CHAPTER_WORDS: 2150,
        TARGET_MIN_WORDS: 1900,
        TARGET_MAX_WORDS: 2100,
        REJECT_MIN_WORDS: 1850,
        DIALOGUE_RATIO_MAX: 0.28,
        TOTAL_CHAPTERS: 28,
        READER_TRIGGERS: [7, 14],
        ADJUSTER_MAX_WRITER_RULES: 2,
        ADJUSTER_MAX_REVIEW_RULES: 1,
        ADJUSTER_MAX_MATERIAL_UPDATES: 1
    }
};

const MODE_PIPELINE_CONFIGS = {
    novel: { MIN_WORD_COUNT: 2200, MAX_ROUNDS: 7 },
    shuangwen: { MIN_WORD_COUNT: 1200, MAX_ROUNDS: 3 },
    'tomato-short': { MIN_WORD_COUNT: 1850, MAX_ROUNDS: 3 }
};

const PIPELINE_METRICS = {
    MAX_ACTIVE_MATERIALS: 80,
    MATERIAL_ARCHIVE_THRESHOLD: 0.7,
    ALERT_CONSECUTIVE_CHAPTERS: 5,
    ALERT_FAIL_RATE_THRESHOLD: 0.8,
    MAX_VERSION_TAGS_PER_CHAPTER: 20,
    BRANCHING_TEMPERATURE_BOOST: 0.15,
    BRANCHING_MAX_TEMPERATURE: 1.2,
    TELL_VERB_THRESHOLD: 3,
    INFO_DRIP_SCORE_THRESHOLD: 0.4
};

const METRICS_STORAGE = {
    FAIL_CHAPTERS_CAP: 20,
    REVISER_LOOPS_MAX: 100,
    REVISER_LOOPS_TRIM: 50,
    HOOK_LOG_MAX: 200,
    HOOK_LOG_TRIM: 100,
    MATERIAL_LOG_MAX: 200,
    MATERIAL_LOG_TRIM: 100,
    BRANCHING_LOG_MAX: 50,
    BRANCHING_LOG_TRIM: 25,
    CHAPTER_DURATIONS_MAX: 100,
    CHAPTER_DURATIONS_TRIM: 50,
    RECENT_CHAPTERS_REPORT: 10
};

const AGENT_DEFAULTS = {
    writer: { maxTokens: 32768, defaultTemperature: 0.7, timeoutMs: 900000 },
    'first-review': { maxTokens: 8192, defaultTemperature: 0.3, timeoutMs: 300000 },
    'second-review': { maxTokens: 8192, defaultTemperature: 0.3, timeoutMs: 300000 },
    'final-editor': { maxTokens: 32768, defaultTemperature: 0.5, timeoutMs: 900000 },
    'material-manager': { maxTokens: 8192, defaultTemperature: 0.3, timeoutMs: 300000 },
    'fast-review': { maxTokens: 8192, defaultTemperature: 0.3, timeoutMs: 300000 },
    reviser: { maxTokens: 32768, defaultTemperature: 0.7, timeoutMs: 900000 },
    'intent-planner': { maxTokens: 8192, defaultTemperature: 0.5, timeoutMs: 300000 },
    reader: { maxTokens: 8192, defaultTemperature: 0.3, timeoutMs: 300000 },
    adjuster: { maxTokens: 8192, defaultTemperature: 0.5, timeoutMs: 300000 },
    polisher: { maxTokens: 32768, defaultTemperature: 0.5, timeoutMs: 900000 }
};

const LLM_DEFAULTS = {
    maxRetries: 5,
    retryDelayMs: 20000,
    timeoutMs: 600000,
    defaultTemperature: 0.7,
    defaultMaxTokens: 8192
};

const WRITER_BUDGETS = {
    MATERIAL_BUDGET: 8000,
    CHAR_DETAIL_BUDGET: 4000,
    CORE_SETTING_MAX_LEN: 800,
    SUBPLANE_CONTENT_MAX: 500,
    FACTION_CONTENT_MAX: 200,
    CHAR_CONTENT_MAX: 200,
    MECH_CONTENT_MAX: 200,
    EQUIP_CONTENT_MAX: 300,
    LOCATION_CONTENT_MAX: 300,
    CATCHPHRASE_MAX: 200,
    FAMOUS_SCENE_MAX: 150,
    FORESHADOW_MAX: 200,
    OUTLINE_MAX_LEN: 2000,
    REVIEW_FEEDBACK_MAX: 2000,
    CURRENT_CONTENT_MAX: 5000,
    CATCHPHRASE_SLICE: 5,
    FAMOUS_SCENE_SLICE: 3
};

const CONTEXT_BUDGET_MODELS = {
    'MiniMax-M2.7': 32000, 'MiniMax-Text-01': 32000,
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

const CONTEXT_MODEL_CATEGORIES = {
    compact: ['MiniMax-M2.7', 'MiniMax-Text-01', 'gpt-4o-mini', 'qwen-turbo'],
    long: ['qwen3.5-plus', 'qwen-long', 'moonshot-v1-128k'],
    ultra_long: ['qwen3-30b-a3b', 'Qwen3-30B-A3B', 'qwen3.6-plus', 'Qwen3.6-plus', 'Qwen3.6-35B-A3B', 'qwen3.6-35b-a3b', 'Qwen3.6-35B-A3B-Q8_0']
};

function getModeConfig(mode) {
    return MODE_CONFIGS[mode] || MODE_CONFIGS.novel;
}

function getModePipelineConfig(mode) {
    return MODE_PIPELINE_CONFIGS[mode] || MODE_PIPELINE_CONFIGS.novel;
}

function getAgentConfig(agentType) {
    return AGENT_DEFAULTS[agentType] || { maxTokens: 8192, defaultTemperature: 0.7 };
}

function resolveModelBudget(model) {
    if (CONTEXT_BUDGET_MODELS[model]) return CONTEXT_BUDGET_MODELS[model];
    const ml = model.toLowerCase();
    if (ml.includes('qwen3.6-35b-a3b') || ml.includes('qwen3.6-35b') || ml.includes('qwen3-30b-a3b')) return 256000;
    if (ml.includes('qwen3.6-plus')) return 800000;
    if (ml.includes('qwen3.5-plus')) return 256000;
    if (ml.includes('qwen3-235b') || ml.includes('qwen3-32b')) return 128000;
    if (ml.includes('qwen-long')) return 80000;
    if (ml.includes('minimax-m2.7') || ml.includes('minimax-text')) return 32000;
    if (ml.includes('deepseek')) return 24000;
    if (ml.includes('gpt-4o') || ml.includes('gpt-4-turbo')) return 16000;
    if (ml.includes('moonshot-v1-128k')) return 32000;
    if (ml.includes('glm-4')) return 16000;
    return CONTEXT_BUDGET_MODELS.default;
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
    STORE_SIZE_LIMITS,
    STORE_DEFAULT_MAX_SIZE,
    STORE_TRIMMING,
    PIPELINE,
    MODE_CONFIGS,
    MODE_PIPELINE_CONFIGS,
    PIPELINE_METRICS,
    METRICS_STORAGE,
    AGENT_DEFAULTS,
    LLM_DEFAULTS,
    WRITER_BUDGETS,
    CONTEXT_BUDGET_MODELS,
    CONTEXT_MODEL_CATEGORIES,
    getModeConfig,
    getModePipelineConfig,
    getAgentConfig,
    resolveModelBudget,
    resolveModelCategory
};
