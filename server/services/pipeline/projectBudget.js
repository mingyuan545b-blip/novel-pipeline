'use strict';

/**
 * projectBudget — 项目级 token / 费用预算熔断
 *
 * 定位：回答"这个项目已经花了多少、还能不能继续跑"。是长篇连载的成本总闸。
 *   agentRunner 在每次 LLM 调用【前】断言（超限即抛 BudgetExceededError 硬停）、
 *   【后】记账；infinite 流水线在章节边界检查，超限时优雅停机并写日志。
 *
 * 为什么不用 token-ledger 做累计：tokenLedger.pruneOldLedger 会裁剪 200 章之前的记录
 *   （见 tokenLedger.js），用它求和会随项目推进越来越低估。故单开 project-spend：
 *   每项目一条记录、永不过期、用 store.updateItem（进程内写锁）自增，避免并发章节丢失更新。
 *
 * 为什么直读 projects 而非 DataContext：DataContext 对项目记录有缓存，
 *   用户改预算后可能读到旧值；这里只需一次廉价的单条读取，且可规避循环依赖。
 *
 * 文件位置：server/services/pipeline/projectBudget.js
 */
const logger = require('../../shared/logger');
const store = require('../../store');
const { PROJECT_BUDGET } = require('../../config/systemConfig');

const SPEND_STORE = 'project-spend';

/** 预算超限错误：带 code 供上层识别（区别于普通 LLM 错误，不应重试） */
class BudgetExceededError extends Error {
    constructor(message, info) {
        super(message);
        this.name = 'BudgetExceededError';
        this.code = 'BUDGET_EXCEEDED';
        this.isBudgetExceeded = true;
        this.budget = info || null;
    }
}

/** 模型名（小写子串）→ 单价（元/百万token）；未命中用保守兜底价 */
function pricePerMtok(model) {
    const ml = String(model || '').toLowerCase();
    for (const key of Object.keys(PROJECT_BUDGET.MODEL_PRICES_PER_MTOK_CNY)) {
        if (ml.includes(key)) return PROJECT_BUDGET.MODEL_PRICES_PER_MTOK_CNY[key];
    }
    return PROJECT_BUDGET.DEFAULT_PRICE_PER_MTOK_CNY;
}

/** 按 token 量与模型估算成本（元，保留 4 位） */
function estimateCostCny(model, tokens) {
    const t = Number(tokens) || 0;
    return Number((t / 1e6 * pricePerMtok(model)).toFixed(4));
}

function emptyRecord(projectId) {
    return {
        id: projectId, projectId,
        tokens: 0, promptTokens: 0, completionTokens: 0, costCny: 0, calls: 0,
        byModel: {}, byStep: {},
        createdAt: new Date().toISOString(), updatedAt: null,
    };
}

/** 累加增量（纯函数，供 updateItem 使用；不修改入参） */
function applyDelta(cur, delta) {
    const byModel = Object.assign({}, cur.byModel);
    const mk = delta.model || 'unknown';
    byModel[mk] = (byModel[mk] || 0) + delta.tokens;
    const byStep = Object.assign({}, cur.byStep);
    if (delta.step) byStep[delta.step] = (byStep[delta.step] || 0) + delta.tokens;
    return Object.assign({}, cur, {
        tokens: (cur.tokens || 0) + delta.tokens,
        promptTokens: (cur.promptTokens || 0) + (delta.promptTokens || 0),
        completionTokens: (cur.completionTokens || 0) + (delta.completionTokens || 0),
        costCny: Number(((cur.costCny || 0) + delta.cost).toFixed(4)),
        calls: (cur.calls || 0) + 1,
        byModel, byStep,
        updatedAt: new Date().toISOString(),
    });
}

/**
 * 记录一次 LLM 调用的消耗（锁保护自增）。
 * 失败不阻断主流程（记账绝不能因为异常而拖垮生成）。
 */
