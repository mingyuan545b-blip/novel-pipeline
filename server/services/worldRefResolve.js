/**
 * worldRefResolve.js — 世界"名称 ↔ id"归一（纯函数）
 *
 * 背景（2026-10-05 勘定压测 #17）：
 *   worldScopeExtractor 让 LLM 直接产出世界，LLM 常把"腔市"这类副本名配上
 *   worldId=main-world（或漏 id）。结果 world-scopes 里 worldName="腔市" 但
 *   worldId="main-world" → "按世界分组归属数 / 契约归一"全部错位。
 *   这里用项目已配置的 settings.worlds（name→id 权威映射）在落库前归一。
 */

const MAIN_WORLD_ALIASES = new Set(['main-world', '主世界', '主位面', '主世界（现实）', '现实世界', '现实界', '主位面世界']);
// LLM 常返回复合串（如"现实界/主世界""main-world(主世界)"）——含这些片段即视为主世界
const MAIN_WORLD_HINT = /主世界|主位面|现实界|现实世界|main[\s-]?world/i;

/** 归一化比较键：去空白/标点，转小写 */
function _key(s) {
    return String(s || '').toLowerCase().replace(/[\s·・\-_（）()【】\[\]]/g, '');
}

/**
 * 将一个世界引用（id 或 名称）解析为项目配置里的世界 id。
 * @param {string} ref 世界 id 或名称
 * @param {Array<{id:string,name:string}>} worlds 项目世界列表
 * @returns {string} 世界 id（解析不到时：main-world 别名→main-world，否则原样非空值，最后兜底 main-world）
 */
function resolveWorldRef(ref, worlds = []) {
    const raw = String(ref || '').trim();
    if (!raw) return 'main-world';
    if (MAIN_WORLD_ALIASES.has(raw)) return 'main-world';

    const k = _key(raw);
    // 1. 精确 id
    let hit = worlds.find(w => w.id === raw);
    if (hit) return hit.id;
    // 2. 精确名称
    hit = worlds.find(w => _key(w.name) === k);
    if (hit) return hit.id;
    // 3. 名称包含（LLM 偶尔带前后缀，如"腔市·夜摊"）
    hit = worlds.find(w => { const wk = _key(w.name); return wk && (wk.includes(k) || k.includes(wk)); });
    if (hit) return hit.id;
    // 4. 复合串里含"主世界/现实界"等 → 主世界
    if (MAIN_WORLD_HINT.test(raw)) return 'main-world';
    return raw;
}

/**
 * 就地归一一个提取结果对象里所有世界引用。
 * @param {object} result worldScopeExtractor 的返回
 * @param {Array} worlds 项目世界列表
 * @returns {object} 归一后的同一对象（便于链式使用）
 */
function normalizeWorldRefs(result, worlds = []) {
    if (!result || typeof result !== 'object') return result;
    for (const e of result.entities || []) {
        if (!e) continue;
        const byName = e.worldName ? resolveWorldRef(e.worldName, worlds) : '';
        e.worldId = resolveWorldRef(e.worldId && e.worldId !== 'main-world' ? e.worldId : (byName || e.worldName || e.worldId), worlds);
    }
    for (const t of result.transitions || []) {
        if (!t) continue;
        t.from = resolveWorldRef(t.from, worlds);
        t.to = resolveWorldRef(t.to, worlds);
    }
    for (const w of result.worldInfos || []) {
        if (!w) continue;
        w.worldId = resolveWorldRef(w.worldId && w.worldId !== 'main-world' ? w.worldId : (w.worldName || w.worldId), worlds);
    }
    for (const f of result.factions || []) {
        if (!f) continue;
        f.worldId = resolveWorldRef(f.worldId, worlds);
    }
    for (const c of result.crossWorldItems || []) {
        if (!c) continue;
        c.originWorldId = resolveWorldRef(c.originWorldId && c.originWorldId !== 'main-world' ? c.originWorldId : (c.originWorldName || c.originWorldId), worlds);
        if (c.transitionFrom) c.transitionFrom = resolveWorldRef(c.transitionFrom, worlds);
        if (c.transitionTo) c.transitionTo = resolveWorldRef(c.transitionTo, worlds);
    }
    return result;
}

module.exports = { resolveWorldRef, normalizeWorldRefs, MAIN_WORLD_ALIASES };
