/**
 * timelineAdapter.js — 时间轴数据统一适配器
 *
 * 职责：把旧的 timelines 表数据结构转换成新的 timeline-events 表数据结构
 * 解决问题：6个写入点写 timelines 表，知识库读 timeline-events 表，数据源不统一
 * 设计原则：唯一入口，统一来源，禁止硬编码
 */
const store = require('../store');
const { addEvent, EVENT_TYPES, SIGNIFICANCE_LEVELS } = require('./timelineService');
const logger = require('../shared/logger');

// 旧eventType → 新eventType 映射（禁止硬编码业务常量，使用枚举）
const EVENT_TYPE_MAP = {
    revelation: EVENT_TYPES.DISCOVERY,
    plot: EVENT_TYPES.CUSTOM,
    character: EVENT_TYPES.MEETING,
    world: EVENT_TYPES.CUSTOM,
    resolution: EVENT_TYPES.ALLIANCE,
    battle: EVENT_TYPES.BATTLE,
    meeting: EVENT_TYPES.MEETING,
    discovery: EVENT_TYPES.DISCOVERY,
    travel: EVENT_TYPES.TRAVEL,
    death: EVENT_TYPES.DEATH,
    birth: EVENT_TYPES.BIRTH,
    ceremony: EVENT_TYPES.CEREMONY,
    betrayal: EVENT_TYPES.BETRAYAL,
    alliance: EVENT_TYPES.ALLIANCE,
    breakthrough: EVENT_TYPES.BREAKTHROUGH
};

// 旧importance → 新significance 映射
const IMPORTANCE_MAP = {
    critical: SIGNIFICANCE_LEVELS.CRITICAL,
    high: SIGNIFICANCE_LEVELS.MAJOR,
    normal: SIGNIFICANCE_LEVELS.NORMAL,
    low: SIGNIFICANCE_LEVELS.MINOR
};

/**
 * 把旧timelines数据结构转换成新timeline-events数据结构并写入
 * @param {string} projectId - 项目ID
 * @param {object} legacyEvent - 旧格式事件 {title, description, eventType, storyTime, chapterIds, location, importance, isKeyEvent, ...}
 * @returns {Promise<object>} 新格式事件
 */
async function saveTimelineEvent(projectId, legacyEvent) {
    if (!projectId) throw new Error('projectId is required');
    if (!legacyEvent) throw new Error('legacyEvent is required');

    // 字段映射
    const chapterNumber = (legacyEvent.chapterIds && legacyEvent.chapterIds.length > 0)
        ? await _resolveChapterNumber(projectId, legacyEvent.chapterIds[0])
        : (legacyEvent.chapterNumber || 0);

    const newEventType = EVENT_TYPE_MAP[legacyEvent.eventType] || EVENT_TYPES.CUSTOM;
    const significance = legacyEvent.isKeyEvent
        ? SIGNIFICANCE_LEVELS.CRITICAL
        : (IMPORTANCE_MAP[legacyEvent.importance] || SIGNIFICANCE_LEVELS.NORMAL);

    // 合并actorIds（characterIds + 其他关联ID）
    const actorIds = [...(legacyEvent.characterIds || [])];

    const newEvent = {
        id: legacyEvent.id,
        projectId,
        chapterNumber,
        eventTime: legacyEvent.storyTime || '',
        eventType: newEventType,
        actorIds,
        locationId: legacyEvent.location || '',
        // 顶层保留 title 和 importance，前端直接读取（data.title 仍保留兼容）
        title: legacyEvent.title || '',
        importance: legacyEvent.importance || (legacyEvent.isKeyEvent ? 'critical' : 'normal'),
        description: legacyEvent.description || legacyEvent.title || '',
        precedingEventIds: [],
        duration: '',
        significance,
        storyline: legacyEvent.storyline || (significance === 'critical' || significance === 'major' ? 'main' : 'sub'),
        data: {
            title: legacyEvent.title || '',
            storyOrder: legacyEvent.storyOrder ?? legacyEvent.sortOrder ?? 0,
            questIds: legacyEvent.questIds || [],
            materialIds: legacyEvent.materialIds || [],
            notes: legacyEvent.notes || '',
            tags: legacyEvent.tags || [],
            isKeyEvent: !!legacyEvent.isKeyEvent
        },
        createdAt: legacyEvent.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // 直接写入 timeline-events 表（绕过addEvent的校验，因为旧数据可能不完全符合addEvent要求）
    await store.setItem('timeline-events', newEvent.id, newEvent);
    return newEvent;
}

/**
 * 根据chapterId查找chapterNumber
 */
async function _resolveChapterNumber(projectId, chapterId) {
    if (!chapterId) return 0;
    try {
        const chapter = await store.getItem('chapters', chapterId);
        return chapter?.chapterNumber || 0;
    } catch (_) {
        return 0;
    }
}

/**
 * 批量迁移旧timelines数据到timeline-events
 */
async function migrateLegacyTimelines(projectId) {
    const legacyTimelines = await store.queryItems('timelines', { projectId });
    let migrated = 0;
    for (const legacy of legacyTimelines) {
        try {
            await saveTimelineEvent(projectId, legacy);
            migrated++;
        } catch (e) {
            logger.warn('timelineAdapter', `Failed to migrate timeline ${legacy.id}: ${e.message}`);
        }
    }
    logger.info('timelineAdapter', `Migrated ${migrated}/${legacyTimelines.length} timelines to timeline-events for project ${projectId}`);
    return { migrated, total: legacyTimelines.length };
}

module.exports = {
    saveTimelineEvent,
    migrateLegacyTimelines,
    EVENT_TYPE_MAP,
    IMPORTANCE_MAP
};
