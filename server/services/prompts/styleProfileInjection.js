const logger = require('../../shared/logger');
const store = require('../../store');
const { buildHierarchyInjection, buildStyleInjection } = require('./styleHierarchy');
const { resolveGenreFromProject } = require('../genreConfig');
const { getStyleProfileForProject } = require('./styleProfileLoader');

async function buildStyleProfileInjection(localProfile, agentType, genre, projectId) {
    const result = { prepend: '', append: '', logEntries: [] };
    if (!localProfile) {
        if (projectId) {
            localProfile = await getStyleProfileForProject(projectId);
        }
        if (!localProfile) return result;
    }
    if (!genre && projectId) {
        const project = await store.getItem('projects', projectId);
        genre = resolveGenreFromProject(project);
    }
    const injection = buildStyleInjection(localProfile, genre);
    if (injection) {
        result.append = '\n\n' + injection;
        result.logEntries.push({ step: 'styleProfile', chars: injection.length });
    }
    return result;
}

async function buildConstraintInjection(projectId, agentId) {
    const styleProfile = await getStyleProfileForProject(projectId);
    if (!styleProfile) return '';
    const project = await store.getItem('projects', projectId);
    const genre = resolveGenreFromProject(project);
    return buildHierarchyInjection(styleProfile, genre);
}

module.exports = {
    getStyleProfileForProject, buildStyleProfileInjection,
    buildConstraintInjection, buildHierarchyInjection, buildStyleInjection
};
