/**
 * contextDecisionRules.js — 上下文决策规则定义
 * 定义章节位置规则、场景类型规则、大纲关键词规则、预算分配规则
 */

/** 章节在故事中的位置阶段 */
const CHAPTER_PHASES = {
    opening:     { range: [1, 5],   label: '开篇期' },
    development: { range: [6, 50],  label: '发展期' },
    climax:      { range: [51, 80], label: '高潮期' },
    resolution:  { range: [81, 99], label: '收尾期' },
};

/** 场景类型关键词映射 */
const SCENE_KEYWORDS = {
    combat:      ['战斗', '交手', '对决', '厮杀', '围攻', '破阵', '反击', '出手', '杀招'],
    social:      ['宴会', '聚会', '谈判', '结盟', '拜访', '茶话', '交流', '对话'],
    exploration: ['探索', '发现', '遗迹', '秘境', '寻宝', '深入', '迷宫', '禁地'],
    revelation:  ['真相', '揭秘', '身世', '阴谋', '背叛', '伏笔', '反转', '揭露'],
    training:    ['修炼', '突破', '悟道', '闭关', '炼丹', '炼器', '参悟', '进阶'],
    emotional:   ['告白', '离别', '重逢', '牺牲', '守护', '思念', '回忆', '承诺'],
};

/** 章节位置对素材深度的调整规则 */
const PHASE_DEPTH_ADJUSTMENTS = {
    opening: {
        worldview:    { depthBoost: 1, reason: '开篇需建立世界观' },
        character:    { depthBoost: 0, reason: '角色逐步引入' },
        powerSystem:  { depthBoost: 1, reason: '开篇需介绍体系' },
        faction:      { depthBoost: 1, reason: '开篇需展示势力' },
    },
    development: {
        worldview:    { depthBoost: 0, reason: '世界观已建立' },
        character:    { depthBoost: 1, reason: '发展期需角色深度' },
        powerSystem:  { depthBoost: 0, reason: '体系已介绍' },
        faction:      { depthBoost: 0, reason: '势力已展示' },
    },
    climax: {
        worldview:    { depthBoost: -1, reason: '高潮聚焦角色' },
        character:    { depthBoost: 1, reason: '高潮需角色完整信息' },
        powerSystem:  { depthBoost: 1, reason: '高潮可能涉及战力' },
        faction:      { depthBoost: -1, reason: '高潮减少势力信息' },
    },
    resolution: {
        worldview:    { depthBoost: -1, reason: '收尾减少世界观' },
        character:    { depthBoost: 0, reason: '收尾保持角色深度' },
        powerSystem:  { depthBoost: -1, reason: '收尾减少体系' },
        faction:      { depthBoost: -1, reason: '收尾减少势力' },
    },
};

/** 场景类型对素材的优先级调整 */
const SCENE_PRIORITY_BOOSTS = {
    combat:      { 'power-system': 2, equipment: 2, character: 1 },
    social:      { character: 2, faction: 1, 'famous-scene': 1 },
    exploration: { geography: 2, 'sub-plane': 2, faction: 1 },
    revelation:  { foreshadowing: 2, character: 1 },
    training:    { 'power-system': 2, equipment: 1, character: 1 },
    emotional:   { character: 2, foreshadowing: 1 },
};

/** 预算分配比例（按素材类型） */
const BUDGET_RATIOS = {
    character:     0.35,
    worldview:     0.10,
    'power-system': 0.08,
    equipment:     0.05,
    faction:       0.05,
    foreshadowing: 0.08,
    'sub-plane':   0.05,
    geography:     0.04,
    'knowledge-access': 0.10,
    other:         0.10,
};

/** 判断章节所处阶段 */
function resolveChapterPhase(chapterNumber) {
    const num = Number(chapterNumber) || 1;
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
