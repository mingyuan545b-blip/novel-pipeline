'use strict';

/**
 * materialManagerSideEffects — 素材管理的前后置副作用（T1/T5）
 *
 * 从 materialManager.js 抽出（保持主流程单文件 ≤200 行 + 主函数 ≤100 行）：
 *   · syncCharacterSideEffects      角色/关系变更后的缓存失效 + 实体注册表同步
 *   · finishSkippedMaterialManager  T5 跳过路径：零变化章不调 LLM，但仍必须完成"归档三件套"
 *
 * 注意：素材生命周期预处理（prepareMaterialContext）留在 materialManager.js，
 *      因为它属于主流程取数，不是"副作用"。
 */
const logger = require('../../../shared/logger');
const characterStateCache = require('../../characterStateCache');
const stateKVIndex = require('../../stateKVIndex');
const { updateChapterStatus, saveChapter, rebuildIndexes } = require('./materialPostProcessor');

/** 角色/关系类素材变更后的副作用：缓存失效 + 实体注册表同步（失败不阻断本章） */
async function syncCharacterSideEffects(projectId, appliedUpdates, chapter) {
    const charRelated = (appliedUpdates || []).filter(u => u.type === 'character' || u.type === 'relationship');
    if (charRelated.length === 0) return;
    try {
        await characterStateCache.invalidateForProject(projectId);
        logger.info('materialManager', `CharacterStateCache 失效（${charRelated.length} 条角色/关系更新, ch${chapter.chapterNumber}）`);
    } catch (_) { logger.warn('materialManager', '[material-manager]', _.message || _); }  // DEGRADE: 影响=characterStateCache.invalidateForProject 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    // 防护4：Pipeline后自动同步实体到registry
    try {
        const { syncToRegistry } = require('../../entityCenter/entityCRUD');
        const entityCenter = require('../../entityCenter');
        const entities = await entityCenter.getEntitiesForProject(projectId, { entityType: 'character' });
        for (const entity of entities) await syncToRegistry(entity);
        logger.info('materialManager', `Entity-registry 已同步（${charRelated.length} 条角色更新, ch${chapter.chapterNumber}）`);
    } catch (_) { logger.warn('materialManager', '[material-manager] Registry sync failed:', _.message || _); }  // DEGRADE: 影响=require 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
}

/**
 * T5 跳过路径：本章零变化信号 → 不调 LLM，直接归档。
 * 必须与正常路径一样完成"归档三件套"（status / output / KV 标记），否则门槛会误判为缺口。
 */
async function finishSkippedMaterialManager({ projectId, chapter, saveAgentOutput, reason }) {
    const emptyOutput = JSON.stringify({ updates: [], archiveLog: [], skipped: true, reason });
    chapter.materialManagerSkipped = true;
    chapter.materialManagerSkippedReason = reason;
    updateChapterStatus(chapter, emptyOutput, saveAgentOutput);
    await saveChapter(chapter);
    saveAgentOutput(projectId, chapter, 'material-manager', emptyOutput);
    await stateKVIndex.markChapterProcessed(projectId, chapter.chapterNumber);
    rebuildIndexes(projectId);
    logger.info('materialManager', `ch${chapter.chapterNumber} 跳过素材管理（${reason}）：省 1 次 LLM 调用 + 整章正文 token`);
    return {
        step: 'material-manager', passed: true, response: emptyOutput,
        feedback: { summary: `素材管理跳过（零变化信号：${reason}）`, updates: [] },
        skipped: true,
    };
}


module.exports = { syncCharacterSideEffects, finishSkippedMaterialManager };
