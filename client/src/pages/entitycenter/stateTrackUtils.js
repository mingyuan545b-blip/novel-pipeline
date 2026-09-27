/**
 * stateTrackUtils.js — 状态追踪的排序/筛选/分组（纯函数）
 * 解决 KV 索引"平铺一长串、热字段混在冷字段里"的杂乱。
 */
import { SCOPE_ICONS, SCOPE_LABELS } from './constants';

export function entityTitle(entity) {
    return entity.fields?.name?.value || entity.fields?.名称?.value || entity.entityKey;
}

/** 热字段优先，其次按更新章节倒序 */
export function sortFields(fields) {
    return Object.entries(fields || {}).sort((a, b) =>
        ((b[1]?.isHot ? 1 : 0) - (a[1]?.isHot ? 1 : 0)) ||
        ((b[1]?.chapterUpdated || 0) - (a[1]?.chapterUpdated || 0)));
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
