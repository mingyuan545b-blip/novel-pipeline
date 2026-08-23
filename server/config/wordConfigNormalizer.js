/**
 * wordConfig归一化器 - 数据入口拦截层
 *
 * 职责：将任意字段名变体的wordConfig转为标准Schema
 * 调用时机：
 *   1. createProjectData写入前归一化
 *   2. store.getItem读取后归一化（确保历史数据兼容）
 *   3. genreProfileRegistry.buildFullConfig输出归一化
 *
 * 原则：先统一再差异——所有wordConfig必须经过此函数才能进入业务逻辑
 */

const {
    WORD_CONFIG_FIELDS,
    WORD_CONFIG_SCHEMA,
    FIELD_ALIASES,
    REQUIRED_FIELDS
} = require('./wordConfigSchema');

/**
 * 将任意字段名变体的wordConfig归一化为标准Schema
 * @param {Object|null|undefined} rawConfig - 原始wordConfig（任意变体）
 * @returns {Object|null} 归一化后的标准wordConfig，输入为null/undefined时返回null
 */
function normalizeWordConfig(rawConfig) {
    // 输入为空：返回null，由调用方决定是否使用默认值
    if (!rawConfig || typeof rawConfig !== 'object') return null;

    const normalized = {};

    // 遍历原始字段，通过别名映射转为标准字段名
    for (const [rawField, rawValue] of Object.entries(rawConfig)) {
        const standardField = FIELD_ALIASES[rawField];
        if (!standardField) {
            // 未知字段：跳过（不报错，容错处理）
            continue;
        }
        // 数值校验：非数字值跳过
        const numValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (!Number.isFinite(numValue) || numValue < 0) continue;

        // 同一字段多次出现时，取第一个有效值（不覆盖）
        if (normalized[standardField] === undefined) {
            normalized[standardField] = numValue;
        }
    }

    // 必填字段缺失时，用标准Schema默认值补齐
    for (const field of REQUIRED_FIELDS) {
        if (normalized[field] === undefined) {
            normalized[field] = WORD_CONFIG_SCHEMA[field];
        }
    }

    // rejectMin缺失时，默认等于minWords（保持向后兼容）
    if (normalized[WORD_CONFIG_FIELDS.REJECT_MIN] === undefined) {
        normalized[WORD_CONFIG_FIELDS.REJECT_MIN] = normalized[WORD_CONFIG_FIELDS.MIN_WORDS];
    }

    return normalized;
}

/**
 * 校验wordConfig是否符合标准Schema（用于CI约束和测试）
 * @param {Object} config - 待校验的wordConfig
 * @returns {{valid: boolean, issues: string[]}}
 */
function validateWordConfig(config) {
    const issues = [];

    if (!config || typeof config !== 'object') {
        return { valid: false, issues: ['wordConfig为空或非对象'] };
    }

    // 检查必填字段
    for (const field of REQUIRED_FIELDS) {
        if (config[field] === undefined) {
            issues.push(`缺少必填字段: ${field}`);
        } else if (typeof config[field] !== 'number') {
            issues.push(`字段${field}类型错误: 期望number，实际${typeof config[field]}`);
        }
    }

    // 检查是否存在非标准字段（已知别名以外的字段）
    const standardFields = new Set(Object.values(WORD_CONFIG_FIELDS));
    const knownAliases = new Set(Object.keys(FIELD_ALIASES));
    for (const field of Object.keys(config)) {
        if (!standardFields.has(field) && !knownAliases.has(field)) {
            issues.push(`存在非标准字段: ${field}（应迁移为标准字段名）`);
        }
    }

    // 业务逻辑校验：minWords <= targetWords <= maxWords
    const { minWords, targetWords, maxWords } = config;
    if (typeof minWords === 'number' && typeof targetWords === 'number' && minWords > targetWords) {
        issues.push(`minWords(${minWords}) > targetWords(${targetWords})`);
    }
    if (typeof targetWords === 'number' && typeof maxWords === 'number' && targetWords > maxWords) {
        issues.push(`targetWords(${targetWords}) > maxWords(${maxWords})`);
    }

    return { valid: issues.length === 0, issues };
}

module.exports = { normalizeWordConfig, validateWordConfig };
