/**
 * intentDepthResolver.js — 意图规划→素材深度映射
 * 从chapterIntent提取角色名/伏笔名/关系关键词/世界观关键词
 * 输出每个素材类型的深度提升规则和优先级提升
 */
const { getChapterIntentPlanner } = require('../chapterIntent');
const {
    INTENT_DEPTH_RULES, RELATIONSHIP_KEYWORDS, WORLDVIEW_KEYWORDS,
    COMBAT_KEYWORDS, GROWTH_KEYWORDS,
} = require('./intentDepthConstants');
const logger = require('../../shared/logger');

/** 从意图数据提取角色名列表 */
function extractCharacterNamesFromIntent(intent, knownCharacterNames) {
    const names = new Set();
    if (!intent || !knownCharacterNames) return names;
    const textFields = [
        ...(intent.mustKeep || []), ...(intent.mustAvoid || []),
        intent.conflictDesign || '', intent.goal || '',
    ];
    const allText = textFields.join(' ');
    for (const name of knownCharacterNames) {
        if (allText.includes(name)) names.add(name);
    }
    return names;
}

/** 检测意图文本中是否包含关系冲突关键词 */
function hasRelationshipConflict(intent) {
    const text = [intent.conflictDesign, intent.goal, ...(intent.mustKeep || [])].join('');
    return RELATIONSHIP_KEYWORDS.some(kw => text.includes(kw));
}

/** 检测意图文本中是否包含世界观关键词 */
function hasWorldviewMention(intent) {
    const text = [intent.goal, ...(intent.mustKeep || []), ...(intent.mustAvoid || [])].join('');
    return WORLDVIEW_KEYWORDS.some(kw => text.includes(kw));
}

/** 检测意图文本中是否包含战斗关键词 */
function hasCombatScene(intent) {
    const text = [intent.conflictDesign, intent.goal, ...(intent.mustKeep || [])].join('');
    return COMBAT_KEYWORDS.some(kw => text.includes(kw));
}

/** 检测意图文本中是否包含成长关键词 */
function hasGrowthTheme(intent) {
    const text = [intent.goal, ...(intent.mustKeep || []), ...(intent.mustAvoid || [])].join('');
    return GROWTH_KEYWORDS.some(kw => text.includes(kw));
}

/** 从意图提取伏笔名列表 */
function extractForeshadowingNames(intent) {
    const names = new Set();
    if (!intent) return names;
    const hookFields = [...(intent.hookAdvance || []), ...(intent.hookResolve || [])];
    for (const h of hookFields) {
        if (typeof h === 'string') {
            const name = h.replace(/\([^)]*\)$/, '').trim();
            if (name) names.add(name);
        }
    }
    return names;
}

