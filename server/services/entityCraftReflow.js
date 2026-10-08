/**
 * entityCraftReflow — 编年史 → 实体素材回流（台词库/高光场景）
 *
 * 目的：把运行期从章节提取的名言/高光，回流合并进实体（素材单一源），
 *       而不是停留在只读的编年史记录里。
 * 依据：docs/design/角色编年史升级-多维分层与素材质检.md §二/§三/§十
 * 门禁：名言过"名言三问"（validateQuotes）、高光过"高光四问"（validateHighlights）才回流；
 *       评论腔 why / 过场句 quote / 缺代价的高光一律不收（宁缺毋滥，避免实体库变垃圾场）
 * 边界：纯函数（便于单测）；落库由调用方（characterChronicle）执行。
 */
const { validateQuotes, dedupeQuotes } = require('./validateQuotes');
const { validateHighlights, dedupeHighlights } = require('./validateHighlights');

/** 合并台词库：只收录"名言三问"合格的名言，并按 quoteKey 去重 */
function mergeQuoteLibrary(existing, incoming) {
    const base = Array.isArray(existing) ? existing : [];
    const { items } = validateQuotes(incoming);
    if (items.length === 0) return { quoteLibrary: base, added: 0 };
    const { merged, added } = dedupeQuotes(base, items);
    return { quoteLibrary: merged, added: added.length };
}

/** 合并高光场景：只收录"高光四问"合格项，按 scene|what 去重 */
function mergeHighlights(existing, incoming) {
    const base = Array.isArray(existing) ? existing : [];
    const { items } = validateHighlights(incoming);
    if (items.length === 0) return { highlightScenes: base, added: 0 };
    const { merged, added } = dedupeHighlights(base, items);
    return { highlightScenes: merged, added: added.length };
}

/** 依编年史条目计算实体素材补丁（仅在有新增时给出字段，避免空写） */
function buildCraftPatch(entity, entry) {
    const patch = {};
    const q = mergeQuoteLibrary(entity?.quoteLibrary, entry?.quotes);
    if (q.added > 0) patch.quoteLibrary = q.quoteLibrary;
    const h = mergeHighlights(entity?.highlightScenes, entry?.highlights);
    if (h.added > 0) patch.highlightScenes = h.highlightScenes;
    return patch;
}

module.exports = { mergeQuoteLibrary, mergeHighlights, buildCraftPatch };
