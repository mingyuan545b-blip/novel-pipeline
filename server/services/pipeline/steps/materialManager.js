const logger = require('../../../shared/logger');
const store = require('../../../store');
const {
    getMaterialLifecycle,
    getCurrentVolumeSubplaneId,
    cleanChapterMaterials,
    getActiveMaterials,
    getMaterialSummary,
    getArchiveHints,
    getLockedEntities,
    getDynamicMaxMaterials
} = require('./materialLifecycle');
const { autoArchiveStaleMaterials, autoArchiveForExpansion } = require('./materialArchive');
const { buildMaterialManagerPrompt } = require('./materialPromptBuilder');
const { parseMaterialManagerOutput } = require('./materialJsonParser');
const { processUpdates, FIELD_TRANSLATIONS } = require('./materialUpdateProcessor');
const { extractFromMarkdown } = require('./materialMarkdownExtractor');
const { syncForeshadowHooks, updateChapterStatus, saveChapter, extractTimelineAndForeshadow, rebuildIndexes } = require('./materialPostProcessor');
const characterStateCache = require('../../characterStateCache');
const { broadcastToProject } = require('../../websocket');
const { resetDataContext, getDataContext } = require('../../dataContext');
const stateKVIndex = require('../../stateKVIndex');
const { syncKnowledgeBase } = require('../knowledgeSyncService');

const INTENSITY_MAP = { '轻度': 'light', '中度': 'medium', '重度': 'heavy', 'light': 'light', 'medium': 'medium', 'heavy': 'heavy' };

function parseFlavorTag(content, tagPattern) {
    const match = content.match(tagPattern);
    if (!match) return null;
    return { value: match[1].trim(), intensity: INTENSITY_MAP[match[2]] || 'medium' };
}

