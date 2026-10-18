/**
 * techniqueScheduler.js — 技法调度适配器
 * 将藏经阁techIndex接入Context Commander决策链
 * 替代agentRunner中直接调用techIndex的硬编码逻辑
 */
const techIndex = require('../techIndex');
const { detectSceneTypes } = require('./contextDecisionRules');
const { getDepthAdjustment } = require('./contextDecisionRules');
const { baseScore } = require('./techniqueScoring');
const logger = require('../../shared/logger');

/** 场景类型→技法部门映射（使用index.json实际部门名，去掉数字前缀） */
const SCENE_DEPARTMENT_MAP = {
    combat:      ['文笔滤镜部', '情节引擎部', '叙事之魂部'],
    social:      ['对白艺术部', '人物熔炉部', '文笔滤镜部'],
    exploration: ['世界构建部', '文笔滤镜部', '情节引擎部'],
    revelation:  ['叙事之魂部', '情节引擎部', '文笔滤镜部'],
    training:    ['情节引擎部', '世界构建部', '叙事之魂部'],
    emotional:   ['文笔滤镜部', '人物熔炉部', '对白艺术部'],
};

/** 技法世界观深度分类（使用index.json实际部门名，去掉数字前缀） */
const TECH_WORLDVIEW_DEPTH = {
    macro: ['叙事之魂部', '顶层设计部', '世界构建部'],
    meso:  ['情节引擎部', '人物熔炉部', '对白艺术部'],
    micro: ['文笔滤镜部'],
};

/** 世界观深度加载策略 */
const DEPTH_LOAD_STRATEGY = {
    macro: { alwaysLoad: true,  sceneBoost: 0.1 },
    meso:  { alwaysLoad: false, sceneBoost: 0.2 },
    micro: { alwaysLoad: false, sceneBoost: 0.3 },
};

/** 限知认知→技法部门联动：置信度→应加强的部门 */
const KNOWLEDGE_DEPARTMENT_BOOST = {
    suspect:     ['情节引擎部', '叙事之魂部'],
    misinformed: ['情节引擎部', '对白艺术部'],
    unknown:     ['叙事之魂部', '情节引擎部'],
    certain:     ['对白艺术部', '人物熔炉部'],
};

/** 题材→偏好部门映射（题材适配时优先加载对应部门技法）
 * 仅保留通过质量门禁的题材（详见SOP 09 Step1）
 */
const GENRE_DEPARTMENT_AFFINITY = {
    'high-martial-comedy':  ['情节引擎部', '对白艺术部', '文笔滤镜部'],
};

/**
 * 根据Context Commander决策结果调度技法
 * @param {object} params - { agentType, mode, sceneTypes, phase, outlineText, maxTokens, knowledgeContext, genre, feedbackRates }
 * @returns {object} { techniques, formattedPrompt, tokenCost }
 */
function scheduleTechniques(params) {
    const { agentType, mode, sceneTypes = [], phase = 'development', outlineText = '', maxTokens = 600, knowledgeContext = null, genre = null, feedbackRates = null } = params;

    // 源头过滤：auto_disabled（连续低效自动禁用）的技法不得进入注入候选。
    // 此前只过滤深度/场景，未过滤禁用 → "自动禁用"在注入点形同虚设（D 增量·源头修正）。
    const baseTechniques = techIndex.getTechniquesByInjectionPoint(agentType, mode)
        .filter(t => !t.auto_disabled);
    if (baseTechniques.length === 0) return { techniques: [], formattedPrompt: '', tokenCost: 0 };

    const hasScenes = sceneTypes.length > 0;
    const filtered = baseTechniques.filter(tech => {
        const depth = tech.worldviewDepth || getTechWorldviewDepth(tech);
        const strategy = DEPTH_LOAD_STRATEGY[depth] || DEPTH_LOAD_STRATEGY.meso;
        if (strategy.alwaysLoad) return true;
        if (!hasScenes) return depth === 'meso';
        return _isSceneRelevant(tech, sceneTypes);
    });

    const scored = filtered.map(tech => {
        const depth = tech.worldviewDepth || getTechWorldviewDepth(tech);
        // 源头修正：success_rate 单位是 0–100 百分数，经 baseScore 归一化到 0–1，
        // 否则基础分恒为 50 会压过全部 boost，使自适应调度失效（见 techniqueScoring.js）。
        let score = baseScore(tech);
        score += _sceneBoost(tech, sceneTypes, depth);
        score += _phaseBoost(tech, phase);
        score += _outlineBoost(tech, outlineText);
        score += _knowledgeBoost(tech, knowledgeContext);
        score += _genreBoost(tech, genre);
        score += _feedbackBoost(tech, feedbackRates);
        return { ...tech, contextScore: score };
    });

    scored.sort((a, b) => b.contextScore - a.contextScore);

    const selected = scored.slice(0, 5);
    const formattedPrompt = techIndex.formatTechniquesForPrompt(selected, maxTokens);
    const tokenCost = Math.ceil(formattedPrompt.length * 1.5);

    return { techniques: selected, formattedPrompt, tokenCost };
}

