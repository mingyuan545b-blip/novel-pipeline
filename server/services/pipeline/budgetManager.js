/**
 * budgetManager.js — 动态预算分配管理器
 * 根据模型Token限制、素材优先级、已用预算动态分配
 */
const { DEPTH_LEVELS } = require('./contextDepthConstants');
const { getScenePriorityBoost } = require('./contextDecisionRules');

/** 模型Token预算配置 */
const MODEL_BUDGETS = {
    'qwen3.6-plus':  { maxInput: 30000, safeLimit: 24000, reserveRatio: 0.15 },
    'qwen-turbo':    { maxInput: 8000,  safeLimit: 6000,  reserveRatio: 0.20 },
    default:         { maxInput: 30000, safeLimit: 24000, reserveRatio: 0.15 },
};

/** 降级阈值 */
const DEGRADATION_THRESHOLDS = {
    green:  { ratio: 0.6,  label: '充裕', action: 'none' },
    yellow: { ratio: 0.8,  label: '紧张', action: 'reduce-optional' },
    orange: { ratio: 0.95, label: '危急', action: 'reduce-required' },
    red:    { ratio: 1.0,  label: '超限', action: 'force-minimal' },
};

/**
 * 计算动态预算分配
 * @param {object} params - { model, resolvedNeeds, sceneTypes, totalBudget }
 * @returns {object} { allocations, totalAllocated, status, degradationPlan }
 */
function calculateBudget(params) {
    const { model, resolvedNeeds, sceneTypes, totalBudget } = params;
    const config = MODEL_BUDGETS[model] || MODEL_BUDGETS.default;
    const availableBudget = Math.round(config.safeLimit * (1 - config.reserveRatio));

    const prioritized = _prioritizeNeeds(resolvedNeeds, sceneTypes);
    const allocations = {};
    let remaining = Math.min(totalBudget, availableBudget);

    for (const need of prioritized) {
        const estimated = _estimateTokenCost(need);
        const allocated = Math.min(estimated, remaining);
        allocations[need.type] = {
            tokens: allocated,
            depth: need.resolvedDepth,
            priority: need.priority,
        };
        remaining -= allocated;
    }

    const totalAllocated = availableBudget - remaining;
    const status = _assessStatus(totalAllocated, availableBudget);
    const degradationPlan = status.action !== 'none' ? _buildDegradationPlan(prioritized, status, remaining) : null;

    return { allocations, totalAllocated, remaining, status, degradationPlan };
}

/** 按优先级排序素材需求 */
function _prioritizeNeeds(needs, sceneTypes) {
    return needs.map(need => {
        const requiredBoost = need.required ? 100 : 0;
        const sceneBoost = getScenePriorityBoost(sceneTypes || [], need.type) * 10;
        return { ...need, priority: requiredBoost + sceneBoost };
    }).sort((a, b) => b.priority - a.priority);
}

/** 估算单个需求的Token消耗 */
function _estimateTokenCost(need) {
    const depthConfig = DEPTH_LEVELS[need.resolvedDepth] || DEPTH_LEVELS.L2;
    const tokenBudget = depthConfig.tokenBudget || 330;
    const itemCount = need.maxItems || 5;
    return Math.round(tokenBudget * itemCount * 1.2);
}

/** 评估预算状态 */
function _assessStatus(used, total) {
    const ratio = used / total;
    for (const [level, config] of Object.entries(DEGRADATION_THRESHOLDS)) {
        if (ratio <= config.ratio) return { level, ...config, ratio };
    }
    return { level: 'red', ...DEGRADATION_THRESHOLDS.red, ratio };
}

/** 构建降级计划 */
function _buildDegradationPlan(needs, status, remaining) {
    const plan = { action: status.action, steps: [] };

    if (status.action === 'reduce-optional') {
        const optional = needs.filter(n => !n.required);
        for (const need of optional) {
            plan.steps.push({ type: need.type, action: 'reduce-depth', from: need.resolvedDepth, to: _reduceDepth(need.resolvedDepth) });
        }
    }

    if (status.action === 'reduce-required') {
        for (const need of needs) {
            plan.steps.push({ type: need.type, action: 'reduce-depth', from: need.resolvedDepth, to: _reduceDepth(need.resolvedDepth) });
        }
    }

    if (status.action === 'force-minimal') {
        for (const need of needs) {
            plan.steps.push({ type: need.type, action: 'force-minimal', from: need.resolvedDepth, to: 'L0' });
        }
    }

    return plan;
}

function _reduceDepth(depth) {
    const num = parseInt((depth || 'L2').replace('L', ''), 10);
    return `L${Math.max(0, num - 1)}`;
}

module.exports = { calculateBudget, MODEL_BUDGETS, DEGRADATION_THRESHOLDS };
