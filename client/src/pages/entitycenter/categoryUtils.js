/**
 * categoryUtils.js — 通用"分类浏览器"的纯函数（搜索 / 分面计数 / 分组排序）
 * 供 装备/功法/宠物/仆人 等 tab 共用，把"平铺卡片墙"变成"有分类、可检索、分主次"的列表。
 */

export function norm(v) { return (v == null ? '' : String(v)).toLowerCase().trim(); }

export function matchesText(text, q) {
    const n = norm(q);
    if (!n) return true;
    return norm(text).includes(n);
}

export function countByKey(items, keyOf) {
    const m = {};
    for (const it of items) { const k = keyOf(it); m[k] = (m[k] || 0) + 1; }
    return m;
}

const defaultCmp = (a, b) => norm(a.name || a.id).localeCompare(norm(b.name || b.id));

/** 按分组定义切分并排序；defs 为空则退化为单一无标题分组 */
export function groupByKey(items, keyOf, defs, cmp) {
    const sort = typeof cmp === 'function' ? cmp : defaultCmp;
    if (!defs || defs.length === 0) return [{ key: '_all', label: '', members: [...items].sort(sort) }];
    return defs
        .map(d => ({ ...d, members: items.filter(it => keyOf(it) === d.key).sort(sort) }))
        .filter(g => g.members.length > 0);
}

/** 从"势力·物品名 / 势力-物品名"里取归属前缀；无前缀归"未归类" */
export function ownerPrefix(name) {
    const s = String(name || '');
    const m = s.match(/^(.{1,12}?)\s*[·•・\-—–]/);
    return m ? m[1].replace(/^《|》$/g, '') : '未归类';
}
