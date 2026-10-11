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
const { assessRelevance, collectOutlineMentionedTypes, genreAccessForAgent } = require('./contextRelevance');
const { getOverridesMap } = require('./contextOverrideStore');
const { resolveServants, resolveTimelineContext } = require('./contextCommanderLoaders');
const { resolveServantLoads } = require('./servantDecisionEngine');
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
    const { projectId, chapter, materials, project, genre } = params;
    const baseDecl = getDeclaration(agentType);
    if (!baseDecl) return _emptyResult(agentType);

    const chapterNumber = chapter?.chapterNumber || chapter?.number || 1;
    const outlineText = (chapter?.outline || '').substring(0, 2000).toLowerCase();
    const totalChapters = project?.targetChapters || project?.targetWordCount && Math.ceil(project.targetWordCount / 2500) || 0;
    const phase = resolveChapterPhase(chapterNumber, totalChapters);
    const genreAllowed = genreAccessForAgent(genre, agentType);
    const sceneTypes = detectSceneTypes(outlineText);
    const materialIds = (materials || []).map(m => m.id);

    const overrides = await _safeGetOverrides(projectId, materialIds, chapterNumber);

    // 加载意图规划→素材深度映射
    const knownCharNames = _extractKnownCharNames(materials);
    const intentResult = await resolveIntentDepth(projectId, chapterNumber, knownCharNames);

    const resolvedNeeds = [];
    const decisionLog = [];
    const outlineTypes = collectOutlineMentionedTypes(materials, outlineText);

    for (const need of baseDecl.materialNeeds) {
        const resolved = _resolveNeed(need, phase, sceneTypes, outlineText, materials, overrides);
        // 应用意图深度覆盖
        applyIntentDepthOverride(resolved, intentResult);
        // 相关性门控：只保留本章真正需要的素材类型（required/一致性/场景/意图/大纲点名）
        const rel = assessRelevance(resolved, {
            sceneBoost: resolved.sceneBoost, intentResult, outlineTypes,
        });
        if (rel.relevant) {
            resolved.relevanceReason = rel.reason;
        } else {
            resolved.dropped = true;
            resolved.dropReason = 'not-relevant';
        }
        // 题材元素组合：题材插件声明的可见素材类型之外的，整类不注入。
        // 【根因修复 2026-10-11】此判定必须优先于 neverDrop 兜底：题材"根本不产出"的类型
        // （如高武 writer needs 无 relationship），若被 neverDrop 强留成空需求，会每章刷假告警
        // "决策需要但素材库无数据"（EMPTY=warning 级）——正是"误报"家族。题材明确声明不产出的类型，
        // 即便在 neverDropTypes 里也应整类丢弃（neverDrop 仍用于预算降级/相关性门控两条链）。
        if (!resolved.dropped && genreAllowed && !genreAllowed.has(resolved.type)) {
            resolved.dropped = true;
            resolved.dropReason = 'genre-excluded';
        }
        resolvedNeeds.push(resolved);
        decisionLog.push(_logEntry(need, resolved, phase));
    }

    const totalBudget = _resolveBudget(baseDecl.totalBudget, phase, sceneTypes);
    const activeNeeds = resolvedNeeds.filter(n => !n.dropped);
    const budgetAllocation = allocateBudget(totalBudget, activeNeeds.map(n => n.type));

    for (const need of activeNeeds) {
        need.budget = budgetAllocation[need.type] || need.budget;
    }

    const budgetAssessment = calculateBudget({
        model: project?.model || DEFAULT_MODEL,
        resolvedNeeds: activeNeeds, sceneTypes, totalBudget,
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
        servantDecisions: await resolveServants(params, outlineText),
        timelineContext: await resolveTimelineContext(projectId, chapterNumber),
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

module.exports = { resolveContext };
