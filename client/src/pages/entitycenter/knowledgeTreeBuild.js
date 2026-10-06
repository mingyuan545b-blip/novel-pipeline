/**
 * knowledgeTreeBuild.js — 限知「树状视图」的两种筛选轴（纯函数）
 *
 * 用户诉求：限知用树状结构展示，两种筛选方式——
 *   ① 人物为中心：一级=人物，二级=人物相关的 确信/怀疑/误信/未知，叶子=该人对其知道的事实；
 *   ② 事件为中心：一级=事实/事件，二级=获知渠道（亲眼/听说/推理/发现…），叶子=谁通过该渠道知道。
 *
 * 与 knowledgeUtils 的 groupBy* 区别：那些是扁平分组，这里输出两级可折叠的树节点。
 */
import { CONFIDENCE_ORDER, confidenceMeta, categoryOf, categoryMeta } from './knowledgeUtils';
import { SOURCE_HOW_LABELS } from './constants';

export const TREE_AXES = [
    { key: 'entity', label: '按人物', hint: '人物 → 确信/怀疑 → 事实' },
    { key: 'event', label: '按事件', hint: '事件 → 获知渠道 → 知情者' },
];

/** 规范渠道排序（其余别名按原名排在其后） */
export const SOURCE_HOW_ORDER = ['witnessed', 'told', 'inferred', 'discovered'];

export function sourceHowLabel(key) {
    if (!key) return '未知渠道';
    return SOURCE_HOW_LABELS[key] || key;
}

function byChapterThenFact(a, b) {
    return (a.sinceChapter || 0) - (b.sinceChapter || 0)
        || String(a.factText || a.factId).localeCompare(String(b.factText || b.factId));
}

function channelKeysOf(records) {
    const present = new Set(records.map(r => r.sourceHow || ''));
    const known = SOURCE_HOW_ORDER.filter(k => present.has(k));
    const rest = [...present].filter(k => !SOURCE_HOW_ORDER.includes(k)).sort();
    return [...known, ...rest];
}

/** 人物视角：一级=人物 → 二级=确信度 → 叶子=认知记录 */
export function buildEntityTree(records, nameOf) {
    const byEntity = new Map();
    for (const r of records) {
        if (!byEntity.has(r.entityId)) byEntity.set(r.entityId, []);
        byEntity.get(r.entityId).push(r);
    }
    return [...byEntity.entries()]
        .map(([entityId, recs]) => ({
            key: `e:${entityId}`,
            label: (nameOf && nameOf(entityId)) || entityId,
            count: recs.length,
            children: CONFIDENCE_ORDER
                .filter(k => recs.some(r => confidenceMeta(r.confidence).key === k))
                .map(k => {
                    const meta = confidenceMeta(k);
                    const bucket = recs.filter(r => confidenceMeta(r.confidence).key === k).sort(byChapterThenFact);
                    return { key: `e:${entityId}::${k}`, label: meta.label, color: meta.color, count: bucket.length, records: bucket };
                }),
        }))
        .sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
}

/** 事件视角：一级=事实/事件 → 二级=获知渠道 → 叶子=知情者 */
export function buildEventTree(records) {
    const byFact = new Map();
    for (const r of records) {
        const k = r.factText || r.factId;
        if (!byFact.has(k)) byFact.set(k, []);
        byFact.get(k).push(r);
    }
    return [...byFact.entries()]
        .map(([factKey, recs]) => {
            const cat = categoryMeta(categoryOf(recs[0]));
            return {
                key: `f:${factKey}`,
                label: factKey,
                color: cat.color,
                categoryLabel: cat.label,
                count: recs.length,
                children: channelKeysOf(recs).map(ch => {
                    const bucket = recs.filter(r => (r.sourceHow || '') === ch).sort(byChapterThenFact);
                    return { key: `f:${factKey}::${ch}`, label: sourceHowLabel(ch), count: bucket.length, records: bucket };
                }),
            };
        })
        .sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
}

/** 轴分派：entity | event（默认 entity） */
export function buildKnowledgeTree(records, axis, nameOf) {
    return axis === 'event' ? buildEventTree(records) : buildEntityTree(records, nameOf);
}
