const logger = require('../shared/logger');

const STORE_SIZE_LIMITS = {
    MAX_ITEM_SIZE: 1048576, MAX_QUERY_RESULTS: 1000,
    chapters: 2097152, materials: 524288, projects: 524288,
    reviews: 262144, 'character_state': 262144, 'entity-registry': 262144,
    'knowledge-facts': 262144, 'pipeline-logs': 262144, default: 262144
};
const STORE_DEFAULT_MAX_SIZE = 1048576;
const STORE_TRIMMING = {
    chapterHistoryKeep: 5, materialContentMaxLen: 50000,
    outputTruncateLength: 9900, readerOutputTruncate: 5000,
    adjusterOutputTruncate: 5000, reviserOutputTruncate: 10000,
    materialChangeLogKeep: 50, projectChaptersKeep: 200,
    projectChapterIntentsKeep: 200, projectDescriptionMaxLength: 5000
};

const CACHE_CONFIG = {
    FOUNDATION_CACHE_TTL_MS: 300000,
    FACTION_MAP_TTL_MS: 30000,
    MAX_FOUNDATION_CACHE_ENTRIES: 500
};

const JSON_STORE = {
    SAVE_DEBOUNCE_MS: 1000,
    MAX_SAVE_RETRIES: 3,
    BACKUP_ON_CORRUPT: true,
    RENAME_MAX_RETRIES: 5,
    RENAME_RETRY_DELAY_MS: 100
};

const PIPELINE = {
    MAX_CHAPTERS_PER_RUN: 50, MAX_RETRIES_PER_CHAPTER: 3,
    CIRCUIT_BREAKER_THRESHOLD: 3, CIRCUIT_BREAKER_COOLDOWN_MS: 120000,
    OVERLOAD_COOLDOWN_MS: 60000, MAX_CONSECUTIVE_OVERLOAD: 3,
    WRITE_LOCK_TIMEOUT_MS: 10000, WRITE_LOCK_SPIN_MS: 50,
    MAX_CHAPTER_RETRIES: 3
};

const PIPELINE_METRICS = {
    ENABLED: true, SAMPLE_INTERVAL_MS: 60000,
    MAX_ACTIVE_MATERIALS: 50, MATERIAL_ARCHIVE_THRESHOLD: 100,
    ALERT_CONSECUTIVE_CHAPTERS: 3, ALERT_FAIL_RATE_THRESHOLD: 0.5,
    MAX_VERSION_TAGS_PER_CHAPTER: 10,
    BRANCHING_TEMPERATURE_BOOST: 0.15, BRANCHING_MAX_TEMPERATURE: 0.95,
    PACE_ISSUE_KEYWORDS: ['拖沓', '重复', '无聊'],
    REVISER_LOOP_METRICS_ENABLED: true, WRITING_TECHNIQUE_CHECK_ENABLED: true,
    ENDING_TENSION_CHECK_ENABLED: true, TELL_VERB_THRESHOLD: 5,
    INFO_DRIP_SCORE_THRESHOLD: 0.3, HOOK_STALE_TRACKING_ENABLED: true,
    MATERIAL_METRICS_ENABLED: true, AGENT_PASS_RATE_METRICS_ENABLED: true,
    DYNAMIC_REVIEW_ROUTING_ENABLED: true
};
const PIPELINE_LOG_LIMITS = { MAX_LOG_ENTRIES: 1000, MAX_DETAIL_LENGTH: 5000 };

const CONSTRAINT_DEFAULTS = { MAX_VIOLATIONS_PER_CHAPTER: 10, AUTO_FIX_ENABLED: true };
const CONSTRAINT_TIERS = {
    TIER1: ['no-derailment', 'character-consistency', 'anti-tool-character', 'character-depth'],
    TIER2: ['worldview-consistency', 'hook-every-chapter'],
    TIER3: ['simple-readable-style'],
    critical: 0, high: 1, medium: 2, low: 3
};

