/**
 * relationUtils.js — 关系的聚合与视图（纯函数）
 *
 * 数据：entity-relations 是**有向边**（from→to + relType + relLabel），同一对角色可挂多条不同类型边
 * （addRelation 按 from/to/relType 去重）→ 这里把"对"聚合出来，一条对上的多条边即"复合关系"。
 */
import { REL_TYPE_LABELS, REL_TYPE_COLORS } from './constants';

export function relMeta(type) {
    return { key: type || 'other', label: REL_TYPE_LABELS[type] || type || '其他', color: REL_TYPE_COLORS[type] || '#888' };
}

export function typeCounts(relations) {
    const m = {};
    for (const r of relations) { const t = r.relType || 'other'; m[t] = (m[t] || 0) + 1; }
    return m;
}

const otherOf = (r) => r._adapted?.toCharacterId || r.toCharacterId;
const pairKey = (a, b) => [String(a), String(b)].sort().join('~');

/** 把有向边聚合成"对"（无序）：同一对的多条边 = 复合关系 */
export function buildPairs(relations, nameOf) {
    const map = new Map();
    for (const r of relations) {
        const from = r.fromCharacterId;
        const to = otherOf(r);
        const key = pairKey(from, to);
        if (!map.has(key)) map.set(key, { key, a: { id: from, name: nameOf(from) }, b: { id: to, name: nameOf(to) }, edges: [] });
        map.get(key).edges.push(r);
    }
    return [...map.values()].map(p => ({
        ...p,
        types: [...new Set(p.edges.map(e => e.relType || 'other'))],
        strength: Math.max(...p.edges.map(e => e.strength || 50)),
        compound: p.edges.length > 1,
    })).sort((x, y) => y.edges.length - x.edges.length || x.a.name.localeCompare(y.a.name));
}

export function filterPairs(pairs, { q, type, compoundOnly }) {
    const n = (q || '').trim().toLowerCase();
    return pairs.filter(p => {
        if (compoundOnly && !p.compound) return false;
        if (type && type !== 'all' && !p.types.includes(type)) return false;
        if (n) {
            const hay = [p.a.name, p.b.name, ...p.edges.map(e => e.relLabel || ''), ...p.edges.map(e => e.notes || '')]
                .join(' ').toLowerCase();
            if (!hay.includes(n)) return false;
        }
        return true;
    });
}

/** 以某角色为中心：直接关系（按对手聚合）+ 二跳（对手的其他关系） */
export function centerView(relations, entityId, nameOf) {
    const byOther = new Map();
    for (const r of relations) {
        const from = r.fromCharacterId;
        const to = otherOf(r);
        if (from !== entityId && to !== entityId) continue;
        const otherId = from === entityId ? to : from;
        if (!byOther.has(otherId)) byOther.set(otherId, { other: { id: otherId, name: nameOf(otherId) }, edges: [] });
        byOther.get(otherId).edges.push({ rel: r, outgoing: from === entityId });
    }
    const direct = [...byOther.values()].sort((a, b) => b.edges.length - a.edges.length);
    const ids = new Set(byOther.keys());
    const second = [];
    for (const r of relations) {
        const from = r.fromCharacterId;
        const to = otherOf(r);
        if (from === entityId || to === entityId) continue;
        if (ids.has(from) || ids.has(to)) {
            second.push({ id: r.id, rel: r, fromName: nameOf(from), toName: nameOf(to) });
        }
    }
    return { direct, second };
}
