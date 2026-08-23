/**
 * contextCommanderHelpers.js — contextCommander的纯工具函数
 * 从contextCommander.js提取，降低主文件行数
 */
'use strict';

const logger = require('../../shared/logger');

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

/** 应用降级计划到needs */
function applyDegradation(needs, plan) {
    for (const step of plan.steps) {
        const need = needs.find(n => n.type === step.type);
        if (need && step.to) {
            need.resolvedDepth = step.to;
            need.degraded = true;
            need.degradationAction = step.action;
        }
    }
}

/** 深度字符串转数字（L0-L4） */
function depthToNum(depth) {
    if (!depth) return 2;
    const match = depth.match(/^L(\d)$/);
    return match ? parseInt(match[1], 10) : 2;
}

/** 应用深度提升 */
function applyDepthBoost(baseDepth, boost) {
    if (boost === 0) return baseDepth;
    const num = depthToNum(baseDepth);
    const adjusted = Math.max(0, Math.min(4, num + boost));
    return `L${adjusted}`;
}

/** 预算解析（按章节阶段调整） */
function resolveBudget(baseBudget, phase) {
    if (phase === 'opening') return Math.round(baseBudget * 1.2);
    if (phase === 'climax') return Math.round(baseBudget * 1.1);
    return baseBudget;
}

/** 构建决策日志条目 */
function logEntry(need, resolved, phase) {
    return {
        type: need.type,
        baseDetail: need.detail,
        resolvedDepth: resolved.resolvedDepth,
        depthAdjustment: resolved.depthAdjustment,
        sceneBoost: resolved.sceneBoost,
        reason: resolved.adjustmentReason,
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
