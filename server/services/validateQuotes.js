/**
 * validateQuotes — 台词（名言/金句）四要素质检（纯函数，无副作用）
 *
 * 四要素：{ speaker, scene, quote, why, chapter }
 *   - scene / quote / why 必填；speaker 在角色编年史上下文内可继承（允许为空）
 *   - quote 必须原文引用（不可改写），由上游保证逐字一致
 * 依据：docs/design/角色编年史升级-多维分层与素材质检.md
 */
const MIN_QUOTE_CHARS = 2;
const MIN_SCENE_CHARS = 2;
const MIN_WHY_CHARS = 4;

/** 归一化：兼容旧格式（纯字符串 / {scene,quote}）与新格式（四要素） */
function normalizeQuote(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
        const q = raw.trim();
        return q ? { speaker: '', scene: '', quote: q, why: '', chapter: 0 } : null;
    }
    if (typeof raw !== 'object') return null;
    const quote = String(raw.quote ?? raw.text ?? '').trim();
    if (!quote) return null;
    return {
        speaker: String(raw.speaker ?? raw.name ?? '').trim(),
        scene: String(raw.scene ?? '').trim(),
        quote,
        why: String(raw.why ?? '').trim(),
        chapter: Number(raw.chapter) || 0
    };
}

/** 去重键：忽略空白与首尾标点，避免同义/重复台词重复入库 */
function quoteKey(raw) {
    const n = normalizeQuote(raw);
    if (!n) return '';
    return n.quote.replace(/\s/g, '').replace(/[。，！？；、,.!?;~…—"'“”‘’]/g, '');
}

/** 校验单条台词 */
function validateQuote(raw) {
    const n = normalizeQuote(raw);
    if (!n) return { valid: false, issues: ['空台词'], normalized: null };
    const issues = [];
    if (n.quote.length < MIN_QUOTE_CHARS) issues.push('quote（原文）过短');
    if (n.scene.length < MIN_SCENE_CHARS) issues.push('scene（适用场景）缺失');
    if (n.why.length < MIN_WHY_CHARS) issues.push('why（记忆点）缺失');
    return { valid: issues.length === 0, issues, normalized: n };
}

/** 批量校验：返回通过项、失败项（含下标） */
function validateQuotes(list) {
    const items = Array.isArray(list) ? list : [];
    const merged = [];
    const failed = [];
    items.forEach((raw, index) => {
        const r = validateQuote(raw);
        if (r.valid) merged.push(r.normalized);
        else failed.push({ index, issues: r.issues });
    });
    return { valid: failed.length === 0, passed: merged.length, failed, items: merged };
}

/** 去重合并：existing + incoming，按 quoteKey 去重，返回 { merged, added } */
function dedupeQuotes(existing = [], incoming = []) {
    const merged = [];
    const seen = new Set();
    for (const raw of [...existing, ...incoming]) {
        const n = normalizeQuote(raw);
        if (!n) continue;
        const key = quoteKey(n);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(n);
    }
    const before = new Set((existing || []).map(quoteKey).filter(Boolean));
    const added = merged.filter(n => !before.has(quoteKey(n)));
    return { merged, added };
}

module.exports = {
    MIN_QUOTE_CHARS, MIN_SCENE_CHARS, MIN_WHY_CHARS,
    normalizeQuote, quoteKey, validateQuote, validateQuotes, dedupeQuotes
};
