/**
 * fieldValidator.js — 素材写入前必填字段校验
 * 从字段注册表(nullable: false)自动提取必填字段，写入前校验
 */
const { REGISTRY } = require('./fieldRegistryData');

/** 缓存每个表的必填字段列表 */
const REQUIRED_CACHE = {};

function getRequiredFields(tableName) {
    if (REQUIRED_CACHE[tableName]) return REQUIRED_CACHE[tableName];
    const tableDef = REGISTRY[tableName];
    if (!tableDef) return [];
    const required = Object.entries(tableDef.columns)
        .filter(([, def]) => def.nullable === false && !def.noExtract && !def.pk)
        .map(([name, def]) => ({ name, default: def.extractorDefault }));
    REQUIRED_CACHE[tableName] = required;
    return required;
}

/**
 * 校验素材数据是否满足必填字段要求
 * @param {string} tableName - 注册表表名
 * @param {object} data - 待写入数据
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateRequired(tableName, data) {
    const required = getRequiredFields(tableName);
    const missing = [];
    for (const field of required) {
        const val = data[field.name];
        if (val === undefined || val === null || val === '') {
            if (field.default === undefined || field.default === null || field.default === '') {
                missing.push(field.name);
            }
        }
    }
    return { valid: missing.length === 0, missing };
}

/**
 * 校验materials表写入前的必填字段
 * 便捷方法，直接校验最常见的素材写入场景
 */
function validateMaterial(data) {
    return validateRequired('materials', data);
}

/**
 * 自动补全缺失的必填字段（使用extractorDefault）
 * 返回补全后的数据（不修改原对象）
 */
function fillDefaults(tableName, data) {
    const required = getRequiredFields(tableName);
    const result = { ...data };
    for (const field of required) {
        if (result[field.name] === undefined || result[field.name] === null || result[field.name] === '') {
            if (field.default !== undefined && field.default !== null && field.default !== '') {
                result[field.name] = field.default;
            }
        }
    }
    return result;
}

module.exports = { validateRequired, validateMaterial, fillDefaults, getRequiredFields };
