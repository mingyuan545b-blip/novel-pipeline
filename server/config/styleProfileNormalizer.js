/**
 * styleProfile归一化器 - 数据入口拦截层
 *
 * 职责：将任意字段名变体的styleProfile转为标准Schema，补齐缺失的约束字段
 * 调用时机：
 *   1. createProjectData写入前归一化
 *   2. outlineMaterialSaver生成styleProfile后归一化
 *   3. store.getItem读取后归一化（确保历史数据兼容）
 */

const {
    STYLE_PROFILE_FIELDS,
    REQUIRED_FIELDS,
    CONSTRAINT_FIELDS,
    FIELD_DEFAULTS,
    FIELD_ALIASES
} = require('./styleProfileSchema');

/**
 * 将任意字段名变体的styleProfile归一化为标准Schema
 * @param {Object|null|undefined} rawProfile - 原始styleProfile
 * @returns {Object|null} 归一化后的标准styleProfile，输入为null/undefined时返回null
 */
function normalizeStyleProfile(rawProfile) {
    if (!rawProfile || typeof rawProfile !== 'object') return null;

    const normalized = {};

    // 遍历原始字段，通过别名映射转为标准字段名
    for (const [rawField, rawValue] of Object.entries(rawProfile)) {
        const standardField = FIELD_ALIASES[rawField];
        if (!standardField) {
            // 未知字段：跳过（容错处理）
            continue;
        }
        // 同一字段多次出现时，取第一个有效值（不覆盖）
        if (normalized[standardField] === undefined) {
            normalized[standardField] = rawValue;
        }
    }

    // 必填字段和约束字段缺失时，用默认值补齐
    const allFields = [...REQUIRED_FIELDS, ...CONSTRAINT_FIELDS];
    for (const field of allFields) {
        if (normalized[field] === undefined) {
            normalized[field] = FIELD_DEFAULTS[field];
        }
    }

    // 补齐其他可选字段的默认值
    for (const field of Object.values(STYLE_PROFILE_FIELDS)) {
        if (normalized[field] === undefined) {
            normalized[field] = FIELD_DEFAULTS[field];
        }
    }

    return normalized;
}

/**
 * 校验styleProfile是否符合标准Schema（用于CI约束和测试）
 * @param {Object} profile - 待校验的styleProfile
 * @returns {{valid: boolean, issues: string[]}}
 */
function validateStyleProfile(profile) {
    const issues = [];

    if (!profile || typeof profile !== 'object') {
        return { valid: false, issues: ['styleProfile为空或非对象'] };
    }

    // 检查必填字段
    for (const field of REQUIRED_FIELDS) {
        if (profile[field] === undefined) {
            issues.push(`缺少必填字段: ${field}`);
        }
    }

    // 检查约束字段（缺失会导致约束注入失败）
    for (const field of CONSTRAINT_FIELDS) {
        if (profile[field] === undefined) {
            issues.push(`缺少约束字段: ${field}（影响写作质量）`);
        }
    }

    // 检查是否存在非标准字段（已知别名以外的字段）
    const knownAliases = new Set(Object.keys(FIELD_ALIASES));
    for (const field of Object.keys(profile)) {
        if (!knownAliases.has(field)) {
            issues.push(`存在非标准字段: ${field}（应迁移为标准字段名）`);
        }
    }

    return { valid: issues.length === 0, issues };
}

module.exports = { normalizeStyleProfile, validateStyleProfile };
