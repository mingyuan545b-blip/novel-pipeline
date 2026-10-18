/**
 * techniqueContextHelpers.js — 技法上下文辅助函数
 * 从agentRunner提取的技法相关异步数据获取逻辑
 */
const { getAccessByProject } = require('../knowledgeBase/knowledgeAccess');
const { resolveGenreFromProject } = require('../genreConfig');
const { getBatchSuccessStats, recordFeedback } = require('./techniqueFeedback');
const techIndex = require('../techIndex');

/** 选中技法缓存：projectId:chapterNumber → techniqueId[] */
const _selectedCache = new Map();

async function buildKnowledgeContext(projectId) {
    if (!projectId) return null;
    try {
        const records = await getAccessByProject(projectId);
        if (!records.length) return null;
        const counts = { certain: 0, suspect: 0, misinformed: 0, unknown: 0 };
        for (const r of records) { if (counts[r.confidence] !== undefined) counts[r.confidence]++; }
        return counts;
    } catch (_) { return null; }
}

async function resolveGenre(projectId) {
    if (!projectId) return null;
    try { return await resolveGenreFromProject(projectId); } catch (_) { return null; }
}

async function buildFeedbackRates(projectId) {
    if (!projectId) return null;
    try {
        const techIds = techIndex.getTechniquesByInjectionPoint('writer', 'novel').map(t => t.id).slice(0, 20);
        if (!techIds.length) return null;
        // 返回 {rate,count} 统计（差分加权需要样本数做置信度缩放），不再只返回速率
        return await getBatchSuccessStats(techIds, projectId);
    } catch (_) { return null; }
}

/** 缓存选中技法ID（agentRunner调用） */
function cacheSelectedTechniques(projectId, chapterNumber, techniqueIds) {
    if (!projectId || !techniqueIds?.length) return;
    _selectedCache.set(`${projectId}:${chapterNumber}`, techniqueIds);
}

/** 获取缓存的技法ID并记录反馈（审核步骤后调用） */
async function recordReviewFeedback(projectId, chapterNumber, passed) {
    if (!projectId) return;
    const key = `${projectId}:${chapterNumber}`;
    const techIds = _selectedCache.get(key);
    if (!techIds?.length) return;
    try {
        await recordFeedback(projectId, chapterNumber, techIds, passed);
        // A4 修复（F4）：把审核结果回写技法库 success_rate/attempts（库 meta），否则"自动禁用/成功率"永远是死数据。
        try {
            const { ValidationEngine } = require('../validationEngine');
            await new ValidationEngine().recordTechniqueResults(techIds, !!passed);
        } catch (_) { /* 技法库不可用时不影响反馈主链 */ }
        _selectedCache.delete(key);
    } catch (_) { /* non-critical */ }
}

module.exports = { buildKnowledgeContext, resolveGenre, buildFeedbackRates, cacheSelectedTechniques, recordReviewFeedback };
