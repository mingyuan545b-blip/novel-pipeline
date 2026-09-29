'use strict';

/**
 * llmBudgetGuard — LLM 调用层的预算闸门（覆盖所有调用方）
 *
 * 为什么下沉到这一层：
 *   原本只在 agentRunner 里断言预算，但素材生成/大纲生成（outlineGenerator）等
 *   直接调用 llm.chat，绕过了 agentRunner —— 实测把项目限额设为 1 token 后，
 *   POST /api/pipeline/generate-materials 依然跑通并消耗了额度（2026-09-30 实测）。
 *   把闸门放到 llm.chat 这一唯一出口，才谈得上"项目级熔断"。
 *
 * 项目归属解析：显式 options.projectId 优先，其次取流水线运行上下文（AsyncLocalStorage）。
 *   两者都没有（如 modelBakeoff、testConnection）则不做预算干预。
 *
 * 记账也在这里做：llm.chat 是 usage 的唯一真实来源，一次调用只记一笔，避免重复计费。
 *
 * 文件位置：server/services/pipeline/llmBudgetGuard.js
 */
const logger = require('../../shared/logger');
const { getRunContext } = require('../../shared/runContext');

/** 解析本次 LLM 调用所属项目；显式声明跳过时返回 null */
function resolveProjectId(options) {
    if (!options || options.skipBudgetGuard) return null;
    if (options.projectId) return options.projectId;
    const ctx = getRunContext();
    return (ctx && ctx.projectId) || null;
}

/** 调用前：超限即抛。预算超限必须向上抛（不能被吞成普通告警） */
async function assertAllowed(projectId) {
    if (!projectId) return null;
    try {
        const { assertProjectBudget } = require('./projectBudget');
        return await assertProjectBudget(projectId);
    } catch (e) {
        if (e && e.isBudgetExceeded) throw e;
        logger.warn('llmBudgetGuard', '预算断言异常（忽略）: ' + e.message);
        return null;
    }
}

/**
 * 调用前一步到位：解析所属项目 + 断言预算；返回 projectId（无项目则为 null）。
 * 合成一个入口是为了让 llm.chat 里只占一行代码（该函数受 max-lines-per-function 约束）。
 */
async function begin(options) {
    const projectId = resolveProjectId(options);
    if (projectId) await assertAllowed(projectId);
    return projectId;
}

/** 调用后：记账。失败只告警，绝不能影响生成 */
async function record(projectId, info) {
    if (!projectId) return null;
    try {
        const { recordSpend } = require('./projectBudget');
        const usage = (info && info.usage) || {};
        return await recordSpend(projectId, {
            tokens: usage.total_tokens,
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            model: info.model, step: info.step,
        });
    } catch (e) {
        logger.warn('llmBudgetGuard', '预算记账异常（忽略）: ' + e.message);
        return null;
    }
}

module.exports = { resolveProjectId, assertAllowed, begin, record };
