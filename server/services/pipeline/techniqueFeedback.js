/**
 * techniqueFeedback.js — 技法效果反馈闭环
 * 记录审核结果对技法的影响，调度时动态参考
 */
const store = require('../../store');
const logger = require('../../shared/logger');
const { v4: uuidv4 } = require('uuid');

const STORE_TYPE = 'technique-feedback';
const FEEDBACK_ALPHA = 0.1;
const MAX_RECORDS_PER_PROJECT = 100;

/** 裁剪项目旧反馈记录，保留最近MAX_RECORDS_PER_PROJECT条 */
async function _pruneOldRecords(projectId) {
    const items = await store.queryItems(STORE_TYPE, { projectId });
    if (items.length <= MAX_RECORDS_PER_PROJECT) return;
    const sorted = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const toDelete = sorted.slice(MAX_RECORDS_PER_PROJECT);
    for (const item of toDelete) {
        try { await store.deleteItem(STORE_TYPE, item.id); } catch (_) { /* non-critical */ }
    }
    logger.info('techniqueFeedback', `Pruned ${toDelete.length} old records for project ${projectId}`);
}

/** 记录技法反馈（审核步骤后调用） */
async function recordFeedback(projectId, chapterNumber, techniqueIds, passed) {
    if (!projectId || !techniqueIds?.length) return;
    const now = new Date().toISOString();
    const records = techniqueIds.map(id => ({
        id: `tf-${uuidv4()}`,
        projectId,
        chapterNumber,
        techniqueId: id,
        passed: !!passed,
        createdAt: now,
    }));
    for (const r of records) {
        try { await store.setItem(STORE_TYPE, r.id, r); } catch (e) { logger.warn('techniqueFeedback', e.message); }
    }
    await _pruneOldRecords(projectId);
}

/** 获取某技法的加权成功率（基于最近N条反馈） */
async function getTechniqueSuccessRate(techniqueId, projectId, limit = 20) {
    try {
        const all = await store.queryItems(STORE_TYPE, { projectId });
        const filtered = all
            .filter(r => r.techniqueId === techniqueId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit);
        if (filtered.length === 0) return null;
        const passCount = filtered.filter(r => r.passed).length;
        return passCount / filtered.length;
    } catch (_) { return null; }
}

/** 批量获取技法成功率（调度器用） */
async function getBatchSuccessRates(techniqueIds, projectId) {
    if (!projectId || !techniqueIds?.length) return {};
    const rates = {};
    for (const id of techniqueIds) {
        const rate = await getTechniqueSuccessRate(id, projectId);
        if (rate !== null) rates[id] = rate;
    }
    return rates;
}

/** 删除项目的技法反馈（级联删除用） */
async function deleteFeedbackByProject(projectId) {
    const items = await store.queryItems(STORE_TYPE, { projectId });
    for (const item of items) {
        await store.deleteItem(STORE_TYPE, item.id);
    }
    return items.length;
}

module.exports = { recordFeedback, getTechniqueSuccessRate, getBatchSuccessRates, deleteFeedbackByProject, STORE_TYPE };