async function recordSpend(projectId, usage) {
    if (!projectId || !PROJECT_BUDGET.ENABLED) return null;
    const tokens = Number(usage && usage.tokens) || 0;
    if (tokens <= 0) return null;
    const delta = {
        tokens,
        model: usage.model || null,
        step: usage.step || null,
        promptTokens: Number(usage.promptTokens) || 0,
        completionTokens: Number(usage.completionTokens) || 0,
        cost: estimateCostCny(usage.model, tokens),
    };
    try {
        const next = await store.updateItem(SPEND_STORE, projectId, (cur) => applyDelta(cur, delta));
        if (next) return next;
        // updateItem 对不存在的记录返回 null，此处补建首条
        const created = applyDelta(emptyRecord(projectId), delta);
        await store.setItem(SPEND_STORE, projectId, created);
        return created;
    } catch (e) {
        logger.warn('projectBudget', 'recordSpend failed: ' + e.message);
        return null;
    }
}

/** 读取累计消耗（无记录时返回零值，不写库） */
async function getSpend(projectId) {
    if (!projectId) return emptyRecord(null);
    try {
        return (await store.getItem(SPEND_STORE, projectId)) || emptyRecord(projectId);
    } catch (e) {
        logger.warn('projectBudget', 'getSpend failed: ' + e.message);
        return emptyRecord(projectId);
    }
}

/** 项目预算配置：项目级 project.budget 覆盖全局默认 */
async function getBudgetConfig(projectId) {
    let pb = {};
    try {
        const p = projectId ? await store.getItem('projects', projectId) : null;
        pb = (p && p.budget) || {};
    } catch (_) { pb = {}; }
    return {
        enabled: pb.enabled !== undefined ? Boolean(pb.enabled) : PROJECT_BUDGET.ENABLED,
        hardStop: pb.hardStop !== undefined ? Boolean(pb.hardStop) : PROJECT_BUDGET.HARD_STOP,
        tokenLimit: Number(pb.tokenLimit || PROJECT_BUDGET.DEFAULT_TOKEN_LIMIT) || 0,
        costLimitCny: Number(pb.costLimitCny || PROJECT_BUDGET.DEFAULT_COST_LIMIT_CNY) || 0,
        warnRatio: Number(pb.warnRatio || PROJECT_BUDGET.WARN_RATIO) || PROJECT_BUDGET.WARN_RATIO,
    };
}

/**
 * 预算体检。
 * @returns {{status:string, spentTokens:number, spentCostCny:number, ratio:number, ...}}
 *   status: disabled（未启用）| unlimited（未设上限）| ok | warn | exceeded
 */
async function checkProjectBudget(projectId) {
    const cfg = await getBudgetConfig(projectId);
    if (!cfg.enabled) return Object.assign({ status: 'disabled', spentTokens: 0, spentCostCny: 0, ratio: 0 }, cfg);
    const spend = await getSpend(projectId);
    const unlimited = cfg.tokenLimit <= 0 && cfg.costLimitCny <= 0;
    const tokenRatio = cfg.tokenLimit > 0 ? spend.tokens / cfg.tokenLimit : 0;
    const costRatio = cfg.costLimitCny > 0 ? spend.costCny / cfg.costLimitCny : 0;
    const ratio = Math.max(tokenRatio, costRatio);
    let status = 'ok';
    if (unlimited) status = 'unlimited';
    else if (ratio >= 1) status = 'exceeded';
    else if (ratio >= cfg.warnRatio) status = 'warn';
    return Object.assign({
        status, spentTokens: spend.tokens, spentCostCny: spend.costCny,
        calls: spend.calls, byStep: spend.byStep, byModel: spend.byModel,
        tokenRatio, costRatio, ratio,
    }, cfg);
}

/** 断言：超限即抛（调用方应放在 LLM 调用之前） */
async function assertProjectBudget(projectId) {
    if (!projectId) return null;
    const r = await checkProjectBudget(projectId);
    if (r.status === 'exceeded' && r.hardStop) {
        throw new BudgetExceededError(
            '项目预算已超限：已用 ' + r.spentTokens + ' tokens / ¥' + r.spentCostCny +
            '（上限 ' + r.tokenLimit + ' tokens / ¥' + r.costLimitCny + '）',
            r
        );
    }
    if (r.status === 'warn') {
        logger.warn('projectBudget', '预算接近上限：' + Math.round(r.ratio * 100) + '%（project=' + projectId + '）');
    }
    return r;
}

module.exports = {
    SPEND_STORE, BudgetExceededError,
    pricePerMtok, estimateCostCny, applyDelta,
    recordSpend, getSpend, getBudgetConfig, checkProjectBudget, assertProjectBudget,
};
