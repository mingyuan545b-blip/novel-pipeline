'use strict';

/**
 * contextRelevance.js — 章节相关性判定（"每章只组合必要提示词"的决策层）
 *
 * 判定顺序（命中任一即视为本章相关）：
 *   required（Agent声明必需）→ 一致性关键类型 → 场景命中 → 意图命中 → 大纲点名
 * 未命中者标记 dropped='not-relevant'，调度器整类不加载，避免"一次性大杂烩"。
 *
 * 阈值/开关唯一来源：config/budgetPolicy.js 的 relevanceGating
 */
const { BUDGET_POLICY } = require('../../config/budgetPolicy');

const RELEVANCE_REASONS = Object.freeze({
    REQUIRED: 'required',
    CONSISTENCY: 'consistency-critical',
    SCENE: 'scene-match',
    INTENT: 'intent-match',
    OUTLINE: 'outline-mention',
});

/** 依据/丢弃原因的中文标签（前端展示与日志共用，单一数据源） */
const RELEVANCE_REASON_LABELS = Object.freeze({
    [RELEVANCE_REASONS.REQUIRED]: 'Agent必需',
    [RELEVANCE_REASONS.CONSISTENCY]: '一致性关键',
    [RELEVANCE_REASONS.SCENE]: '场景命中',
    [RELEVANCE_REASONS.INTENT]: '意图命中',
    [RELEVANCE_REASONS.OUTLINE]: '大纲点名',
    'not-relevant': '与本章无关',
    'genre-excluded': '题材未声明',
    'drop': '预算裁剪',
    'not-in-genre': '题材未声明',
});

/** 取中文依据标签（未知原因原样返回，便于发现新原因未登记） */
function reasonLabel(reason) {
    if (!reason) return '';
    return RELEVANCE_REASON_LABELS[reason] || reason;
}

/** 一致性关键类型（任何题材都不得排除） */
const NEVER_DROP_TYPES = BUDGET_POLICY.neverDropTypes;

/**
 * 题材声明的可见素材类型集合（"按题材组合元素"）
 * @returns {Set<string>|null} null 表示不限制（题材未声明或开关关闭）
 */
function genreAccessForAgent(genre, agentType) {
    if (!BUDGET_POLICY.relevanceGating.respectGenreAccess) return null;
    const needs = genre?.agentMaterialAccess?.[agentType]?.needs;
    if (!Array.isArray(needs) || needs.length === 0) return null;
    return new Set(needs);
}

/**
 * 收集大纲点名到的素材类型
 * @param {Array} materials 项目素材（含name/type）
 * @param {string} outlineText 已小写化的大纲文本
 * @returns {Set<string>} 命中的素材类型集合
 */
function collectOutlineMentionedTypes(materials, outlineText) {
    const hit = new Set();
    if (!outlineText) return hit;
    for (const m of materials || []) {
        const name = (m.name || '').toLowerCase();
        if (!name) continue;
        const matched = outlineText.includes(name)
            || name.split(/[-\s]/).some(part => part.length >= 2 && outlineText.includes(part));
        if (matched) hit.add(m.type);
    }
    return hit;
}

/** 意图是否触及某素材类型（意图深度/优先级覆盖表即意图命中类型） */
function intentTouchesType(type, intentResult) {
    if (!intentResult) return false;
    return Boolean(intentResult.depthOverrides?.[type] || intentResult.priorityOverrides?.[type]);
}

/**
 * 判定单个素材需求与本章的相关性
 * @returns {{relevant: boolean, reason: string|null}}
 */
function assessRelevance(need, ctx) {
    const cfg = BUDGET_POLICY.relevanceGating;
    if (!cfg.enabled) return { relevant: true, reason: null };
    if (need.required) return { relevant: true, reason: RELEVANCE_REASONS.REQUIRED };
    if (cfg.exemptTypes.includes(need.type) || BUDGET_POLICY.neverDropTypes.includes(need.type)) {
        return { relevant: true, reason: RELEVANCE_REASONS.CONSISTENCY };
    }
    if ((ctx.sceneBoost || 0) > 0) return { relevant: true, reason: RELEVANCE_REASONS.SCENE };
    if (intentTouchesType(need.type, ctx.intentResult)) return { relevant: true, reason: RELEVANCE_REASONS.INTENT };
    if (ctx.outlineTypes?.has(need.type)) return { relevant: true, reason: RELEVANCE_REASONS.OUTLINE };
    return { relevant: false, reason: null };
}

module.exports = {
    assessRelevance, collectOutlineMentionedTypes, intentTouchesType,
    genreAccessForAgent, NEVER_DROP_TYPES, RELEVANCE_REASONS,
    RELEVANCE_REASON_LABELS, reasonLabel,
};
