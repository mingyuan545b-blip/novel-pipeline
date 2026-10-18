'use strict';

/**
 * validateHighlights — 高光时刻（名场面）质检（纯函数，无副作用）
 *
 * 结构：{ scene, what, cost, why }
 *   - scene 处境 / what 他做的那个选择（含动作或台词原文）/ cost 代价或反差 / why 记忆点（因果句）
 * 判定：见 craftQualitySpec.HIGHLIGHT_TESTS（去名/代价/画面/不可逆）
 * 依据：docs/design/角色编年史升级-多维分层与素材质检.md §十
 */
const {
    hasCommentaryVoice, isGenericScene, isLabelWhy, looksLikeSummary
} = require('./craftQualitySpec');

const MIN_SCENE_CHARS = 2;
const MIN_WHAT_CHARS = 6;
const MIN_WHY_CHARS = 6;
const MIN_COST_CHARS = 2;

/** 归一化：兼容旧格式（字符串 / {scene,what,why} / {scene,what}）与新格式（含 cost） */
function normalizeHighlight(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
        const what = raw.trim();
        return what ? { scene: '', what, cost: '', why: '' } : null;
    }
    if (typeof raw !== 'object') return null;
    const scene = String(raw.scene ?? '').trim();
    const what = String(raw.what ?? raw.turn ?? raw.line ?? '').trim();
    if (!scene && !what) return null;
    return {
        scene,
        what,
        cost: String(raw.cost ?? '').trim(),
        why: String(raw.why ?? '').trim(),
    };
}

/** 去重键：忽略空白与标点，避免同一名场面重复入库 */
function highlightKey(raw) {
    const n = normalizeHighlight(raw);
    if (!n) return '';
    return `${n.scene}|${n.what}`.replace(/\s/g, '').replace(/[。，！？；、,.!?;~…—"'“”‘’]/g, '');
}

/** 校验单条高光 */
function validateHighlight(raw) {
    const n = normalizeHighlight(raw);
    if (!n) return { valid: false, issues: ['空高光'], normalized: null };
    const issues = [];
    if (n.scene.length < MIN_SCENE_CHARS) issues.push('scene（处境）缺失');
    else if (isGenericScene(n.scene)) issues.push('scene 是空壳词（处境/通用场景…），须写具体处境');
    if (n.what.length < MIN_WHAT_CHARS) issues.push('what（他做的那个选择/动作原文）过短或缺失');
    else if (looksLikeSummary(n.what)) issues.push('what 是剧情摘要（事件复述），须写"那一个选择/动作或台词原文"');
    if (n.cost.length < MIN_COST_CHARS) issues.push('cost（代价/反差）缺失——高光四问之"有代价"不通过');
    if (n.why.length < MIN_WHY_CHARS) issues.push('why（记忆点）缺失');
    else if (isLabelWhy(n.why)) issues.push('why 是标签（"记忆点：…"），须写"为什么记得住"本身');
    else if (hasCommentaryVoice(n.why)) issues.push('why 是评论腔（展现/体现/立住…），须改写成"因为他…所以宁可…也不…"');
    return { valid: issues.length === 0, issues, normalized: n };
}

/** 批量校验：返回通过项、失败项（含下标） */
function validateHighlights(list) {
    const items = Array.isArray(list) ? list : [];
    const merged = [];
    const failed = [];
    items.forEach((raw, index) => {
        const r = validateHighlight(raw);
        if (r.valid) merged.push(r.normalized);
        else failed.push({ index, issues: r.issues });
    });
    return { valid: failed.length === 0, passed: merged.length, failed, items: merged };
}

/** 去重合并：existing + incoming，按 highlightKey 去重，返回 { merged, added } */
function dedupeHighlights(existing = [], incoming = []) {
    const merged = [];
    const seen = new Set();
    for (const raw of [...existing, ...incoming]) {
        const n = normalizeHighlight(raw);
        if (!n) continue;
        const key = highlightKey(n);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(n);
    }
    const before = new Set((existing || []).map(highlightKey).filter(Boolean));
    const added = merged.filter((n) => !before.has(highlightKey(n)));
    return { merged, added };
}

module.exports = {
    MIN_SCENE_CHARS, MIN_WHAT_CHARS, MIN_WHY_CHARS, MIN_COST_CHARS,
    normalizeHighlight, highlightKey, validateHighlight, validateHighlights, dedupeHighlights,
};
