const logger = require('../../../shared/logger');
const store = require('../../../store');
const entityCenter = require('../../entityCenter');
const characterStateCache = require('../../characterStateCache');
const { getMetrics } = require('../../metricsCollector');
const { foreshadowLedger } = require('../../knowledgeBase');
const { timelineService, EVENT_TYPES, SIGNIFICANCE_LEVELS } = require('../../timelineService');
const { syncFactsFromMaterials } = require('../../knowledgeBase/factSync');
const { recordDegradation } = require('../degradationTracker');
const { normalizeReferences, normalizeContent, findExistingMaterial, determineAction, injectPlaneForCreate, injectFactionForCharacter, findExistingForArchive } = require('./materialUpdateHelpers');
const { handleCreateAction, handleUpdateAction, handleArchiveAction } = require('./materialActions');
const { FIELD_TRANSLATIONS } = require('./materialFieldUtils');

async function processUpdates(allUpdates, chapter, projectId, materials, styleProfile) {
    const appliedUpdates = [];
    let createCount = 0;
    const MAX_CREATE_PER_CHAPTER = 3;

    for (const update of allUpdates) {
        try {
            normalizeReferences(update, projectId, materials);

            const existing = await findExistingMaterial(update, projectId, materials);
            determineAction(update, existing);

            if (update.action === 'create' && !update.parentPlane) {
                await injectPlaneForCreate(update, chapter, projectId, styleProfile, materials);
            }
            if (update.action === 'create' && update.parentPlane && !update.parentFaction && update.type === 'character') {
                injectFactionForCharacter(update, projectId, materials);
            }
            if (update.action === 'create') {
                createCount++;
                if (createCount > MAX_CREATE_PER_CHAPTER) {
                    logger.warn('materialUpdate', `素材创建硬限制: 每章最多${MAX_CREATE_PER_CHAPTER}个新素材，跳过"${update.name}"`);
                    continue;
                }
            }

            normalizeContent(update);

            const archiveExisting = findExistingForArchive(update, projectId, materials);
            if (['retire', 'deprecate', 'recycle'].includes(update.action)) {
                if (archiveExisting) {
                    await handleArchiveAction(update, archiveExisting, chapter, projectId);
                    appliedUpdates.push({ action: update.action, type: archiveExisting.type, name: archiveExisting.name, reason: update.reason });
                    try { getMetrics(projectId).recordMaterialAdded(chapter.chapterNumber, archiveExisting.type, archiveExisting.name, update.action); } catch (_) { logger.warn('materialUpdate', _.message || _); recordDegradation('materialUpdate', 'metrics', _.message || String(_)); }
                    if (archiveExisting.type === 'foreshadowing' && update.action === 'recycle') {
                        try { await foreshadowLedger.resolve(projectId, archiveExisting.name, chapter.chapterNumber, update.reason || '伏笔回收'); } catch (_) { logger.warn('materialUpdate', _.message || _); recordDegradation('materialUpdate', 'foreshadowLedger', _.message || String(_)); }
                    }
                }
                continue;
            }

            if (existing && update.action === 'update') {
                const success = await handleUpdateAction(update, existing, chapter, projectId, styleProfile);
                if (success) {
                    appliedUpdates.push({ action: 'update', type: existing.type, name: existing.name, reason: update.reason });
                    try { getMetrics(projectId).recordMaterialAdded(chapter.chapterNumber, existing.type, existing.name, 'update'); } catch (_) { logger.warn('materialUpdate', _.message || _); recordDegradation('materialUpdate', 'metrics', _.message || String(_)); }
                    if (existing.type === 'foreshadowing') {
                        try { await foreshadowLedger.advance(projectId, existing.name, chapter.chapterNumber, update.reason || '素材更新'); } catch (_) { logger.warn('materialUpdate', _.message || _); recordDegradation('materialUpdate', 'foreshadowLedger', _.message || String(_)); }
                    }
                    if (existing.type === 'relationship') {
                        try { await entityCenter.syncRelationshipFromMaterial(projectId, existing.name, update.content || '', chapter.chapterNumber); } catch (_) { logger.warn('materialUpdate', _.message || _); recordDegradation('materialUpdate', 'entityCenter', _.message || String(_)); }
                    }
                }
                continue;
            }

            if (update.action === 'create' || !existing) {
                const result = await handleCreateAction(update, chapter, projectId, styleProfile, materials);
                if (result) {
                    appliedUpdates.push({ action: 'create', type: result.type, name: update.name, reason: update.reason });
                    try { getMetrics(projectId).recordMaterialAdded(chapter.chapterNumber, update.type, update.name, 'create'); } catch (_) { logger.warn('materialUpdate', _.message || _); recordDegradation('materialUpdate', 'metrics', _.message || String(_)); }
                    await createTimelineEntry(update, chapter, projectId, result.id);
                    if (result.type === 'foreshadowing') {
                        try { await foreshadowLedger.plant(projectId, update.name, update.content || '', { plantChapter: chapter.chapterNumber, importance: 'normal' }); } catch (_) { logger.warn('materialUpdate', _.message || _); recordDegradation('materialUpdate', 'foreshadowLedger', _.message || String(_)); }
                    }
                    if (result.type === 'relationship') {
                        try { await entityCenter.syncRelationshipFromMaterial(projectId, update.name, update.content || '', chapter.chapterNumber); logger.info('materialUpdate', `EntityCenter: relationship "${update.name}" synced to entity_relations`); } catch (_) { logger.warn('materialUpdate', `Relationship sync failed: ${_.message}`); recordDegradation('materialUpdate', 'entityCenter', _.message || String(_)); }
                    }
                }
            }
        } catch (updateErr) {
            logger.warn('materialUpdate', `素材更新处理失败: "${update.name || 'unknown'}" - ${updateErr.message}`, updateErr.stack?.split('\n').slice(0, 3).join(' | '));
        }
    }

    const charUpdates = appliedUpdates.filter(u => u.type === 'character');
    if (charUpdates.length > 0) {
        try { await characterStateCache.invalidateForProject(projectId); logger.info('materialUpdate', `CharacterStateCache invalidated after ${charUpdates.length} character material updates in ch${chapter.chapterNumber}`); } catch (_) { logger.warn('materialUpdate', _.message || _); recordDegradation('materialUpdate', 'characterStateCache', _.message || String(_)); }
    }

    try {
        const synced = await syncFactsFromMaterials(projectId, materials);
        if (synced > 0) logger.info('materialUpdate', `MemoryPyramid: synced ${synced} facts from materials in ch${chapter.chapterNumber}`);
    } catch (_) { logger.warn('materialUpdate', _.message || _); recordDegradation('materialUpdate', 'syncFacts', _.message || String(_)); }

    return appliedUpdates;
}

