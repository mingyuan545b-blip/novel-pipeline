'use strict';

/**
 * agentUsageReporter — Agent 调用的 token 去向上报
 *
 * 只做一件事：把"这次调用花在哪几段提示词上、哪段被截断"写进 token-ledger。
 * 项目级累计消耗（预算熔断用）不在这里记 —— 它由 llm.chat 单点记账
 * （见 pipeline/llmBudgetGuard.js），因为 llm.chat 是 usage 的唯一真实来源，
 * 两处都记会重复计费。
 *
 * 抽成独立模块的原因：agentRunner 已接近单文件 200 行上限（audit-hardcode 拦截），
 *   且"上报"是横切关注点，不应散落在编排逻辑里。失败只告警，绝不影响生成。
 *
 * 文件位置：server/services/pipeline/agentUsageReporter.js
 */
const logger = require('../../shared/logger');
const tokenLedger = require('./tokenLedger');

/**
 * @param {object} p { projectId, chapterNumber, step, model, usage, contextReport, outputChars }
 */
async function reportAgentUsage(p) {
    const { projectId, chapterNumber, step, model, usage, contextReport, outputChars } = p;
    if (!projectId) return;
    try {
        await tokenLedger.recordTokenLedger({ projectId, chapterNumber, step, model, usage, contextReport, outputChars });
        await tokenLedger.pruneOldLedger(projectId, chapterNumber || 0);
    } catch (e) {
        logger.warn('agentUsageReporter', 'tokenLedger: ' + e.message);
    }
}

module.exports = { reportAgentUsage };
