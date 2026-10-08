'use strict';

/**
 * craftTargets — 人物工艺的"缺口判定 / 目标筛选 / 补丁构建"（纯函数，无副作用）
 *
 * 从 craftDesigner 拆出（保证单文件 ≤200 行）：这里只做判定与合并，LLM 调用在 craftDesigner。
 * 依据：docs/design/角色编年史升级-多维分层与素材质检.md §十/§十一
 */
const { validateQuotes, quoteKey } = require('./validateQuotes');
const { validateHighlights, highlightKey } = require('./validateHighlights');
const { validateCatchphrases, catchphraseKey } = require('./validateCatchphrases');

const DESIGN_ROLE_LEVELS = ['protagonist', 'key-supporting', 'supporting'];
const MAX_TARGETS = 6;

/** 规定句式：魅力必须写成"当X时，他宁可Y，也不Z"（craftQualitySpec.CHARISMA_FORM） */
const CHARISMA_FORM_RE = /宁可|也不|宁愿/;

function _text(v) { return String(v == null ? '' : v).trim(); }

/** 弱魅力：空，或写成第三人称功能说明（"展现了…""他是主角人性锚点…"）而非选择模式 */
function isWeakCharisma(text) {
    const t = _text(text);
    return !t || !CHARISMA_FORM_RE.test(t);
}

/** 工艺是否达标：文本字段达标，台词/高光/口头禅有合格项 */
function needsCraft(entity) {
    const missing = [];
    if (isWeakCharisma(entity.charisma)) missing.push('人格魅力');
    if (!_text(entity.philosophy)) missing.push('哲学观');
    if (!_text(entity.entranceDesign)) missing.push('出场设计');
    if (validateQuotes(entity.quoteLibrary || []).passed === 0) missing.push('金句库');
    if (validateHighlights(entity.highlightScenes || []).passed === 0) missing.push('高光场景');
    if (validateCatchphrases(entity.catchphrases || []).passed === 0) missing.push('口头禅');
    return missing;
}

function selectCraftTargets(entities, limit) {
    const max = Number(limit) || MAX_TARGETS;
    return (entities || [])
        .filter((e) => DESIGN_ROLE_LEVELS.indexOf(e.roleLevel) >= 0)
        .map((e) => ({ entity: e, missing: needsCraft(e) }))
        .filter((t) => t.missing.length > 0)
        .slice(0, max);
}

/** 名字归一：去中英括号（含别名）、空白、连接符，用于 LLM 回包与实体名的模糊匹配 */
function normName(s) {
    return String(s == null ? '' : s)
        .replace(/[（(][^）)]*[）)]/g, '')
        .replace(/[\s\-_·]/g, '')
        .toLowerCase();
}

function findTarget(targets, name) {
    const n = normName(name);
    if (!n) return null;
    for (const t of targets) {
        const tn = normName(t.entity.name);
        if (!tn) continue;
        if (tn === n || tn.includes(n) || n.includes(tn)) return t;
    }
    return null;
}

function mergeUnique(existing, incoming, keyOf) {
    const out = Array.isArray(existing) ? existing.slice() : [];
    const seen = new Set(out.map(keyOf));
    for (let i = 0; i < incoming.length; i++) {
        const k = keyOf(incoming[i]);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push(incoming[i]);
    }
    return out;
}

/** 单角色补丁：填空缺/弱值；数组按 key 合并去重；不做删除；不达标的新值不落库 */
function buildCraftPatchFromItem(entity, item) {
    const patch = {};
    if (_text(item.charisma) && isWeakCharisma(entity.charisma) && CHARISMA_FORM_RE.test(_text(item.charisma))) {
        patch.charisma = _text(item.charisma);
    }
    if (_text(item.philosophy) && !_text(entity.philosophy)) patch.philosophy = _text(item.philosophy);
    if (_text(item.entranceDesign) && !_text(entity.entranceDesign)) patch.entranceDesign = _text(item.entranceDesign);
    const q = validateQuotes(item.quoteLibrary);
    if (q.passed > 0) {
        const named = q.items.map((x) => ({ ...x, speaker: x.speaker || _text(entity.name) }));
        patch.quoteLibrary = mergeUnique(entity.quoteLibrary, named, quoteKey);
    }
    const h = validateHighlights(item.highlightScenes);
    if (h.passed > 0) patch.highlightScenes = mergeUnique(entity.highlightScenes, h.items, highlightKey);
    const c = validateCatchphrases(item.catchphrases);
    if (c.passed > 0) patch.catchphrases = mergeUnique(entity.catchphrases, c.items, catchphraseKey);
    return patch;
}

module.exports = {
    DESIGN_ROLE_LEVELS, MAX_TARGETS, CHARISMA_FORM_RE,
    isWeakCharisma, needsCraft, selectCraftTargets, normName, findTarget, mergeUnique, buildCraftPatchFromItem,
};
