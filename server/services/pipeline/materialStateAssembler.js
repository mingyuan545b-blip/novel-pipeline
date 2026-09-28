'use strict';

/**
 * materialStateAssembler — 单点素材装配入口（P1-4c）
 *
 * 为什么要有它（用户诉求"agent 各自拼是不可控、返修复工成本大"）：
 *   原来每个 agent 各自调调度器、各自拼数据，出了问题不知道是"声明要错了"、"加载失败"
 *   还是"素材根本没有"。这里把所有 agent 的取数收到**一处**：
 *     装配（scheduleMaterials）→ 记账（gaps/provenance/density）→ 落装配记录（装配图/门槛共用）
 *   一处装配 = 一处口径 = 一处排查。
 *
 * 硬边界：
 *   - 读：任何 agent 只能走这里（静态审计 scripts/verifyMaterialAssemblyEntry.js）；
 *   - 写：本模块**不写素材**，materials 只有 material-manager 链可写（config/materialWriteOwnership）。
 *
 * 兜底：`context-unresolved`（声明都没解析出来）记为 blocked 缺口并 ERROR 报警 —— 
 *   绝不静默返回空素材让下游凭空造。
 */
const { scheduleMaterials } = require('./agentMaterialScheduler');
const { buildAssemblyReport } = require('./materialAssemblyReport');
const { recordAssembly } = require('./contextAssemblyRecorder');
const logger = require('../../shared/logger');

/** 装配记录落盘（失败不阻断：装配图少一条，不能拖垮本章创作） */
async function safeRecord(params) {
    try {
        await recordAssembly(params);
    } catch (e) {
        logger.warn('materialAssembler', `装配记录落盘失败（不阻断）: ${e.message}`);
    }
}

/**
 * 装配某个 agent 本章所需素材
 * @param {string} agentType
 * @param {object} params { projectId, chapter, materials, ctx, project, genre }
 * @returns {Promise<object>} scheduled + report(gaps/provenance/density)
 */
async function assembleMaterialState(agentType, params) {
    const scheduled = await scheduleMaterials(agentType, params);
    const context = scheduled.context || { materialNeeds: [] };
    const chapterNumber = scheduled.chapterNumber || params.chapter?.chapterNumber || 0;
    const report = buildAssemblyReport({ context, scheduled });
    scheduled.report = report;

    if (report.summary.gapBlocked > 0) {
        logger.error('materialAssembler',
            `${agentType} 第${chapterNumber}章必备素材缺失 ${report.summary.gapBlocked} 类：${report.summary.blockedTypes.join('、')}（下游可能凭空生成，见 gaps.reason）`,
            { agentType, chapterNumber, gaps: report.gaps.filter(g => g.level === 'blocked') });
    }
    await safeRecord({ projectId: params.projectId, agentType, chapterNumber, context, scheduled, report });
    return scheduled;
}

module.exports = { assembleMaterialState };
