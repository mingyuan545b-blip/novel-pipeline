/**
 * summaryGroups.js — 摘要字段分类（纯函数）
 *
 * 用户诉求：摘要不是「所有数据堆一起」。稳定设定（身份/阵营/性格）才是摘要主体；
 * 「生命值 90%」这类是易变运行态，来自状态追踪，应单列并标注来源，不能混进设定摘要。
 * 卡片默认只读概要，详细字段按需载入（引用地址）。
 */

export const SUMMARY_GROUPS = [
    { key: 'core', label: '核心设定', color: '#00d4ff', hint: '稳定设定 · 摘要主体' },
    { key: 'relations', label: '关系与所有物', color: '#c084fc', hint: '人际 / 下属 / 装备' },
    { key: 'runtime', label: '运行时状态', color: '#ff9f43', hint: '易变 · 来自状态追踪，非设定摘要' },
    { key: 'other', label: '其它字段', color: '#94a3b8', hint: '' },
];
const GROUP_BY_KEY = Object.fromEntries(SUMMARY_GROUPS.map(g => [g.key, g]));

const CORE_KEYS = ['身份', '职位', '阵营', '性格', '语气', '说话', '标志', '风格', '等级', '口癖', '口头禅'];
const RUNTIME_KEYS = ['生命', '战力', '位置', '变更', '矛盾', '状态', '镜像', '立场', '弧光'];
const REL_KEYS = ['关系', '下属', '装备', '持有', '人际'];

function hasAny(label, keys) { return keys.some(k => label.includes(k)); }

export function groupKeyOfField(label) {
    if (hasAny(label, RUNTIME_KEYS)) return 'runtime';
    if (hasAny(label, REL_KEYS)) return 'relations';
    if (hasAny(label, CORE_KEYS)) return 'core';
    return 'other';
}

const fmt = v => (Array.isArray(v) ? v.join('、') : (v && typeof v === 'object') ? JSON.stringify(v) : String(v));

export function classifyFields(fields) {
    const buckets = { core: [], relations: [], runtime: [], other: [] };
    for (const [label, value] of Object.entries(fields || {})) {
        if (value === '' || value === null || value === undefined) continue;
        buckets[groupKeyOfField(label)].push([label, fmt(value)]);
    }
    return SUMMARY_GROUPS.map(g => ({ ...g, items: buckets[g.key] })).filter(g => g.items.length > 0);
}

/** 概要：只取非运行态的少量代表字段，避免把易变状态当成摘要门面 */
export function previewFields(fields, limit = 3) {
    const out = [];
    for (const [label, value] of Object.entries(fields || {})) {
        if (value === '' || value === null || value === undefined) continue;
        if (groupKeyOfField(label) === 'runtime') continue;
        out.push([label, fmt(value)]);
        if (out.length >= limit) break;
    }
    return out;
}

export function countRuntime(fields) {
    return Object.keys(fields || {}).filter(k => groupKeyOfField(k) === 'runtime'
        && fields[k] !== '' && fields[k] !== null && fields[k] !== undefined).length;
}

export function fieldCount(fields) {
    return Object.values(fields || {}).filter(v => v !== '' && v !== null && v !== undefined).length;
}

export { GROUP_BY_KEY };
