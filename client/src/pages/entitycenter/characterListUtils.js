/**
 * characterListUtils.js — 角色列表的分组/排序/筛选（纯函数）
 * 核心诉求：让"谁是主角、谁是配角、谁是路人"一眼可见 —— 默认按重要度排，不按创建时间。
 */

export const GROUP_ORDER = ['protagonist', 'supporting', 'npc', 'other'];

export const GROUP_META = {
    protagonist: { label: '主角', hint: '故事核心', color: '#ffd700' },
    supporting: { label: '配角', hint: '重要伙伴与对手', color: '#00c8ff' },
    npc: { label: 'NPC', hint: '功能性角色', color: '#7c8ba1' },
    other: { label: '未标注', hint: '缺少等级信息', color: '#64748b' },
};

export const SORT_OPTIONS = [
    { key: 'importance', label: '重要度（等级 + 出场）' },
    { key: 'appear_desc', label: '出场次数（多→少）' },
    { key: 'name_asc', label: '名称 A→Z' },
    { key: 'createdAt_desc', label: '创建时间（新→旧）' },
    { key: 'createdAt_asc', label: '创建时间（旧→新）' },
];

/** 归一化：统一取 _adapted 里的展示字段，避免各处 ?? 兜底 */
export function adaptChar(ch) {
    const a = ch._adapted || {};
    return {
        id: ch.id,
        name: a.name || ch.id,
        role: a.roleLevel || 'other',
        appearCount: a.appearCount || 0,
        createdAt: ch.createdAt || a.createdAt || '',
        worldScopePrimary: a.worldScopePrimary,
        worldScopeName: a.worldScopeName,
        worldScopeColor: a.worldScopeColor,
        worldScopeIsVisitor: a.worldScopeIsVisitor,
    };
}

export function groupKeyOf(role) {
    return GROUP_ORDER.includes(role) ? role : 'other';
}

function comparator(sortKey) {
    switch (sortKey) {
        case 'appear_desc': return (a, b) => b.appearCount - a.appearCount || a.name.localeCompare(b.name);
        case 'name_asc': return (a, b) => a.name.localeCompare(b.name);
        case 'createdAt_asc': return (a, b) => a.createdAt.localeCompare(b.createdAt);
        case 'createdAt_desc': return (a, b) => b.createdAt.localeCompare(a.createdAt);
        default: return (a, b) => b.appearCount - a.appearCount || a.name.localeCompare(b.name);
    }
}

/** 等级分组 + 组内排序（空组不返回） */
export function groupCharacters(list, sortKey) {
    const cmp = comparator(sortKey);
    return GROUP_ORDER
        .map(role => ({
            role,
            meta: GROUP_META[role],
            members: list.filter(c => groupKeyOf(c.role) === role).sort(cmp),
        }))
        .filter(g => g.members.length > 0);
}

export function countByRole(list) {
    const counts = { protagonist: 0, supporting: 0, npc: 0, other: 0 };
    for (const c of list) counts[groupKeyOf(c.role)] += 1;
    return counts;
}

/** 搜索 + 等级筛选 */
export function filterCharacters(list, query, roleFilter) {
    const q = (query || '').trim().toLowerCase();
    return list.filter(c => {
        if (roleFilter && roleFilter !== 'all' && groupKeyOf(c.role) !== roleFilter) return false;
        if (!q) return true;
        return c.name.toLowerCase().includes(q) || (c.role && c.role.toLowerCase().includes(q));
    });
}