async function createTimelineEntry(update, chapter, projectId, newMatId) {
    if (!['character', 'famous-scene', 'foreshadowing', 'power-system'].includes(update.type)) return;

    const eventTypeMap = { 'character': EVENT_TYPES.MEETING, 'famous-scene': EVENT_TYPES.CUSTOM, 'foreshadowing': EVENT_TYPES.DISCOVERY, 'power-system': EVENT_TYPES.BREAKTHROUGH };
    const significanceMap = { 'famous-scene': SIGNIFICANCE_LEVELS.MAJOR, 'foreshadowing': SIGNIFICANCE_LEVELS.NORMAL, 'character': SIGNIFICANCE_LEVELS.NORMAL, 'power-system': SIGNIFICANCE_LEVELS.MINOR };

    try {
        await timelineService.addEvent(projectId, {
            chapterNumber: chapter.chapterNumber,
            eventTime: `第${chapter.chapterNumber}章`,
            eventType: eventTypeMap[update.type] || EVENT_TYPES.CUSTOM,
            actorIds: update.type === 'character' ? [newMatId] : [],
            description: `${update.name}: ${(update.content || '').substring(0, 200)}`,
            significance: significanceMap[update.type] || SIGNIFICANCE_LEVELS.NORMAL,
            data: { materialId: newMatId, materialType: update.type, reason: update.reason || '' }
        });
    } catch (tlErr) {
        logger.warn('materialUpdate', 'Timeline entry creation failed:', tlErr.message);
    }
}

module.exports = {
    processUpdates,
    normalizeContent,
    findExistingMaterial,
    handleCreateAction,
    handleUpdateAction,
    handleArchiveAction,
    FIELD_TRANSLATIONS
};
