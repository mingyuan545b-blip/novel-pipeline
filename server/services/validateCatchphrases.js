'use strict';

/**
 * validateCatchphrases — 口头禅/名梗质检（纯函数，无副作用）
 *
 * 结构：{ text, trigger, why }
 *   - text    口头禅/名梗原文（能反复出现的招牌话，不是一次性对白）
 *   - trigger 什么场合会说
 *   - why     为什么有辨识度（禁评论腔）
 * 判定：见 craftQualitySpec.CATCHPHRASE_TESTS（可复用/有辨识度/长在题材里）
 * 依据：docs/design/角色编年史升级-多维分层与素材质检.md §十
 */
const { hasCommentaryVoice, isFillerLine, hasModernMeme } = require('./craftQualitySpec');

const MIN_TEXT_CHARS = 2;
const MAX_TEXT_CHARS = 30;
const MIN_TRIGGER_CHARS = 2;
const MIN_WHY_CHARS = 6;

function normalizeCatchphrase(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
        const text = raw.trim();
        return text ? { text, trigger: '', why: '' } : null;
    }
    if (typeof raw !== 'object') return null;
    const text = String(raw.text ?? raw.quote ?? raw.phrase ?? '').trim();
    if (!text) return null;
    return {
        text,
        trigger: String(raw.trigger ?? raw.scene ?? '').trim(),
        why: String(raw.why ?? '').trim(),
    };
}

function catchphraseKey(raw) {
    const n = normalizeCatchphrase(raw);
    if (!n) return '';
    return n.text.replace(/\s/g, '').replace(/[。，！？；、,.!?;~…—"'“”‘’]/g, '');
}

function validateCatchphrase(raw) {
    const n = normalizeCatchphrase(raw);
    if (!n) return { valid: false, issues: ['空口头禅'], normalized: null };
    const issues = [];
    if (n.text.length < MIN_TEXT_CHARS) issues.push('text（原文）过短');
    else if (n.text.length > MAX_TEXT_CHARS) issues.push('text（原文）过长，口头禅要短');
    else if (isFillerLine(n.text)) issues.push('过场/功能句，不是口头禅');
    if (hasModernMeme(n.text)) issues.push('含现代网络梗（世界观外的语言）');
    if (n.trigger.length < MIN_TRIGGER_CHARS) issues.push('trigger（什么场合说）缺失');
    if (n.why.length < MIN_WHY_CHARS) issues.push('why（辨识度）缺失');
    else if (hasCommentaryVoice(n.why)) issues.push('why 是评论腔，须改写成"谁在什么处境会这么说"的证据');
    return { valid: issues.length === 0, issues, normalized: n };
}

function validateCatchphrases(list) {
    const items = Array.isArray(list) ? list : [];
    const merged = [];
    const failed = [];
    items.forEach((raw, index) => {
        const r = validateCatchphrase(raw);
        if (r.valid) merged.push(r.normalized);
        else failed.push({ index, issues: r.issues });
    });
    return { valid: failed.length === 0, passed: merged.length, failed, items: merged };
}

function dedupeCatchphrases(existing = [], incoming = []) {
    const merged = [];
    const seen = new Set();
    for (const raw of [...existing, ...incoming]) {
        const n = normalizeCatchphrase(raw);
        if (!n) continue;
        const key = catchphraseKey(n);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(n);
    }
    const before = new Set((existing || []).map(catchphraseKey).filter(Boolean));
    const added = merged.filter((n) => !before.has(catchphraseKey(n)));
    return { merged, added };
}

module.exports = {
    MIN_TEXT_CHARS, MAX_TEXT_CHARS, MIN_TRIGGER_CHARS, MIN_WHY_CHARS,
    normalizeCatchphrase, catchphraseKey, validateCatchphrase, validateCatchphrases, dedupeCatchphrases,
};
