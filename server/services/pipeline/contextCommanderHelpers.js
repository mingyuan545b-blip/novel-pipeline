/**
 * contextCommanderHelpers.js — contextCommander的纯工具函数
 * 从contextCommander.js提取，降低主文件行数
 */
'use strict';

const logger = require('../../shared/logger');
const { BUDGET_POLICY } = require('../../config/budgetPolicy');

/** 空结果构造器 */
function emptyResult(agentType) {
    return {
        materialNeeds: [], totalBudget: 0, constraintNeeds: {},
        lifecycleFilter: null, decisionLog: [], servantDecisions: [],
        timelineContext: null, budgetAssessment: null, techniqueSchedule: null,
        intentResult: null, meta: { phase: 'unknown', sceneTypes: [] },
    };
}

/** 从materials中提取已知角色名列表 */
function extractKnownCharNames(materials) {
    if (!materials || !Array.isArray(materials)) return [];
    return materials.filter(m => m.type === 'character').map(m => m.name).filter(Boolean);
}

/** 应用降级计划到needs
 *  step.action='drop' → 整类不注入（只组合本章必要素材）
 *  其余 → 降低深度（to 已由预算层保证不低于下限）
 */
function applyDegradation(needs, plan) {
    for (const step of plan.steps) {
        const need = needs.find(n => n.type === step.type);
        if (!need) continue;
        need.degraded = true;
        need.degradationAction = step.action;
        if (step.action === 'drop' || !step.to) {
            need.dropped = true;
            need.dropReason = step.action;
            continue;
        }
        need.resolvedDepth = step.to;
    }
}

/** 深度字符串转数字（L0-L4） */
function depthToNum(depth) {
    if (!depth) return 2;
    const match = depth.match(/^L(\d)$/);
    return match ? parseInt(match[1], 10) : 2;
}

/** 应用深度提升（自动决策的深度上限见 budgetPolicy.maxAutoDepth，用户 override 不受此限） */
function applyDepthBoost(baseDepth, boost) {
    const ceiling = depthToNum(BUDGET_POLICY.maxAutoDepth);
    if (boost === 0) {
        const cur = depthToNum(baseDepth);
        return cur > ceiling ? `L${ceiling}` : baseDepth;
    }
    const num = depthToNum(baseDepth);
    const adjusted = Math.max(0, Math.min(ceiling, num + boost));
    return `L${adjusted}`;
}

/** 预算解析（按章节阶段调整） */
function resolveBudget(baseBudget, phase) {
    if (phase === 'opening') return Math.round(baseBudget * 1.2);
    if (phase === 'climax') return Math.round(baseBudget * 1.1);
    return baseBudget;
}

/** 构建决策日志条目（含相关性/降级结果，供上下文装配图展示"为什么加载/为什么没加载"） */
function logEntry(need, resolved, phase) {
    return {
        type: need.type,
        baseDetail: need.detail,
        resolvedDepth: resolved.resolvedDepth,
        depthAdjustment: resolved.depthAdjustment,
        sceneBoost: resolved.sceneBoost,
        reason: resolved.adjustmentReason,
        relevanceReason: resolved.relevanceReason || null,
        dropped: Boolean(resolved.dropped),
        dropReason: resolved.dropReason || null,
        phase,
    };
}

/** 安全加载覆盖配置 */
async function safeGetOverrides(projectId, materialIds, chapterNumber, getOverridesMapFn) {
    try {
        return await getOverridesMapFn(projectId, materialIds, chapterNumber);
    } catch (e) {
        logger.warn('contextCommander', `Override load failed: ${e.message}`);
        return {};
    }
}

module.exports = {
    emptyResult, extractKnownCharNames, applyDegradation,
    depthToNum, applyDepthBoost, resolveBudget, logEntry, safeGetOverrides,
};
