/**
 * contextCommander.js — 上下文决策引擎
 * 替代静态agentDeclarations，根据章节位置+场景类型+大纲+仆从+时间轴+用户覆盖动态决策
 */
const { getDeclaration } = require('./agentDeclarations');
const { DEFAULT_MODEL } = require('../../config/modelResolver');
const { resolveDepth, DEPTH_LEVELS } = require('./contextDepthConstants');
const { resolveWorldviewLoadDepth, classifyMaterial } = require('./worldviewClassification');
const {
    resolveChapterPhase, detectSceneTypes,
    getDepthAdjustment, getScenePriorityBoost, allocateBudget,
} = require('./contextDecisionRules');
const { getOverridesMap } = require('./contextOverrideStore');
const { resolveServantLoads } = require('./servantDecisionEngine');
const { resolveTimelineContext } = require('./timelineContextResolver');
const { calculateBudget } = require('./unifiedBudgetPool');
const { scheduleTechniques } = require('./techniqueScheduler');
const { resolveIntentDepth, applyIntentDepthOverride } = require('./intentDepthResolver');
const {
    emptyResult, extractKnownCharNames, applyDegradation,
    depthToNum, applyDepthBoost, resolveBudget, logEntry, safeGetOverrides,
} = require('./contextCommanderHelpers');
const logger = require('../../shared/logger');

/**
 * 主入口：解析Agent的上下文需求
 * @param {string} agentType - Agent类型
 * @param {object} params - { projectId, chapter, materials, project }
 * @returns {object} { materialNeeds, totalBudget, constraintNeeds, decisionLog }
 */
async function resolveContext(agentType, params) {
    const { projectId, chapter, materials, project } = params;
    const baseDecl = getDeclaration(agentType);
    if (!baseDecl) return _emptyResult(agentType);

    const chapterNumber = chapter?.chapterNumber || chapter?.number || 1;
    const outlineText = (chapter?.outline || '').substring(0, 2000).toLowerCase();
    const phase = resolveChapterPhase(chapterNumber);
    const sceneTypes = detectSceneTypes(outlineText);
    const materialIds = (materials || []).map(m => m.id);

    const overrides = await _safeGetOverrides(projectId, materialIds, chapterNumber);

    // 加载意图规划→素材深度映射
    const knownCharNames = _extractKnownCharNames(materials);
    const intentResult = await resolveIntentDepth(projectId, chapterNumber, knownCharNames);

    const resolvedNeeds = [];
    const decisionLog = [];

    for (const need of baseDecl.materialNeeds) {
        const resolved = _resolveNeed(need, phase, sceneTypes, outlineText, materials, overrides);
        // 应用意图深度覆盖
        applyIntentDepthOverride(resolved, intentResult);
        resolvedNeeds.push(resolved);
        decisionLog.push(_logEntry(need, resolved, phase));
    }

    const totalBudget = _resolveBudget(baseDecl.totalBudget, phase, sceneTypes);
    const budgetAllocation = allocateBudget(totalBudget, resolvedNeeds.map(n => n.type));

    for (const need of resolvedNeeds) {
        need.budget = budgetAllocation[need.type] || need.budget;
    }

    const budgetAssessment = calculateBudget({
        model: project?.model || DEFAULT_MODEL,
        resolvedNeeds, sceneTypes, totalBudget,
    });

    if (budgetAssessment.degradationPlan) {
        _applyDegradation(resolvedNeeds, budgetAssessment.degradationPlan);
    }

    const techResult = scheduleTechniques({
        agentType, mode: project?.mode || 'novel',
        sceneTypes, phase, outlineText, maxTokens: 600,
    });

    return {
        materialNeeds: resolvedNeeds,
        totalBudget,
        constraintNeeds: baseDecl.constraintNeeds,
        lifecycleFilter: baseDecl.lifecycleFilter,
        decisionLog,
        servantDecisions: await _resolveServants(params, outlineText),
        timelineContext: await _safeResolveTimeline(projectId, chapterNumber),
        budgetAssessment,
        techniqueSchedule: techResult,
        intentResult, // 意图深度映射结果，供调度器使用
        meta: { phase, sceneTypes: sceneTypes.map(s => s.scene), chapterNumber },
    };
}

function _resolveNeed(need, phase, sceneTypes, outlineText, materials, overrides) {
    const baseDepth = resolveDepth(need.detail);
    const adjustment = getDepthAdjustment(phase, need.type);
    const sceneBoost = getScenePriorityBoost(sceneTypes, need.type);

    let finalDepth = _applyDepthBoost(baseDepth, adjustment.depthBoost);

    if (need.matchOutline && outlineText) {
        const outlineMats = (materials || []).filter(m => m.type === need.type);
        for (const m of outlineMats) {
            const wvDepth = resolveWorldviewLoadDepth(m, outlineText);
            if (wvDepth && _depthToNum(wvDepth) > _depthToNum(finalDepth)) {
                finalDepth = wvDepth;
            }
        }
    }

    const override = overrides[need.type];
    if (override && override.targetDepth) {
        finalDepth = override.targetDepth;
    }

    return {
        ...need,
        resolvedDepth: finalDepth,
        depthAdjustment: adjustment.depthBoost,
        sceneBoost,
        adjustmentReason: adjustment.reason,
    };
}

function _applyDepthBoost(baseDepth, boost) {
    return applyDepthBoost(baseDepth, boost);
}

function _resolveBudget(baseBudget, phase, sceneTypes) {
    return resolveBudget(baseBudget, phase);
}

async function _safeGetOverrides(projectId, materialIds, chapterNumber) {
    return safeGetOverrides(projectId, materialIds, chapterNumber, getOverridesMap);
}

function _logEntry(need, resolved, phase) {
    return logEntry(need, resolved, phase);
}

function _emptyResult(agentType) {
    return emptyResult(agentType);
}

function _extractKnownCharNames(materials) {
    return extractKnownCharNames(materials);
}

function _applyDegradation(needs, plan) {
    return applyDegradation(needs, plan);
}

async function _resolveServants(params, outlineText) {
    try {
        const { chapter, materials } = params;
        const entityCenter = require('../entityCenter');
        const entities = await entityCenter.getEntitiesForProject(params.projectId, {});
        const servants = entities.filter(e =>
            (e.bindsSummary || []).some(b => require('./contextDepthConstants').SERVANT_BIND_TYPES.has(b.bindType || b.type))
        );
        if (servants.length === 0) return [];
        return resolveServantLoads(servants, { chapter, entities, outlineText });
    } catch (e) {
        logger.warn('contextCommander', `Servant resolution failed: ${e.message}`);
        return [];
    }
}

async function _safeResolveTimeline(projectId, chapterNumber) {
    try {
        return await resolveTimelineContext(projectId, chapterNumber);
    } catch (e) {
        logger.warn('contextCommander', `Timeline resolution failed: ${e.message}`);
        return null;
    }
}

module.exports = { resolveContext };