/** 主入口：解析意图→素材深度规则 */
async function resolveIntentDepth(projectId, chapterNumber, knownCharacterNames) {
    try {
        const planner = getChapterIntentPlanner(projectId);
        const intent = await planner.getIntent(chapterNumber);
        if (!intent) return _emptyResult();

        const characterNames = extractCharacterNamesFromIntent(intent, knownCharacterNames);
        const foreshadowingNames = extractForeshadowingNames(intent);
        const hasRelConflict = hasRelationshipConflict(intent);
        const hasWorldMention = hasWorldviewMention(intent);
        const hasCombat = hasCombatScene(intent);
        const hasGrowth = hasGrowthTheme(intent);

        const depthOverrides = {};
        const priorityOverrides = {};

        // character: 意图提及的角色至少L3
        if (characterNames.size > 0) {
            const rule = INTENT_DEPTH_RULES.character.mustKeep;
            depthOverrides.character = { minDepth: rule.minDepth, reason: rule.reason, names: [...characterNames] };
            priorityOverrides.character = { boost: rule.priorityBoost, reason: rule.reason, names: [...characterNames] };
        }
        // relationship: 冲突涉及关系→至少L3
        if (hasRelConflict) {
            const rule = INTENT_DEPTH_RULES.relationship.conflictDesign;
            depthOverrides.relationship = { minDepth: rule.minDepth, reason: rule.reason };
            priorityOverrides.relationship = { boost: rule.priorityBoost, reason: rule.reason };
        }
        // foreshadowing: hookAdvance/hookResolve→至少L3
        if (foreshadowingNames.size > 0) {
            const hasResolve = (intent.hookResolve || []).length > 0;
            const rule = hasResolve ? INTENT_DEPTH_RULES.foreshadowing.hookResolve : INTENT_DEPTH_RULES.foreshadowing.hookAdvance;
            depthOverrides.foreshadowing = { minDepth: rule.minDepth, reason: rule.reason, names: [...foreshadowingNames] };
            priorityOverrides.foreshadowing = { boost: rule.priorityBoost, reason: rule.reason, names: [...foreshadowingNames] };
        }
        // worldview: 意图提及世界观→深度提升
        if (hasWorldMention) {
            const rule = INTENT_DEPTH_RULES.worldview.mustKeep;
            depthOverrides.worldview = { minDepth: rule.minDepth, reason: rule.reason };
            priorityOverrides.worldview = { boost: rule.priorityBoost, reason: rule.reason };
        }
        // power-system: 战斗场景→至少L3
        if (hasCombat) {
            const rule = INTENT_DEPTH_RULES['power-system'].combat;
            depthOverrides['power-system'] = { minDepth: rule.minDepth, reason: rule.reason };
            priorityOverrides['power-system'] = { boost: rule.priorityBoost, reason: rule.reason };
        }
        // character-combat: 战斗场景→至少L3
        if (hasCombat) {
            const rule = INTENT_DEPTH_RULES['character-combat'].combat;
            depthOverrides['character-combat'] = { minDepth: rule.minDepth, reason: rule.reason };
            priorityOverrides['character-combat'] = { boost: rule.priorityBoost, reason: rule.reason };
        }
        // institution: 世界观提及势力→深度提升
        if (hasWorldMention) {
            const rule = INTENT_DEPTH_RULES.institution.worldview;
            depthOverrides.institution = { minDepth: rule.minDepth, reason: rule.reason };
            priorityOverrides.institution = { boost: rule.priorityBoost, reason: rule.reason };
        }
        // growth-history: 成长主题→至少L3
        if (hasGrowth) {
            const rule = INTENT_DEPTH_RULES['growth-history'].growth;
            depthOverrides['growth-history'] = { minDepth: rule.minDepth, reason: rule.reason };
            priorityOverrides['growth-history'] = { boost: rule.priorityBoost, reason: rule.reason };
        }

        logger.info('intentDepth', `ch${chapterNumber}: chars=[${[...characterNames]}], foreshadow=[${[...foreshadowingNames]}], rel=${hasRelConflict}, world=${hasWorldMention}, combat=${hasCombat}, growth=${hasGrowth}`);

        return { characterNames, foreshadowingNames, hasRelConflict, hasWorldMention, hasCombat, hasGrowth, depthOverrides, priorityOverrides, intent };
    } catch (e) {
        logger.warn('intentDepth', `Intent depth resolution failed: ${e.message}`);
        return _emptyResult();
    }
}

/** 对单个need应用意图深度覆盖 */
function applyIntentDepthOverride(need, intentResult) {
    if (!intentResult || !intentResult.depthOverrides) return need;
    const override = intentResult.depthOverrides[need.type];
    if (!override) return need;
    const currentDepthNum = parseInt((need.resolvedDepth || 'L2').replace('L', ''), 10);
    const minDepthNum = parseInt(override.minDepth.replace('L', ''), 10);
    if (currentDepthNum < minDepthNum) {
        need.resolvedDepth = override.minDepth;
        need.intentDepthOverride = true;
        need.intentDepthReason = override.reason;
    }
    const prioOverride = intentResult.priorityOverrides[need.type];
    if (prioOverride) {
        need.priorityBoost = (need.priorityBoost || 0) + prioOverride.boost;
        need.priorityBoostReason = prioOverride.reason;
    }
    return need;
}

/** 对单个实体判断是否需要意图深度提升 */
function resolveEntityIntentDepth(entity, intentResult) {
    if (!intentResult || !intentResult.characterNames) return null;
    if (intentResult.characterNames.has(entity.name || '')) return 'L3';
    return null;
}

/** 对单个素材判断是否需要意图优先级提升 */
function resolveMaterialIntentPriority(material, intentResult) {
    if (!intentResult) return 0;
    let boost = 0;
    const name = material.name || '';
    const type = material.type || '';
    if (type === 'foreshadowing' && intentResult.foreshadowingNames?.has(name)) boost += 2;
    if (type === 'relationship' && intentResult.characterNames) {
        for (const charName of intentResult.characterNames) {
            if (name.includes(charName)) { boost += 1; break; }
        }
    }
    return boost;
}

function _emptyResult() {
    return { characterNames: new Set(), foreshadowingNames: new Set(), hasRelConflict: false, hasWorldMention: false, hasCombat: false, hasGrowth: false, depthOverrides: {}, priorityOverrides: {}, intent: null };
}

module.exports = {
    INTENT_DEPTH_RULES, RELATIONSHIP_KEYWORDS, WORLDVIEW_KEYWORDS,
    COMBAT_KEYWORDS, GROWTH_KEYWORDS,
    resolveIntentDepth, applyIntentDepthOverride,
    resolveEntityIntentDepth, resolveMaterialIntentPriority,
    extractCharacterNamesFromIntent, extractForeshadowingNames,
    hasCombatScene, hasGrowthTheme,
};