async function handleMaterialManager(params) {
    const { projectId, chapter, materials, agentContext, context, runAgent, saveAgentOutput } = params;
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    const styleProfile = project?.styleProfile || {};
    const chapterNum = chapter.chapterNumber;

    const allProjectMaterials = materials.filter(m => m.projectId === projectId);
    const { lockedSubplaneIds, lockedFactionIds } = getLockedEntities(allProjectMaterials, projectId);

    await cleanChapterMaterials(allProjectMaterials, projectId, chapterNum);

    const activeMaterials = getActiveMaterials(allProjectMaterials, projectId, chapterNum, lockedSubplaneIds, lockedFactionIds);
    const { summary: materialSummary } = getMaterialSummary(activeMaterials);

    const currentVolumeSubplaneId = await getCurrentVolumeSubplaneId(projectId, chapterNum);
    const archiveHints = getArchiveHints(activeMaterials, chapterNum, currentVolumeSubplaneId);

    const staleArchived = await autoArchiveStaleMaterials(activeMaterials, chapterNum, currentVolumeSubplaneId);
    if (staleArchived.length > 0) {
        logger.info('materialManager', `Auto-archived ${staleArchived.length} stale materials`);
    }

    const dynamicMaxMaterials = getDynamicMaxMaterials(chapterNum);
    const expansionArchived = await autoArchiveForExpansion(activeMaterials, dynamicMaxMaterials);
    if (expansionArchived.length > 0) {
        logger.info('materialManager', `Auto-archived ${expansionArchived.length} materials due to expansion control`);
    }

    const freshActiveMaterials = getActiveMaterials(allProjectMaterials, projectId, chapterNum, lockedSubplaneIds, lockedFactionIds);
    const { summary: finalMaterialSummary } = getMaterialSummary(freshActiveMaterials);
    const finalArchiveHints = getArchiveHints(freshActiveMaterials, chapterNum, currentVolumeSubplaneId);

    const unresolvedForeshadowings = freshActiveMaterials.filter(m => m.type === 'foreshadowing' && !m.archived);

    agentContext.chapterContent = chapter.content || '';
    agentContext.materialSummary = `【当前素材库摘要】（${freshActiveMaterials.length}个活跃素材）\n${finalMaterialSummary || '空'}\n${finalArchiveHints}`;

    agentContext.content = await buildMaterialManagerPrompt({
        chapter,
        materialSummary: finalMaterialSummary,
        archiveHints: finalArchiveHints,
        styleProfile,
        context: { ...context, unresolvedForeshadowings }
    });

    const result = await runAgent('material-manager', agentContext);

    let appliedUpdates = [];

    try {
        const allUpdates = parseMaterialManagerOutput(result.response || '');
        appliedUpdates = await processUpdates(allUpdates, chapter, projectId, freshActiveMaterials, styleProfile);
        broadcastToProject(projectId, 'pipeline:material-update', { chapterNumber: chapter.chapterNumber });
        resetDataContext(projectId);
    } catch (e) {
        logger.info('materialManager', `material-manager JSON parse failed, trying markdown extraction for ch${chapter.chapterNumber}`);
        try {
            appliedUpdates = extractFromMarkdown(result.response || '', chapter, projectId, freshActiveMaterials, styleProfile);
        } catch (mdErr) {
            logger.warn('materialManager', `Markdown extraction also failed for ch${chapter.chapterNumber}:`, mdErr.message);
        }
    }

    await syncForeshadowHooks(result.response, chapter, projectId);

    if (appliedUpdates.length > 0) {
        const charRelatedUpdates = appliedUpdates.filter(u => u.type === 'character' || u.type === 'relationship');
        if (charRelatedUpdates.length > 0) {
            try {
                await characterStateCache.invalidateForProject(projectId);
                logger.info('materialManager', `CharacterStateCache invalidated by materialManager after ${charRelatedUpdates.length} character/relationship updates in ch${chapter.chapterNumber}`);
            } catch (_) { logger.warn('materialManager', '[material-manager]', _.message || _); }

            // 防护4：Pipeline后自动同步实体到registry
            try {
                const { syncToRegistry } = require('../../entityCenter/entityCRUD');
                const entityCenter = require('../../entityCenter');
                const entities = await entityCenter.getEntitiesForProject(projectId, { entityType: 'character' });
                for (const entity of entities) {
                    await syncToRegistry(entity);
                }
                logger.info('materialManager', `Entity-registry synced after ${charRelatedUpdates.length} character updates in ch${chapter.chapterNumber}`);
            } catch (_) { logger.warn('materialManager', '[material-manager] Registry sync failed:', _.message || _); }
        }
    }

    updateChapterStatus(chapter, result.response, saveAgentOutput);
    await saveChapter(chapter);
    saveAgentOutput(projectId, chapter, 'material-manager', result.response);

    // 提取时间线事件和伏笔状态（从正文+大纲+意图规划）
    const outlineText = chapter.outline || agentContext.outline || '';
    const intentResult = context?.intentResult || null;
    await extractTimelineAndForeshadow(projectId, chapter, outlineText, intentResult);

    rebuildIndexes(projectId);

    // 源头修复（陷阱#87）：material-manager内部自然更新chapterUpdated和知识库
    // 此前非拆分模式不调用markChapterProcessed/syncKnowledgeBase，由pipelineStepRunner外部补标记（堵漏）
    // 现在统一在material-manager内部完成，删除外部补标记
    await stateKVIndex.markChapterProcessed(projectId, chapterNum);
    await syncKnowledgeBase(projectId, chapterNum, chapter, materials);

    const updateSummary = appliedUpdates.length > 0
        ? appliedUpdates.map(u => `[${u.action}] ${u.type}: ${u.name}`).join('; ')
        : '无素材变更';

    return {
        step: 'material-manager',
        passed: true,
        response: result.response,
        feedback: {
            summary: `素材管理完成: ${updateSummary}`,
            updates: appliedUpdates
        },
        updates: appliedUpdates
    };
}

module.exports = { handleMaterialManager, FIELD_TRANSLATIONS, getMaterialLifecycle, parseFlavorTag };
