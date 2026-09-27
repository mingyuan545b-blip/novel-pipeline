/**
 * summaryUtils.js — 摘要的分组/筛选（纯函数）
 * 复用 characterListUtils 的等级分组，让"谁的摘要"按主次排列，而不是按返回顺序平铺。
 */
import { GROUP_META, GROUP_ORDER, groupKeyOf } from './characterListUtils';

/** 给摘要块补上角色等级（按名称匹配角色表），并统计有效字段数 */
export function decorateBlocks(blocks, characters) {
    const roleByName = new Map();
    for (const c of characters) {
        const name = c._adapted?.name || c.name || c.id;
        roleByName.set(name, groupKeyOf(c._adapted?.roleLevel || c.roleLevel || 'other'));
    }
    return blocks.map(b => ({
        ...b,
        role: roleByName.get(b.name) || 'other',
        filled: Object.values(b.fields).filter(v => v && v !== '').length,
    }));
}

export function filterBlocks(blocks, { query, role }) {
    const q = (query || '').trim().toLowerCase();
    return blocks.filter(b => {
        if (role && role !== 'all' && b.role !== role) return false;
        if (q) {
            const hay = [b.name, ...Object.values(b.fields)].join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

export function groupBlocks(blocks) {
    return GROUP_ORDER.map(role => ({
        role, meta: GROUP_META[role],
        members: blocks.filter(b => b.role === role)
            .sort((a, b) => b.filled - a.filled || a.name.localeCompare(b.name)),
    })).filter(g => g.members.length > 0);
}

export function roleCounts(blocks) {
    const m = { protagonist: 0, supporting: 0, npc: 0, other: 0 };
    for (const b of blocks) m[b.role] = (m[b.role] || 0) + 1;
    return m;
}
