/**
 * techniqueFeedback.js — 技法效果反馈闭环
 * 记录审核结果对技法的影响，调度时动态参考
 */
const store = require('../../store');
const logger = require('../../shared/logger');
const { v4: uuidv4 } = require('uuid');
const { isHoldout } = require('../holdoutAssigner');

const STORE_TYPE = 'technique-feedback';
const FEEDBACK_ALPHA = 0.1;
const MAX_RECORDS_PER_PROJECT = 100;

/**
 * 该章节是否为"留出集"（D3-a 接线：训练/评估隔离）。
 * 由项目 settings.holdoutRatio 驱动（默认未设 → 关闭，不影响既有行为）。
 * @returns {Promise<boolean>}
 */
async function _isHoldoutChapter(projectId, chapterNumber) {
    try {
        const project = await store.getItem('projects', projectId);
        const ratio = project && project.settings ? project.settings.holdoutRatio : undefined;
        if (ratio === undefined || ratio === null || Number(ratio) <= 0) return false;
        return isHoldout(projectId, chapterNumber, { ratio: Number(ratio) });
    } catch (_) {
        return false; // 读不到项目 → 不隔离（保守，不误伤学习）
    }
}

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
    // 留出集不写入学习数据（避免评估集被"学习"污染；源头不落，而非事后清洗）
    if (await _isHoldoutChapter(projectId, chapterNumber)) {
        logger.info('techniqueFeedback', `skip holdout ch${chapterNumber} (train/eval isolation)`);
        return;
    }
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
        try { await store.setItem(STORE_TYPE, r.id, r); } catch (e) { logger.warn('techniqueFeedback', e.message); }  // DEGRADE: 影响=store.setItem 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }
    await _pruneOldRecords(projectId);
}

/** 获取某技法的反馈统计（速率 + 样本数；基于最近N条反馈） */
async function getTechniqueStats(techniqueId, projectId, limit = 20) {
    try {
        const all = await store.queryItems(STORE_TYPE, { projectId });
        const filtered = all
            .filter(r => r.techniqueId === techniqueId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit);
        if (filtered.length === 0) return null;
        const passCount = filtered.filter(r => r.passed).length;
        return { rate: passCount / filtered.length, count: filtered.length };
    } catch (_) { return null; }
}

/** 获取某技法的加权成功率（基于最近N条反馈） */
async function getTechniqueSuccessRate(techniqueId, projectId, limit = 20) {
    const stats = await getTechniqueStats(techniqueId, projectId, limit);
    return stats ? stats.rate : null;
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

/** 批量获取技法反馈统计（速率+样本数，供置信度加权用） */
async function getBatchSuccessStats(techniqueIds, projectId) {
    if (!projectId || !techniqueIds?.length) return {};
    const stats = {};
    for (const id of techniqueIds) {
        const s = await getTechniqueStats(id, projectId);
        if (s !== null) stats[id] = s;
    }
    return stats;
}

/** 删除项目的技法反馈（级联删除用） */
async function deleteFeedbackByProject(projectId) {
    const items = await store.queryItems(STORE_TYPE, { projectId });
    for (const item of items) {
        await store.deleteItem(STORE_TYPE, item.id);
    }
    return items.length;
}

module.exports = { recordFeedback, getTechniqueStats, getTechniqueSuccessRate, getBatchSuccessRates, getBatchSuccessStats, deleteFeedbackByProject, STORE_TYPE };
