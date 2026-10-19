/**
 * worldScopeUtils.js — 世界域的聚合与归一（纯函数）
 *
 * 背景（实测）：所有 world-info / entity-scope 的 worldId 恒为 'main-world'，
 * 真正区分世界的是 worldName；且同一世界跨章被反复描述（名称带括号/斜杠后缀）→ 卡片"大杂烩、0 归属"。
 * 这里按 worldName 归一去重世界、按归一分组实体，让"归属"重新有意义。
 */

export const WORLD_TYPE_LABELS = { main: '主世界', sub: '子世界', pocket: '口袋世界', dream: '梦境', virtual: '虚拟' };

const INFO_FIELDS = ['powerSystem', 'culture', 'techLevel', 'dangerLevel', 'rules', 'entryMethod', 'description'];
const PALETTE = ['#00c8ff', '#a29bfe', '#4ecdc4', '#ffd700', '#ff6b9d', '#ff9f43', '#8ab4f8', '#5eead4'];

/** 世界名归一：去掉括号/斜杠后缀（"苍生界（…）"→"苍生界"），用于合并同一世界的多次描述 */
export function baseWorldName(name) {
    const s = String(name || '').split(/[（(]/)[0].split(/[/／]/)[0].trim();
    return s || '未命名世界';
}

const infoScore = (w) => INFO_FIELDS.reduce((n, k) => n + ((Array.isArray(w[k]) ? w[k].length : w[k]) ? 1 : 0), 0);

/** 由原始条目构建世界列表：同一归一名只保留"信息最全"的一条，并补上仅被实体引用的世界 */
export function buildWorlds(items, defaultWorlds = []) {
    const best = new Map();
    for (const it of items) {
        if (it.type !== 'world-info') continue;
        const key = baseWorldName(it.worldName);
        const cur = best.get(key);
        if (!cur || infoScore(it) > infoScore(cur)) best.set(key, it);
    }
    for (const it of items) {
        const key = baseWorldName(it.worldName);
        if (!best.has(key) && (it.type === 'entity-scope' || it.entityType)) best.set(key, null);
    }
    if (best.size === 0) return defaultWorlds;
    return [...best.entries()].map(([key, info], i) => ({
        id: key, name: key, color: PALETTE[i % PALETTE.length],
        worldType: info?.worldType || 'main',
        powerSystem: info?.powerSystem || [],
        culture: info?.culture || '', techLevel: info?.techLevel || '',
        dangerLevel: info?.dangerLevel || '', rules: info?.rules || '',
        entryMethod: info?.entryMethod || '', description: info?.description || '',
        infoChapters: info?.chapterNumber ? [info.chapterNumber] : [],
    }));
}

/** 实体按归一世界名聚合；同一实体跨章重复登记合并为一条（含 first/lastChapter） */
export function buildEntityIndex(items) {
    const map = {};
    for (const it of items) {
        if (it.type !== 'entity-scope' && !it.entityType) continue;
        const key = baseWorldName(it.worldName || it.worldId);
        const list = (map[key] = map[key] || []);
        const name = it.name || it.entityName || it.id;
        const entityType = it.entityType || 'other';
        const ch = it.chapterNumber || 0;
        const hit = list.find(e => e.entityType === entityType && e.name === name);
        if (hit) {
            hit.firstChapter = Math.min(hit.firstChapter || ch, ch || hit.firstChapter || 0);
            hit.lastChapter = Math.max(hit.lastChapter || 0, ch);
            hit.isVisitor = hit.isVisitor === true || it.isVisitor === true;
            continue;
        }
        list.push({ ...it, name, entityType, firstChapter: ch, lastChapter: ch, isVisitor: it.isVisitor === true });
    }
    return map;
}

/** 世界卡片筛选/排序（搜索 + 归属数排序） */
export function shapeWorlds(worlds, entityIndex, { query, sortBy, onlyWithEntities }) {
    const q = (query || '').trim().toLowerCase();
    let list = worlds.map(w => ({ ...w, _entities: entityIndex[w.id] || [] }));
    if (onlyWithEntities) list = list.filter(w => w._entities.length > 0);
    if (q) list = list.filter(w => w.name.toLowerCase().includes(q));
    const cmp = sortBy === 'name'
        ? (a, b) => a.name.localeCompare(b.name)
        : (a, b) => b._entities.length - a._entities.length || a.name.localeCompare(b.name);
    return list.sort(cmp);
}
