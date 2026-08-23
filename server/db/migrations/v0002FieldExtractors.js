/**
 * Field extractors for v0002 JSON→SQLite migration.
 * Each extractor pulls typed fields from raw JSON data for SQL INSERT.
 */

function extractReviewFields(data) {
    return {
        chapterId: data.chapterId || '',
        projectId: data.projectId || '',
        reviewType: data.reviewType || data.type || 'first-review',
        passed: data.passed ? 1 : 0
    };
}

function extractQuestFields(data) {
    return {
        projectId: data.projectId || '',
        parentId: data.parentId || null,
        status: data.status || 'planned',
        priority: data.priority || 'normal'
    };
}

function extractTimelineFields(data) {
    return {
        projectId: data.projectId || '',
        eventType: data.eventType || 'plot',
        importance: data.importance || 'normal',
        isKeyEvent: data.isKeyEvent ? 1 : 0
    };
}

function extractInfiniteStateFields(data) {
    return {
        projectId: data.projectId || '',
        running: data.running ? 1 : 0,
        phase: data.phase || null
    };
}

function extractMaterialExtraFields(data) {
    return {
        dialectRegion: data.dialectRegion || null,
        dialectIntensity: data.dialectIntensity || 'medium',
        speechStyle: data.speechStyle || null,
        speechStyleIntensity: data.speechStyleIntensity || 'medium',
        namingStyle: data.namingStyle || null,
        namingStyleIntensity: data.namingStyleIntensity || 'medium',
        archetype: data.archetype || null,
        currentPlaneId: data.currentPlaneId || null,
        isLocked: data.isLocked ? 1 : 0,
        version: data.version || 1,
        sourceChapter: data.sourceChapter || null
    };
}

function extractChapterExtraFields(data) {
    return {
        title: data.title || '',
        wordCount: data.wordCount || (data.content ? data.content.length : 0),
        round: data._reviewRounds || data.round || 0
    };
}

function extractProjectExtraFields(data) {
    const sp = data.styleProfile || {};
    return {
        mode: data.mode || sp.mode || 'novel',
        // Schema-First修复：同时提取targetChapters(标准)和targetChapterCount(历史)，优先标准字段
        // 历史bug：只提取targetChapterCount，漏了targetChapters，导致迁移时数据丢失
        targetChapterCount: data.targetChapters ?? data.targetChapterCount ?? null,
        targetWordCount: data.targetWordCount || null
    };
}

module.exports = {
    extractReviewFields, extractQuestFields, extractTimelineFields,
    extractInfiniteStateFields, extractMaterialExtraFields,
    extractChapterExtraFields, extractProjectExtraFields
};
