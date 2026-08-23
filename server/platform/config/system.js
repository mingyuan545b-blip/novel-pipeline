const logger = require('../../shared/logger');
const fs = require('fs');
const path = require('path');
const { DEFAULT_MODEL } = require('../../config/modelResolver');
const { SERVER_DEFAULTS } = require('../../config/systemConfig');

const CONFIG_DIR = path.join(__dirname, '../../../data/config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'system.json');

const DEFAULTS = {
    pipeline: {
        maxRounds: 3,
        maxRetries: 2,
        retryDelayMs: 10000,
        cooldownMs: 3000,
        timeoutMs: 300000,
        maxConcurrentChapters: 1,
        infiniteBatchSize: 30,
        infiniteMaxSupplements: 999
    },
    storage: {
        maxProjectSize: 500 * 1024,
        maxMaterialSize: 50 * 1024,
        maxChapterSize: 200 * 1024,
        maxReviewSize: 30 * 1024,
        maxPipelineLogSize: 100 * 1024,
        lockTimeoutMs: 15000,
        lockCleanupMs: 10000
    },
    llm: {
        defaultProvider: 'aliyunCoding',
        defaultModel: DEFAULT_MODEL,
        maxTokens: 32768,
        maxContextTokens: 128000,
        temperature: 0.8,
        topP: 0.9
    },
    review: {
        minWordCount: 2200,
        shuangwenMinWordCount: 1200,
        tomatoShortMinWordCount: 1850,
        maxWordCount: 8000,
        aiWordsThreshold: 3,
        aiWords: ['仿佛', '不禁', '似乎', '殊不知', '宛如', '恍若', '犹似', '恰似']
    },
    materials: {
        maxNameLength: 100,
        maxContentLength: 50000,
        maxTags: 20,
        maxChangeLogEntries: 100
    },
    security: {
        maxRequestSize: '10mb',
        rateLimitWindowMs: 60000,
        rateLimitMax: 200,
        pipelineRateLimitMax: 10,
        corsOrigins: [`http://localhost:${SERVER_DEFAULTS.DEFAULT_FRONTEND_PORT}`],
        encryptionKey: process.env.ENCRYPTION_SECRET || ''
    },
    features: {
        enableDialects: true,
        enableSpeechStyles: true,
        enableNamingStyles: true,
        enableArchetypes: true,
        enableIntegrityCheck: true,
        enablePromptAudit: true,
        enableOptimizer: true
    }
};

let _config = null;
let _loadTime = 0;

function _ensureDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

function _load() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
            const userConfig = JSON.parse(raw);
            _config = _deepMerge({}, DEFAULTS, userConfig);
            _loadTime = Date.now();
            return _config;
        }
    } catch (e) {
        logger.warn('system', '[Config] Failed to load config file, using defaults:', e.message);
    }
    _config = { ...DEFAULTS };
    _loadTime = Date.now();
    return _config;
}

function _deepMerge(target, ...sources) {
    sources.forEach(source => {
        Object.keys(source).forEach(key => {
            const sourceVal = source[key];
            const targetVal = target[key];
            if (sourceVal && typeof sourceVal === 'object' && !Array.isArray(sourceVal) &&
                targetVal && typeof targetVal === 'object' && !Array.isArray(targetVal)) {
                target[key] = _deepMerge({}, targetVal, sourceVal);
            } else {
                target[key] = sourceVal;
            }
        });
    });
    return target;
}

const configApi = {
    get(path, defaultValue) {
        if (!_config) _load();
        if (!path) return { ..._config };
        const parts = path.split('.');
        let current = _config;
        for (const part of parts) {
            if (current == null || typeof current !== 'object') return defaultValue;
            current = current[part];
        }
        return current ?? defaultValue;
    },

    set(path, value) {
        if (!_config) _load();
        const parts = path.split('.');
        let current = _config;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
    },

    async load() {
        return _load();
    },

    async save() {
        if (!_config) _load();
        _ensureDir();
        try {
            const json = JSON.stringify(_config, null, 2);
            fs.writeFileSync(CONFIG_FILE, json, 'utf-8');
            return { success: true, path: CONFIG_FILE };
        } catch (e) {
            throw new Error(`Failed to save config: ${e.message}`);
        }
    },

    validate() {
        if (!_config) _load();
        const errors = [];
        const { pipeline, storage, review } = _config;

        if (pipeline.maxRounds < 1 || pipeline.maxRounds > 10) {
            errors.push('pipeline.maxRounds must be between 1 and 10');
        }
        if (pipeline.timeoutMs < 30000) {
            errors.push('pipeline.timeoutMs must be at least 30000');
        }
        if (storage.maxProjectSize < 100 * 1024) {
            errors.push('storage.maxProjectSize too small');
        }
        if (review.minWordCount < 1000) {
            errors.push('review.minWordCount too small');
        }
        if (review.maxWordCount < review.minWordCount) {
            errors.push('review.maxWordCount must be >= minWordCount');
        }

        return { valid: errors.length === 0, errors };
    },

    defaults() {
        return JSON.parse(JSON.stringify(DEFAULTS));
    },

    reload() {
        _config = null;
        return _load();
    },

    getLoadTime() {
        return _loadTime;
    }
};

module.exports = configApi;