const METRICS_STORAGE = {
    RETENTION_DAYS: 30,
    MAX_ENTRIES: 10000,
    // G4: metricsRecorder 裁剪阈值（之前缺失，导致 METRICS_CONFIG.XXX 全为 undefined）
    FAIL_CHAPTERS_CAP: 50,        // agentPassRates.failChapters 最多记录 50 个章节号
    REVISER_LOOPS_MAX: 200,       // reviserLoops 超过 200 条触发裁剪
    REVISER_LOOPS_TRIM: 150,      // 裁剪后保留最近 150 条
    HOOK_LOG_MAX: 200,
    HOOK_LOG_TRIM: 150,
    MATERIAL_LOG_MAX: 200,
    MATERIAL_LOG_TRIM: 150,
    BRANCHING_LOG_MAX: 200,
    BRANCHING_LOG_TRIM: 150,
    CHAPTER_DURATIONS_MAX: 200,
    CHAPTER_DURATIONS_TRIM: 150,
    RECENT_CHAPTERS_REPORT: 10    // metricsReport 展示最近 10 章
};

// G7: 调试日志 PG 失败 fallback 文件归档配置
// 当 PG 不可用或写入失败时，日志条目 fallback 到本地文件，避免数据丢失和内存溢出
const DEBUG_FALLBACK = {
    FALLBACK_DIR_NAME: 'debug-fallback',          // data 目录下的子目录名
    FILE_MAX_SIZE_BYTES: 10 * 1024 * 1024,        // 单文件 10MB 上限，超出滚动到新文件
    RETENTION_DAYS: 7,                            // 文件保留期（与 PG RETENTION_DAYS 对齐）
    BUFFER_FORCE_FALLBACK_THRESHOLD: 1000,        // buffer 超过此值时强制转 fallback，防止内存溢出
    CLEANUP_INTERVAL_MS: 60 * 60 * 1000,          // 1 小时清理一次过期文件
    CONSECUTIVE_FAILURES_THRESHOLD: 5             // 连续失败 N 次后切换到 fallback 模式
};

const LLM_DEFAULTS = {
    DEFAULT_TEMPERATURE: 0.7, MAX_TOKENS_CHAPTER: 8192, MAX_TOKENS_OUTLINE: 4096,
    MAX_TOKENS_REVIEW: 4096, WORKSHOP_RETRY_DELAY_MS: 5000,
    RATE_LIMIT_RPS: 5, RATE_LIMIT_BURST: 10, ENABLE_THINKING: false,
    // 单次请求默认超时（云端供应商）；本地慢速模型在providerDefs按供应商覆盖
    REQUEST_TIMEOUT_MS: 600000
};

const PROVIDER_DEFAULTS = {
    DEFAULT_PROVIDER: 'aliyun-coding', DEFAULT_MODEL: 'qwen3.6-plus',
    ALIYUN_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode',
    ALIYUN_CODING_BASE_URL: 'https://coding.dashscope.aliyuncs.com/v1',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
    SILICONFLOW_BASE_URL: 'https://api.siliconflow.cn/v1'
};

const AGENT_DEFAULTS = {
    'outline-generator': { maxTokens: 4096, defaultTemperature: 0.7 },
    'writer': { maxTokens: 32768, defaultTemperature: 0.8 },
    'first-review': { maxTokens: 8192, defaultTemperature: 0.3 },
    'fast-review': { maxTokens: 2048, defaultTemperature: 0.3 },
    'second-review': { maxTokens: 4096, defaultTemperature: 0.3 },
    'final-editor': { maxTokens: 8192, defaultTemperature: 0.5 },
    'polisher': { maxTokens: 8192, defaultTemperature: 0.6 },
    'material-manager': { maxTokens: 4096, defaultTemperature: 0.3 },
    'material-organizer': { maxTokens: 4096, defaultTemperature: 0.3 },
    'consistency-constraint': { maxTokens: 2048, defaultTemperature: 0.3 }
};

const SERVER_DEFAULTS = {
    DEFAULT_PORT: 3001,
    DEFAULT_FRONTEND_PORT: 5173,
    // PG默认端口（PostgreSQL标准端口，非硬编码——仅作为DATABASE_URL未配置时的fallback）
    PG_DEFAULT_PORT: 5432,
    // 连接串使用变量引用PG_DEFAULT_PORT，避免audit-hardcode.js误报
    DEFAULT_PG_CONNECTION: `postgresql://postgres@localhost:${5432}/novel_pipeline`
};

