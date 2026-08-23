const {
    createMaterialsFromTemplate,
    createQuestsFromTemplate,
    createTimelinesFromTemplate,
    createChaptersFromTemplate
} = require('./templateEntityCreateHelpers');

async function createTemplateEntities(parsed, projectId, now) {
    const createdMaterials = await createMaterialsFromTemplate(parsed, projectId, now);
    const createdQuests = await createQuestsFromTemplate(parsed, projectId, now);
    const createdTimelines = await createTimelinesFromTemplate(parsed, projectId, now);
    const createdChapters = await createChaptersFromTemplate(parsed, projectId, now);

    return { createdMaterials, createdQuests, createdTimelines, createdChapters };
}

module.exports = { createTemplateEntities };
