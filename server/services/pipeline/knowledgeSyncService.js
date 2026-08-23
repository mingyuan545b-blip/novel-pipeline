/**
 * knowledgeSyncService.js — Pipeline后知识库自动同步服务
 *
 * Bug-3修复：拆分模式下material-registrar不调用processUpdates，
 * 导致syncFactsFromMaterials和timelineService.addEvent从不执行
 *
 * 职责：
 * 1. material-registrar完成后，从最新materials同步facts到knowledge-facts表
 * 2. 为当前章节创建timeline事件（基于章节内容摘要）
 */
const logger = require('../../shared/logger');
const store = require('../../store');
const { syncFactsFromMaterials } = require('../knowledgeBase/factSync');
const { timelineService } = require('../timelineService');

/**
 * 同步知识库：facts + timeline
 * @param {string} projectId
 * @param {number} chapterNumber
 * @param {object} chapter - 章节对象（含content/outline）
 * @param {Array} materials - 当前素材列表
 */
async function syncKnowledgeBase(projectId, chapterNumber, chapter, materials) {
    if (!projectId || !chapterNumber || chapterNumber < 1) return;

    // 1. 同步facts（从最新materials提取）
    try {
        const allMats = materials || await store.queryItems('materials', { projectId });
        const synced = await syncFactsFromMaterials(projectId, allMats);
        if (synced > 0) {
            logger.info('knowledgeSync', `[Bug-3修复] ch${chapterNumber} 同步 ${synced} 条facts到knowledge-facts表`);
        }
    } catch (e) {
        logger.warn('knowledgeSync', `syncFacts failed for ch${chapterNumber}: ${e.message}`);
    }

    // 2. 创建timeline事件（每章一个章节事件）
    try {
        await _ensureChapterTimelineEvent(projectId, chapterNumber, chapter);
    } catch (e) {
        logger.warn('knowledgeSync', `timeline event creation failed for ch${chapterNumber}: ${e.message}`);
    }
}

/**
 * 确保章节有timeline事件（幂等：已存在则跳过）
 */
async function _ensureChapterTimelineEvent(projectId, chapterNumber, chapter) {
    const EVENT_TYPES = timelineService.EVENT_TYPES || {};
    const SIGNIFICANCE_LEVELS = timelineService.SIGNIFICANCE_LEVELS || {};

    // 检查是否已有该章节的timeline事件
    const existing = await timelineService.getEventsForChapter(projectId, chapterNumber);
    if (existing && existing.length > 0) return;

    const outline = (chapter?.outline || '').slice(0, 200);
    const content = (chapter?.content || '').slice(0, 300);
    const description = outline || content || `第${chapterNumber}章事件`;

    await timelineService.addEvent(projectId, {
        chapterNumber,
        eventTime: `第${chapterNumber}章`,
        eventType: EVENT_TYPES.CUSTOM || 'custom',
        actorIds: [],
        description,
        significance: SIGNIFICANCE_LEVELS.NORMAL || 'normal',
        data: { source: 'auto-sync', chapterNumber }
    });
    logger.info('knowledgeSync', `[Bug-3修复] ch${chapterNumber} 创建timeline事件`);
}

module.exports = { syncKnowledgeBase };
