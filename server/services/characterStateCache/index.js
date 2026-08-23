const logger = require('../../shared/logger');
const store = require('../../store');
const { getCachedState, invalidateCache, invalidateAllForProject } = require('./stateCacheCompute');
const { resolveGenreFromProject } = require('../../services/genreConfig');

async function getState(projectId, characterId, chapterNumber) {
    return getCachedState(projectId, characterId, chapterNumber);
}

async function getStatesForChapter(projectId, chapterNumber) {
    const entities = await store.queryItems('entity-registry', { projectId, entityType: 'character' });
    const states = {};
    for (const entity of entities) {
        if (!entity.isActive) continue;
        const state = await getCachedState(projectId, entity.id, chapterNumber);
        if (state && Object.keys(state).length > 0) {
            states[entity.id] = { name: entity.name, ...state };
        }
    }
    return states;
}

async function updateCacheAfterStateChange(projectId, characterId, chapterNumber) {
    await invalidateCache(projectId, characterId, chapterNumber);
    return getCachedState(projectId, characterId, chapterNumber);
}

async function getDiff(projectId, characterId, fromChapter, toChapter) {
    const fromState = await getCachedState(projectId, characterId, fromChapter);
    const toState = await getCachedState(projectId, characterId, toChapter);
    const diff = {};
    for (const key of Object.keys(toState)) {
        if (key === '_lastStateId' || key === 'stateChangedFields') continue;
        if (JSON.stringify(fromState[key]) !== JSON.stringify(toState[key])) {
            diff[key] = { from: fromState[key], to: toState[key] };
        }
    }
    return diff;
}

const _sessions = new Map();

function startSession(projectId, chapterNumber) {
    _sessions.set(`${projectId}:${chapterNumber}`, { startedAt: Date.now() });
}

function endSession(projectId, chapterNumber) {
    _sessions.delete(`${projectId}:${chapterNumber}`);
}

async function commitSession(projectId, chapterNumber) {
    const key = `${projectId}:${chapterNumber}`;
    if (_sessions.has(key)) {
        await invalidateAllForProject(projectId);
        _sessions.delete(key);
    }
}

async function invalidateForProject(projectId) {
    return invalidateAllForProject(projectId);
}

async function getCacheForChapter(projectId, chapterNumber) {
    return getStatesForChapter(projectId, chapterNumber);
}

module.exports = {
    getState, getStatesForChapter, updateCacheAfterStateChange,
    getDiff, getCachedState, invalidateCache, invalidateAllForProject,
    startSession, endSession, commitSession, invalidateForProject, getCacheForChapter
};