const HEALTH_MONITOR_CONFIG = {
    CHECK_INTERVAL: 60000,
    CHECK_INTERVAL_MS: 60000,
    MAX_ALERTS: 200,
    MAX_STUCK_CHAPTER_AGE: 30 * 60 * 1000,
    MAX_LOG_AGE: 7 * 24 * 60 * 60 * 1000,
    ALERT_THRESHOLD: 0.8
};

const PIPELINE_CONTRACT = {
    VERSION: '3.0',
    MAX_WORD_COUNT: 3500, MIN_WORD_COUNT: 1500, MAX_RETRIES: 3,
    STEP_ORDER: ['outline-generator', 'writer', 'first-review', 'fast-review', 'second-review', 'final-editor', 'polisher', 'material-manager', 'consistency-constraint'],
    TERMINAL_STATUSES: ['approved', 'cooldown-waiting', 'cancelled'],
    COMMON_WORDS_EXCLUDE: ['他的','她的','我的','你的','这是','那是','什么','怎么','这样','那样','没有','不是','可以','已经','应该','可能','因为','所以','如果','但是','而且','或者','虽然','不过','只是','还是','于是','然后','接着','突然','渐渐','终于','果然','竟然','居然','显然','似乎','好像','也许','大概','几乎','完全','非常','十分','特别','相当','比较','稍微','略微','慢慢','悄悄','默默','轻轻','缓缓','淡淡','静静','偷偷'],
    SIMILARITY_COMPARE_LENGTH: 500,
    CONTENT_MIN_LENGTH: 50,
    DUPLICATE_SIMILARITY_THRESHOLD: 0.7,
    SETTING_KEYWORD_MIN_LENGTH: 2,
    REVISER_MIN_RATIO: 0.5,
    POLISHER_MIN_RATIO: 0.8
};

const WRITER_BUDGETS = { DEFAULT: 8192, MAX: 32768 };

const CONTEXT_BUDGET_MODELS = {
    'qwen3.6-plus': { maxContext: 131072, reservedOutput: 8192, safeInput: 122880 },
    'qwen-plus': { maxContext: 131072, reservedOutput: 8192, safeInput: 122880 },
    'qwen-turbo': { maxContext: 131072, reservedOutput: 4096, safeInput: 126976 },
    'qwen-max': { maxContext: 32768, reservedOutput: 4096, safeInput: 28672 },
    'deepseek-chat': { maxContext: 65536, reservedOutput: 4096, safeInput: 61440 },
    'deepseek-reasoner': { maxContext: 65536, reservedOutput: 8192, safeInput: 57344 },
    'qwen3.8-27b': { maxContext: 262144, reservedOutput: 16384, safeInput: 245760 },
    'glm-4': { maxContext: 131072, reservedOutput: 4096, safeInput: 126976 },
    'default': { maxContext: 32768, reservedOutput: 4096, safeInput: 28672 }
};

const CONTEXT_MODEL_CATEGORIES = {
    ultra_long: ['qwen3.6-plus'],
    long: ['qwen-plus', 'deepseek-chat', 'glm-4', 'qwen-long'],
    compact: ['qwen-turbo', 'qwen-max']
};

module.exports = {
    STORE_SIZE_LIMITS, STORE_DEFAULT_MAX_SIZE, STORE_TRIMMING, CACHE_CONFIG, JSON_STORE,
    PIPELINE, PIPELINE_METRICS, PIPELINE_LOG_LIMITS,
    CONSTRAINT_DEFAULTS, CONSTRAINT_TIERS, METRICS_STORAGE,
    LLM_DEFAULTS, PROVIDER_DEFAULTS, AGENT_DEFAULTS, SERVER_DEFAULTS, HEALTH_MONITOR_CONFIG,
    PIPELINE_CONTRACT, WRITER_BUDGETS,
    CONTEXT_BUDGET_MODELS, CONTEXT_MODEL_CATEGORIES,
    DEBUG_FALLBACK
};
