const logger = require('../../shared/logger');
const store = require('../../store');
const { formatContextForPrompt, formatCharacterStateForPrompt, formatMaterialBrief } = require('./memoryContextFormat');
const stateKVIndex = require('../stateKVIndex');
const { getDataContext } = require('../dataContext');
const { resolveGenreFromProject } = require('../genreConfig');

async function assembleContext(projectId, chapterNumber, options = {}) {
    const { maxTokens = 8000, includeWorldview = true, includeForeshadowing = true, includeTimeline = true } = options;
    const _ctx = await getDataContext(projectId);
    const project = await _ctx.getProject();
    const genreId = resolveGenreFromProject(project);

    const context = { characters: [], worldview: {}, foreshadowing: [], timeline: [], relations: [] };

    const charStates = await stateKVIndex.getAllEntityStates(projectId, 'character');
    for (const [charId, state] of Object.entries(charStates)) {
        context.characters.push({ id: charId, name: state.name || charId, state });
    }

    if (includeWorldview) {
        const worldviewItems = await stateKVIndex.getAllEntityStates(projectId, 'worldview');
        for (const [key, value] of Object.entries(worldviewItems)) {
            context.worldview[key] = value;
        }
    }

    if (includeForeshadowing) {
        const materials = await store.queryItems('materials', { projectId, type: 'foreshadowing' });
        context.foreshadowing = materials.filter(m => !m.archived).map(m => ({ id: m.id, name: m.name, progress: m.progress }));
    }

    if (includeTimeline) {
        const chapters = await store.queryItems('chapters', { projectId });
        context.timeline = chapters.sort((a, b) => a.chapterNumber - b.chapterNumber).slice(-5).map(c => ({
            chapter: c.chapterNumber, event: c.title || c.outline?.substring(0, 50) || ''
        }));
    }

    const relations = await store.queryItems('character-relations', { projectId });
    context.relations = relations.map(r => ({ from: r.fromCharacterId, to: r.toCharacterId, label: r.relLabel || r.relType }));

    return context;
}

async function buildMemoryPrompt(projectId, chapterNumber, options = {}) {
    const context = await assembleContext(projectId, chapterNumber, options);
    return formatContextForPrompt(context, options);
}

module.exports = { assembleContext, buildMemoryPrompt, formatContextForPrompt, formatCharacterStateForPrompt, formatMaterialBrief };
