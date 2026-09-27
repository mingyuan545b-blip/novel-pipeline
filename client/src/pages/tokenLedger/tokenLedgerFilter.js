/**
 * tokenLedgerFilter.js — 场景筛选与前端重算
 *
 * 后端一次返回全部逐章明细（含场景标记），前端按场景切换时本地重算占比，
 * 不再发请求 —— 切换零延迟，也避免"切一次场景打一次接口"。
 */

/** 场景选项（按消耗从高到低） */
export function sceneOptions(data) {
    return (data?.scenes || []).map(s => ({
        key: s.key, label: s.label, chapters: s.chapters.length,
        totalTokens: s.totalTokens, share: s.share,
    }));
}

function chaptersOf(data, sceneKey) {
    const all = data?.chapters || [];
    if (!sceneKey) return all;
    return all.filter(c => (c.sceneTypes || []).some(s => s.key === sceneKey));
}

/** 合并逐章数组（分步 byStep / 分段 bySection） */
function mergeBy(chapters, field, idKey) {
    const map = new Map();
    for (const ch of chapters) {
        for (const it of ch[field] || []) {
            const id = it[idKey];
            const cur = map.get(id) || { ...it, tokens: 0, promptTokens: 0, completionTokens: 0, calls: 0, truncatedCount: 0, lostTokens: 0 };
            cur.tokens += it.tokens || 0;
            cur.lostTokens += it.lostTokens || 0;
            cur.truncatedCount += it.truncatedCount || 0;
            cur.calls += it.calls || 0;
            cur.promptTokens += it.promptTokens || 0;
            cur.completionTokens += it.completionTokens || 0;
            map.set(id, cur);
        }
    }
    const total = [...map.values()].reduce((s, v) => s + v.tokens, 0);
    return [...map.values()]
        .map(v => ({ ...v, share: total ? Number((v.tokens / total * 100).toFixed(1)) : 0, avgTokens: v.calls ? Math.round(v.tokens / v.calls) : 0 }))
        .sort((a, b) => b.tokens - a.tokens);
}

/** 合并分组占比（byGroup） */
function mergeGroups(sections) {
    const map = new Map();
    for (const s of sections) {
        const cur = map.get(s.group) || { group: s.group, label: s.groupLabel || s.group, color: s.color, tokens: 0 };
        cur.tokens += s.tokens;
        map.set(s.group, cur);
    }
    const total = [...map.values()].reduce((s, v) => s + v.tokens, 0);
    return [...map.values()].map(v => ({ ...v, share: total ? Number((v.tokens / total * 100).toFixed(1)) : 0 })).sort((a, b) => b.tokens - a.tokens);
}

/** 按场景筛选后重算全部聚合；sceneKey 为空则原样返回 */
export function applySceneFilter(data, sceneKey) {
    if (!data || !sceneKey) return data;
    const chapters = chaptersOf(data, sceneKey);
    const bySection = mergeBy(chapters, 'bySection', 'slot');
    const byStep = mergeBy(chapters, 'byStep', 'step');
    const sum = (f) => chapters.reduce((n, c) => n + (c[f] || 0), 0);
    const chapterSet = new Set(chapters.map(c => c.chapter));
    const totalTokens = sum('totalTokens');
    const promptTokens = sum('promptTokens');
    const cachedTokens = sum('cachedTokens');
    const wordCount = sum('wordCount');
    return {
        ...data,
        filteredByScene: sceneKey,
        chapters,
        bySection,
        byStep,
        byGroup: mergeGroups(bySection),
        alerts: (data.alerts || []).filter(a => chapterSet.has(a.chapter)),
        trend: chapters.map(c => ({
            chapter: c.chapter, totalTokens: c.totalTokens, promptTokens: c.promptTokens,
            completionTokens: c.completionTokens, cachedTokens: c.cachedTokens, tokensPerKChar: c.tokensPerKChar,
        })),
        totals: {
            ...data.totals,
            chapters: chapters.length,
            calls: sum('calls'),
            totalTokens, promptTokens, cachedTokens,
            completionTokens: sum('completionTokens'),
            wordCount,
            cacheHitRate: promptTokens ? Number((cachedTokens / promptTokens * 100).toFixed(1)) : 0,
            tokensPerKChar: wordCount ? Math.round(totalTokens / (wordCount / 1000)) : 0,
            truncatedCount: sum('truncatedCount'),
            lostTokens: bySection.reduce((n, s) => n + (s.lostTokens || 0), 0),
        },
    };
}
