/**
 * relationGraphLayout.js — 关系图布局（纯函数，无第三方图库）
 * 中心人物居中，直接关系按「关系类型」聚簇、均匀分布在环上（同类型相邻），
 * 对齐参考图（梁启超人物关系图）的放射布局。节点数多时内外环交错，减少标签重叠。
 */
import { REL_TYPE_LABELS, REL_TYPE_COLORS } from './constants';

const TYPE_ORDER = ['family', 'lover', 'master', 'subordinate', 'mentor', 'ally', 'rival', 'enemy', 'other'];
export const typeColor = (t) => REL_TYPE_COLORS[t] || '#888';
export const typeLabel = (t) => REL_TYPE_LABELS[t] || t || '其他';

/** 把 centerView 的 direct 结果按主关系类型聚簇排序（大簇在前，类型按固定序） */
export function groupByType(direct) {
    const by = new Map();
    for (const d of direct) {
        const t = d.edges[0]?.rel?.relType || 'other';
        if (!by.has(t)) by.set(t, []);
        by.get(t).push(d);
    }
    return [...by.entries()]
        .sort((a, b) => (TYPE_ORDER.indexOf(a[0]) - TYPE_ORDER.indexOf(b[0])) || (b[1].length - a[1].length))
        .map(([key, items]) => ({ key, label: typeLabel(key), color: typeColor(key), items }));
}

/** 环上布局：同一类型相邻成簇；节点多时内外环交错 */
export function ringLayout(groups, { cx, cy, r }) {
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    if (total === 0) return [];
    const GAP = groups.length > 1 ? 0.16 : 0;         // 簇间留白
    const usable = Math.PI * 2 - GAP * groups.length;
    const staggered = total > 14;                      // 交错双环
    const out = [];
    let angle = -Math.PI / 2, idx = 0;
    for (const g of groups) {
        const span = usable * (g.items.length / total);
        const step = span / g.items.length;
        for (const it of g.items) {
            const a = angle + step * 0.5;
            const radius = staggered && idx % 2 === 1 ? r * 0.72 : r;
            out.push({
                ...it, group: g.key, color: g.color,
                angle: a, radius,
                x: cx + radius * Math.cos(a),
                y: cy + radius * Math.sin(a),
            });
            angle += step; idx += 1;
        }
        angle += GAP;
    }
    return out;
}

/** 从中心到节点的边（多条边时做垂直微偏移，避免完全重叠） */
export function edgeGeometry(center, node, edgeIndex, edgeCount) {
    const spread = 0.05;                               // 每多一条边偏移弧度
    const off = (edgeIndex - (edgeCount - 1) / 2) * spread;
    const a = node.angle + off;
    const r = node.radius;
    return {
        x2: center.x + r * Math.cos(a),
        y2: center.y + r * Math.sin(a),
        midX: center.x + (r * 0.55) * Math.cos(a),
        midY: center.y + (r * 0.55) * Math.sin(a),
    };
}
