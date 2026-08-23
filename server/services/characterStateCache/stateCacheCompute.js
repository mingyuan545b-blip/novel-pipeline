const logger = require('../../shared/logger');
const store = require('../../store');
const { getCharacterStateSchema, applyStateDelta } = require('../../config/characterStateSchemas');
const { resolveGenreFromProject } = require('../../services/genreConfig');

async function _computeAndCache(projectId, characterId, chapterNumber, genreId) {
    const schema = getCharacterStateSchema(genreId);
    const stateRecords = await store.queryItems('character-states', { projectId, characterId });
    const relevantRecords = stateRecords.filter(r => r.chapterNumber <= chapterNumber).sort((a, b) => a.chapterNumber - b.chapterNumber);

    let computedState = {};
    for (const record of relevantRecords) {
        if (record.delta) {
            const flatDelta = {};
            for (const [key, change] of Object.entries(record.delta)) {
                if (change?.to !== undefined) flatDelta[key] = change.to;
            }
            computedState = applyStateDelta(computedState, flatDelta);
        }
    }

    const cacheId = `cache-${characterId}-ch${chapterNumber}`;
    const cacheRecord = {
        id: cacheId, projectId, characterId, chapterNumber,
        state: computedState, genreId,
        computedAt: new Date().toISOString(),
        recordCount: relevantRecords.length
    };
    await store.setItem('character-state-cache', cacheId, cacheRecord);
    return computedState;
}

async function getCachedState(projectId, characterId, chapterNumber) {
    const cacheId = `cache-${characterId}-ch${chapterNumber}`;
    const cached = await store.getItem('character-state-cache', cacheId);
    if (cached) return cached.state;

    const project = await store.getItem('projects', projectId);
    const genreId = resolveGenreFromProject(project);
    return await _computeAndCache(projectId, characterId, chapterNumber, genreId);
}

async function invalidateCache(projectId, characterId, fromChapter) {
    const allCache = await store.queryItems('character-state-cache', { projectId, characterId });
    for (const cache of allCache) {
        if (cache.chapterNumber >= fromChapter) {
            await store.deleteItem('character-state-cache', cache.id);
        }
    }
}

async function invalidateAllForProject(projectId) {
    const allCache = await store.queryItems('character-state-cache', { projectId });
    for (const cache of allCache) {
        await store.deleteItem('character-state-cache', cache.id);
    }
}

module.exports = { _computeAndCache, getCachedState, invalidateCache, invalidateAllForProject };
