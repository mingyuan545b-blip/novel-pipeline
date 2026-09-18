/**
 * contextDecisionRules.js — 上下文决策规则定义
 * 定义章节位置规则、场景类型规则、大纲关键词规则、预算分配规则
 */

const {
    CHAPTER_PHASES, PHASE_RATIOS, SCENE_KEYWORDS, PHASE_DEPTH_ADJUSTMENTS,
    SCENE_PRIORITY_BOOSTS, BUDGET_RATIOS,
} = require('./contextDecisionTables');
/**
 * 判断章节所处阶段
 * @param {number} chapterNumber 当前章号
 * @param {number} [totalChapters] 项目目标章数（>=longNovelThreshold 时按比例划分）
 */
function resolveChapterPhase(chapterNumber, totalChapters) {
    const num = Number(chapterNumber) || 1;
    const total = Number(totalChapters) || 0;

    if (total >= PHASE_RATIOS.longNovelThreshold) {
        const progress = num / total;
        if (progress <= PHASE_RATIOS.opening) return 'opening';
        if (progress <= PHASE_RATIOS.development) return 'development';
        if (progress <= PHASE_RATIOS.climax) return 'climax';
        return 'resolution';
    }

    for (const [phase, config] of Object.entries(CHAPTER_PHASES)) {
        if (num >= config.range[0] && num <= config.range[1]) return phase;
    }
    return 'development';
}

/** 从大纲文本检测场景类型 */
function detectSceneTypes(outlineText) {
    if (!outlineText) return [];
    const lower = outlineText.toLowerCase();
    const detected = [];
    for (const [scene, keywords] of Object.entries(SCENE_KEYWORDS)) {
        const matchCount = keywords.filter(kw => lower.includes(kw)).length;
        if (matchCount >= 1) detected.push({ scene, confidence: matchCount / keywords.length });
    }
    return detected.sort((a, b) => b.confidence - a.confidence);
}

/** 计算深度调整值 */
function getDepthAdjustment(phase, materialType) {
    const typeKey = _mapToAdjustmentKey(materialType);
    const phaseRules = PHASE_DEPTH_ADJUSTMENTS[phase];
    if (!phaseRules || !phaseRules[typeKey]) return { depthBoost: 0, reason: '无特殊调整' };
    return phaseRules[typeKey];
}

/** 计算场景优先级提升 */
function getScenePriorityBoost(sceneTypes, materialType) {
    let boost = 0;
    for (const { scene } of sceneTypes) {
        const boosts = SCENE_PRIORITY_BOOSTS[scene];
        if (boosts && boosts[materialType]) boost += boosts[materialType];
    }
    return boost;
}

/** 计算预算分配 */
function allocateBudget(totalBudget, materialTypes) {
    const allocation = {};
    let remaining = totalBudget;
    const types = materialTypes.filter(t => BUDGET_RATIOS[t]);
    const otherTypes = materialTypes.filter(t => !BUDGET_RATIOS[t]);

    for (const type of types) {
        const amount = Math.round(totalBudget * BUDGET_RATIOS[type]);
        allocation[type] = amount;
        remaining -= amount;
    }
    if (otherTypes.length > 0) {
        const perOther = Math.round(remaining / otherTypes.length);
        for (const type of otherTypes) allocation[type] = perOther;
    }
    return allocation;
}

function _mapToAdjustmentKey(materialType) {
    const map = {
        'power-system': 'powerSystem',
        'sub-plane': 'worldview',
        geography: 'faction',
        location: 'faction',
    };
    return map[materialType] || materialType;
}

module.exports = {
    CHAPTER_PHASES,
    PHASE_RATIOS, SCENE_KEYWORDS, PHASE_DEPTH_ADJUSTMENTS,
    SCENE_PRIORITY_BOOSTS, BUDGET_RATIOS,
    SCENE_KEYWORDS,
    PHASE_DEPTH_ADJUSTMENTS,
    SCENE_PRIORITY_BOOSTS,
    BUDGET_RATIOS,
    resolveChapterPhase,
    detectSceneTypes,
    getDepthAdjustment,
    getScenePriorityBoost,
    allocateBudget,
};
