/**
 * contextBudgetPlanner.js — 素材预算规划与降级决策
 * 从 unifiedBudgetPool.js 拆出（2026-09-18）。职责：
 *   1. calculateBudget：plannedChars(字符预算) vs charBudget
 *   2. 降级：丢低优先级非必需类型 → 再压必需类深度（有下限）
 *   3. 模型预算解析：真实上下文以 contextBudget 为唯一数据源
 * 语义约定见 config/budgetPolicy.js
 */
'use strict';
const { DEPTH_LEVELS } = require('./contextDepthConstants');
const { getScenePriorityBoost } = require('./contextDecisionRules');
const { resolveModelBudget, CONTEXT_BUDGETS } = require('../contextBudget');
const { BUDGET_POLICY, ITEM_COUNT_BY_DEPTH, DEGRADATION_ACTIONS } = require('../../config/budgetPolicy');

/* ===== 模型预算配置 =====
 * 原则1/6：真实上下文长度以 contextBudget 的 CONTEXT_BUDGETS 为唯一数据源，
 * 此处仅保留少量"需要人为压低"的模型覆盖项，不再维护第二份模型表。
 */
const MODEL_BUDGET_OVERRIDES = {
    'qwen-turbo': { maxInput: 8000, safeLimit: 6000, reserveRatio: 0.20 },
};

/** 向后兼容导出（仅代理由 contextBudget 解析出的默认档，勿新增条目） */
const MODEL_BUDGETS = Object.freeze({
    ...MODEL_BUDGET_OVERRIDES,
    default: {
        maxInput: CONTEXT_BUDGETS.default,
        safeLimit: Math.round(CONTEXT_BUDGETS.default * BUDGET_POLICY.modelSafeLimitRatio),
        reserveRatio: 0,
    },
});

/** 降级阈值（从 budgetPolicy 派生，唯一数据源在 config/budgetPolicy.js） */
const DEGRADATION_THRESHOLDS = Object.freeze(
    BUDGET_POLICY.degradationThresholds.reduce((acc, t) => {
        acc[t.level] = { ratio: t.ratio, label: t.label, action: t.action };
        return acc;
    }, {})
);

/* ===== 预算评估与降级 =====
 * 设计（2026-09-18 重写）：
 *   1. totalBudget 明确为"素材字符预算"（与 selectItems 的字符裁剪同语义）
 *   2. 预算评估改用与深度挂钩的 plannedChars（深度×条数上限），不再用最坏情况token估算
 *   3. 降级策略：先丢低优先级非必需类型 → 再丢全部非必需 → 最后才压必需类深度（有下限）
 *      —— 这才是"只组合本章必要的提示词"，而非把所有类型统一压成 L0
 */
function calculateBudget(params) {
    const { model, resolvedNeeds, sceneTypes, totalBudget } = params;
    const charBudget = totalBudget || BUDGET_POLICY.defaultCharBudget;
    const modelConfig = _resolveModelConfig(model);
    const tokenCeiling = Math.round(modelConfig.maxInput * BUDGET_POLICY.modelSafeLimitRatio);

    const prioritized = _prioritizeNeeds(resolvedNeeds, sceneTypes);
    const plan = prioritized.map(need => {
        const plannedChars = _estimateCharCost(need);
        return {
            type: need.type, required: !!need.required, priority: need.priority,
            depth: need.resolvedDepth, plannedChars,
        };
    });

    const plannedChars = plan.reduce((sum, p) => sum + p.plannedChars, 0);
    const ratio = charBudget > 0 ? plannedChars / charBudget : 0;
    const status = _assessStatus(ratio);

    const allocations = {};
    for (const p of plan) {
        allocations[p.type] = { plannedChars: p.plannedChars, depth: p.depth, priority: p.priority };
    }

    // 降级由"真实超支"驱动：只有 plannedChars 超出 charBudget 才动手，
    // 且优先丢低优先级非必需类型（场景/意图命中的类型优先级高，最后才丢）
    const degradationPlan = plannedChars > charBudget ? _buildDegradationPlan(plan, charBudget) : null;
    status.action = degradationPlan ? degradationPlan.action : DEGRADATION_ACTIONS.NONE;

    return {
        allocations, plannedChars, charBudget, tokenCeiling, ratio,
        totalAllocated: plannedChars,
        remaining: charBudget - plannedChars,
        status, degradationPlan,
    };
}

function _resolveModelConfig(model) {
    const override = MODEL_BUDGET_OVERRIDES[model];
    if (override) return override;
    const maxInput = resolveModelBudget(model || 'default');
    return {
        maxInput,
        safeLimit: Math.round(maxInput * BUDGET_POLICY.modelSafeLimitRatio),
        reserveRatio: 0,
    };
}

