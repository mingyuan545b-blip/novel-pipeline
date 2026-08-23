const store = require('../../../store');
const logger = require('../../../shared/logger');
const {
    extractKeywords,
    associateTimelinesToQuests,
    distributeTimelinesToChapters,
    associateCharactersToTimelines,
    associateMaterialsToQuests
} = require('./templateEntityAssocHelpers');

async function associateTemplateEntities(projectId) {
    const allQuests = await store.queryItems('quests', { projectId });
    const allTimelines = await store.queryItems('timelines', { projectId });
    const allChapters = await store.queryItems('chapters', { projectId });
    const allMaterials = await store.queryItems('materials', { projectId });

    logger.info('outlineTemplateExpander', '[PIPELINE] Association: quests={allQuestsLength}, timelines={allTimelinesLength}, chapters={allChaptersLength}, materials={allMaterialsLength}', { allQuestsLength: allQuests.length, allTimelinesLength: allTimelines.length, allChaptersLength: allChapters.length, allMaterialsLength: allMaterials.length });

    const mainQuests = allQuests.filter(q => !q.parentId && q.tags?.includes('main-quest'));
    const chapterQuests = allQuests.filter(q => q.tags?.includes('auto-generated'));
    const characterMaterials = allMaterials.filter(m => m.type === 'character');

    await associateTimelinesToQuests(allTimelines, mainQuests, allQuests);
    await distributeTimelinesToChapters(allTimelines, allChapters, chapterQuests);
    await associateCharactersToTimelines(allTimelines, characterMaterials);
    await associateMaterialsToQuests(mainQuests, allMaterials);
}

module.exports = { associateTemplateEntities };
