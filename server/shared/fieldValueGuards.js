/**
 * fieldValueGuards.js — 字段值"是否有意义"判定（单一源）
 *
 * 背景（P1-D）：merge/投影时用 `if (defaults[f])` 判定真值，导致占位词（"无 | 无"）
 * 也会覆盖已有的好数据（实测 林婉 tone="无 | 无" 覆盖了初始好值）。
 * 这里集中定义占位/空值清单，供实体合并、素材→实体投影、KV 写入共用。
 */
const PLACEHOLDER_VALUES = new Set([
    '', '无', '无 | 无', '无|无', 'n/a', 'N/A', 'na', 'NA', '-', '—', '--',
    '暂无', '未知', '待定', '待补充', 'null', 'undefined', 'N/A | N/A'
]);

/** 值是否有意义（非空、非占位、非空集合） */
function hasMeaningfulValue(value) {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return !PLACEHOLDER_VALUES.has(value.trim());
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

/** 清洗对象：仅保留"有意义"的键（可选归一化占位数组） */
function pickMeaningful(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) if (hasMeaningfulValue(v)) out[k] = v;
    return out;
}

module.exports = { PLACEHOLDER_VALUES, hasMeaningfulValue, pickMeaningful };