function _prioritizeNeeds(needs, sceneTypes) {
    return needs.map(need => {
        const requiredBoost = need.required ? 100 : 0;
        const sceneBoost = getScenePriorityBoost(sceneTypes || [], need.type) * 10;
        return { ...need, priority: requiredBoost + sceneBoost };
    }).sort((a, b) => b.priority - a.priority);
}

/** 估算单个素材需求的实际字符占用（深度上限 × 条数上限，再受声明预算约束） */
function _estimateCharCost(need) {
    const depthKey = need.resolvedDepth || 'L2';
    const depthConfig = DEPTH_LEVELS[depthKey] || DEPTH_LEVELS.L2;
    const perItem = depthConfig.maxChars || BUDGET_POLICY.rawDepthChars;
    const itemCount = need.maxItems || ITEM_COUNT_BY_DEPTH[depthKey] || ITEM_COUNT_BY_DEPTH.L2;
    const depthCost = perItem * itemCount;
    return Math.min(need.budget || depthCost, depthCost);
}

/** 判断某类型在降级中是否允许被丢弃（一致性关键类型禁止丢弃） */
function _isDroppable(entry) {
    if (entry.required) return false;
    return !BUDGET_POLICY.neverDropTypes.includes(entry.type);
}

/** 最低深度下限（必需类不得低于 L2，防止"名字|定位"空壳） */
function _depthFloor(entry) {
    const key = (entry.required || BUDGET_POLICY.neverDropTypes.includes(entry.type)) ? 'required' : 'optional';
    return BUDGET_POLICY.minDepthByRequirement[key];
}

function _depthNum(depth) {
    const m = /^L(\d)$/.exec(depth || '');
    return m ? parseInt(m[1], 10) : 2;
}

function _assessStatus(ratio) {
    for (const t of BUDGET_POLICY.degradationThresholds) {
        if (ratio <= t.ratio) return { level: t.level, label: t.label, action: t.action, ratio };
    }
    const last = BUDGET_POLICY.degradationThresholds[BUDGET_POLICY.degradationThresholds.length - 1];
    return { level: last.level, label: last.label, action: last.action, ratio };
}

/**
 * 构建降级计划（steps: { type, action, from, to }，action='drop' 表示整类不注入）
 * 与旧实现的关键差异：不再"全部降到L0"，而是按优先级丢弃非必需类型。
 */
function _buildDegradationPlan(plan, charBudget) {
    const steps = [];
    let planned = plan.reduce((sum, p) => sum + p.plannedChars, 0);
    const droppable = plan.filter(_isDroppable)
        .sort((a, b) => (BUDGET_POLICY.dropOptionalByPriorityAsc ? a.priority - b.priority : b.priority - a.priority));

    // 1) 丢低优先级非必需类型（场景/意图命中的优先级高，最后才丢）
    for (const entry of droppable) {
        if (planned <= charBudget) break;
        steps.push({ type: entry.type, action: 'drop', from: entry.depth, to: null });
        planned -= entry.plannedChars;
    }

    // 2) 仍超支才压必需类深度（不低于下限，保证信息密度）
    let reducedRequired = false;
    if (planned > charBudget) {
        const keep = plan.filter(e => !steps.some(s => s.type === e.type));
        let guard = 0;
        while (planned > charBudget && guard < 8) {
            guard++;
            let reduced = false;
            for (const entry of keep) {
                const floor = _depthNum(_depthFloor(entry));
                const cur = _depthNum(entry.depth);
                if (cur <= floor) continue;
                const next = `L${cur - 1}`;
                const depthCfg = DEPTH_LEVELS[next] || DEPTH_LEVELS.L2;
                const perItem = depthCfg.maxChars || BUDGET_POLICY.rawDepthChars;
                const itemCount = ITEM_COUNT_BY_DEPTH[next] || ITEM_COUNT_BY_DEPTH.L2;
                const nextChars = Math.min(entry.plannedChars, perItem * itemCount);
                planned -= (entry.plannedChars - nextChars);
                steps.push({ type: entry.type, action: DEGRADATION_ACTIONS.REDUCE_REQUIRED_DEPTH, from: entry.depth, to: next });
                entry.depth = next;
                entry.plannedChars = nextChars;
                reduced = true;
                reducedRequired = true;
            }
            if (!reduced) break;
        }
    }

    const action = reducedRequired
        ? DEGRADATION_ACTIONS.REDUCE_REQUIRED_DEPTH
        : (steps.length > 0 ? DEGRADATION_ACTIONS.DROP_OPTIONAL_TAIL : DEGRADATION_ACTIONS.NONE);

    return { action, steps, plannedCharsAfter: planned, charBudget };
}

module.exports = {
    calculateBudget, MODEL_BUDGETS, MODEL_BUDGET_OVERRIDES, DEGRADATION_THRESHOLDS,
};
