const store = require('../../../store');
const {
    getMaterialLifecycle,
    getCurrentVolumeSubplaneId,
    cleanChapterMaterials,
    getActiveMaterials,
    getMaterialSummary,
    getArchiveHints,
    autoArchiveStaleMaterials,
    autoArchiveForExpansion,
    getLockedEntities,
    getDynamicMaxMaterials
} = require('./materialLifecycle');
const { buildMaterialManagerPrompt } = require('./materialPromptBuilder');
const { parseMaterialManagerOutput } = require('./materialJsonParser');
const { processUpdates, FIELD_TRANSLATIONS } = require('./materialUpdateProcessor');
const { extractFromMarkdown } = require('./materialMarkdownExtractor');
const { syncForeshadowHooks, updateChapterStatus, saveChapter, rebuildIndexes } = require('./materialPostProcessor');

const INTENSITY_MAP = { '轻度': 'light', '中度': 'medium', '重度': 'heavy', 'light': 'light', 'medium': 'medium', 'heavy': 'heavy' };

function parseFlavorTag(content, tagPattern) {
    const match = content.match(tagPattern);
    if (!match) return null;
    return { value: match[1].trim(), intensity: INTENSITY_MAP[match[2]] || 'medium' };
}

async function handleMaterialManager(params) {
    const { projectId, chapter, materials, agentContext, context, runAgent, saveAgentOutput } = params;
    const project = store.getItem('projects', projectId);
    const styleProfile = project?.styleProfile || {};
    const chapterNum = chapter.chapterNumber;

    const allProjectMaterials = materials.filter(m => m.projectId === projectId);
    const { lockedSubplaneIds, lockedFactionIds } = getLockedEntities(allProjectMaterials, projectId);

    cleanChapterMaterials(allProjectMaterials, projectId, chapterNum);

    const activeMaterials = getActiveMaterials(allProjectMaterials, projectId, chapterNum, lockedSubplaneIds, lockedFactionIds);
    const { summary: materialSummary } = getMaterialSummary(activeMaterials);

    const currentVolumeSubplaneId = getCurrentVolumeSubplaneId(projectId, chapterNum);
    const archiveHints = getArchiveHints(activeMaterials, chapterNum, currentVolumeSubplaneId);

    const staleArchived = autoArchiveStaleMaterials(activeMaterials, chapterNum, currentVolumeSubplaneId);
    if (staleArchived.length > 0) {
        console.log(`[PIPELINE] Auto-archived ${staleArchived.length} stale materials`);
    }

    const dynamicMaxMaterials = getDynamicMaxMaterials(chapterNum);
    const expansionArchived = autoArchiveForExpansion(activeMaterials, dynamicMaxMaterials);
    if (expansionArchived.length > 0) {
        console.log(`[PIPELINE] Auto-archived ${expansionArchived.length} materials due to expansion control`);
    }

    const freshActiveMaterials = getActiveMaterials(allProjectMaterials, projectId, chapterNum, lockedSubplaneIds, lockedFactionIds);
    const { summary: finalMaterialSummary } = getMaterialSummary(freshActiveMaterials);
    const finalArchiveHints = getArchiveHints(freshActiveMaterials, chapterNum, currentVolumeSubplaneId);

    agentContext.chapterContent = chapter.content || '';
    agentContext.materialSummary = `【当前素材库摘要】（${freshActiveMaterials.length}个活跃素材）\n${finalMaterialSummary || '空'}\n${finalArchiveHints}`;

    agentContext.content = buildMaterialManagerPrompt({
        chapter,
        materialSummary: finalMaterialSummary,
        archiveHints: finalArchiveHints,
        styleProfile,
        context
    });

    const result = await runAgent('material-manager', agentContext);

    let appliedUpdates = [];

    try {
        const allUpdates = parseMaterialManagerOutput(result.response || '');
        appliedUpdates = await processUpdates(allUpdates, chapter, projectId, freshActiveMaterials, styleProfile);
    } catch (e) {
        console.log(`[PIPELINE] material-manager JSON parse failed, trying markdown extraction for ch${chapter.chapterNumber}`);
        try {
            appliedUpdates = extractFromMarkdown(result.response || '', chapter, projectId, freshActiveMaterials, styleProfile);
        } catch (mdErr) {
            console.warn(`[PIPELINE] Markdown extraction also failed for ch${chapter.chapterNumber}:`, mdErr.message);
        }
    }

    syncForeshadowHooks(result.response, chapter, projectId);

    updateChapterStatus(chapter, result.response, saveAgentOutput);
    await saveChapter(chapter);
    saveAgentOutput(projectId, chapter, 'material-manager', result.response);

    rebuildIndexes(projectId);

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