/** 判断技法是否与场景相关 */
function _isSceneRelevant(tech, sceneTypes) {
    const dept = _cleanDepartment(tech.department);
    for (const { scene } of sceneTypes) {
        const preferred = SCENE_DEPARTMENT_MAP[scene] || [];
        if (preferred.includes(dept)) return true;
    }
    return false;
}

/** 场景类型对技法的加分 */
function _sceneBoost(tech, sceneTypes, depth) {
    let boost = 0;
    const dept = _cleanDepartment(tech.department);
    const strategy = DEPTH_LOAD_STRATEGY[depth] || DEPTH_LOAD_STRATEGY.meso;
    for (const { scene } of sceneTypes) {
        const preferred = SCENE_DEPARTMENT_MAP[scene] || [];
        if (preferred.includes(dept)) boost += strategy.sceneBoost;
    }
    return boost;
}

/** 章节阶段对技法的加分 */
function _phaseBoost(tech, phase) {
    const dept = _cleanDepartment(tech.department);
    const adj = getDepthAdjustment(phase, dept === '世界构建部' ? 'worldview' : 'character');
    return adj.depthBoost * 0.05;
}

/** 大纲关键词匹配加分 */
function _outlineBoost(tech, outlineText) {
    if (!outlineText || !tech.tags) return 0;
    const lower = outlineText.toLowerCase();
    const matchCount = tech.tags.filter(t => lower.includes(t.toLowerCase())).length;
    return matchCount * 0.1;
}

/** 限知认知对技法的加分 */
function _knowledgeBoost(tech, knowledgeContext) {
    if (!knowledgeContext) return 0;
    const dept = _cleanDepartment(tech.department);
    let boost = 0;
    for (const [confidence, departments] of Object.entries(KNOWLEDGE_DEPARTMENT_BOOST)) {
        const count = knowledgeContext[confidence] || 0;
        if (count > 0 && departments.includes(dept)) boost += 0.15 * Math.min(count, 3);
    }
    return boost;
}

/** 题材适配对技法的加分 */
function _genreBoost(tech, genre) {
    if (!genre) return 0;
    const preferred = GENRE_DEPARTMENT_AFFINITY[genre];
    if (!preferred) return 0;
    const dept = _cleanDepartment(tech.department);
    const idx = preferred.indexOf(dept);
    if (idx === -1) return 0;
    return 0.2 * (preferred.length - idx) / preferred.length;
}

/** 反馈数据对技法的加分/减分 */
function _feedbackBoost(tech, feedbackRates) {
    if (!feedbackRates || !tech.id) return 0;
    const rate = feedbackRates[tech.id];
    if (rate === undefined || rate === null) return 0;
    return (rate - 0.5) * 0.3;
}

/** 清理部门名前缀数字 */
function _cleanDepartment(dept) {
    return (dept || '').replace(/^\d+_/, '');
}

/** 获取技法的世界观深度分类 */
function getTechWorldviewDepth(tech) {
    const dept = _cleanDepartment(tech.department);
    for (const [depth, departments] of Object.entries(TECH_WORLDVIEW_DEPTH)) {
        if (departments.includes(dept)) return depth;
    }
    return 'meso';
}

module.exports = { scheduleTechniques, SCENE_DEPARTMENT_MAP, TECH_WORLDVIEW_DEPTH, DEPTH_LOAD_STRATEGY, KNOWLEDGE_DEPARTMENT_BOOST, GENRE_DEPARTMENT_AFFINITY, getTechWorldviewDepth };
