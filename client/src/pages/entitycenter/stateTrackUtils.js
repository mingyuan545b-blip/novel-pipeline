/**
 * stateTrackUtils.js — 状态追踪的排序/筛选/分组（纯函数）
 * 解决 KV 索引"平铺一长串、热字段混在冷字段里"的杂乱。
 */
import { SCOPE_ICONS, SCOPE_LABELS } from './constants';

export function entityTitle(entity) {
    return entity.fields?.name?.value || entity.fields?.名称?.value || entity.entityKey;
}

/** 热字段优先，其次按更新章节倒序（对 entries 排序） */
export function sortEntries(entries) {
    return [...entries].sort((a, b) =>
        ((b[1]?.isHot ? 1 : 0) - (a[1]?.isHot ? 1 : 0)) ||
        ((b[1]?.chapterUpdated || 0) - (a[1]?.chapterUpdated || 0)));
}

export function sortFields(fields) {
    return sortEntries(Object.entries(fields || {}));
}

export function scopeCounts(kvData) {
    const m = {};
    for (const e of (kvData || [])) { const k = e.scope || 'other'; m[k] = (m[k] || 0) + 1; }
    return m;
}

export function filterKv(kvData, { scope, query }) {
    const q = (query || '').trim().toLowerCase();
    return (kvData || []).filter(e => {
        if (scope && scope !== 'all' && (e.scope || 'other') !== scope) return false;
        if (q) {
            const hay = [entityTitle(e), e.entityKey, ...Object.keys(e.fields || {})].join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

/** 按作用域分组（角色/世界观/章节/其他） */
export function groupKv(list) {
    const order = Object.keys(SCOPE_LABELS);
    const by = new Map();
    for (const e of list) { const k = e.scope || 'other'; if (!by.has(k)) by.set(k, []); by.get(k).push(e); }
    return [...by.entries()]
        .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
        .map(([scope, items]) => ({
            scope, meta: { label: SCOPE_LABELS[scope] || scope, icon: SCOPE_ICONS[scope] || '📋' }, items,
        }));
}

// ——— 垃圾/空值字段过滤 ———
// 来源（实测）：server/config/genreStateFields.js 的通用修仙/游戏字段模板（hp/mp/combatPower/
// cultivationStage/spiritualRoot/magicalTreasures…）带默认值，与本作题材不匹配却写进了 KV；
// 另有 from/to/name 这类"关系记录形状"的字段被误写入角色状态。
const NOISE_KEYS = new Set(['from', 'to', '_lastStateId', 'entityKey', 'projectId', 'id']);

/** 值是否"无意义"（空串/0/无/null/[]/{}/[object Object]） */
export function isNoiseValue(v) {
    if (v === null || v === undefined) return true;
    if (typeof v === 'number') return v === 0;
    if (typeof v === 'string') return v.trim() === '' || v === '无' || v === '[object Object]' || v === 'undefined' || v === 'null';
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v).length === 0;
    return false;
}

export function isNoiseField(key, field) {
    if (NOISE_KEYS.has(key)) return true;
    return isNoiseValue(field && field.value);
}

/** 过滤后的字段（默认隐藏无关/空值）；返回 [entries, hiddenCount] */
export function visibleFields(fields, showAll) {
    const all = Object.entries(fields || {});
    if (showAll) return [all, 0];
    const kept = all.filter(([k, f]) => !isNoiseField(k, f));
    return [kept, all.length - kept.length];
}
