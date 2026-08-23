const store = require('../../store');
const logger = require('../../shared/logger');

async function getStyleProfileByKey(key) {
    try {
        const profiles = await store.listItems('style-profiles');
        const found = profiles.find(p => p.key === key);
        if (found) return found;
    } catch(_) { logger.warn('styleInjector', '[SILENT-CATCH]', { value1: _.message || _ }); }
    return null;
}

async function getAllStyleProfiles() {
    try {
        const profiles = await store.listItems('style-profiles');
        if (profiles && profiles.length > 0) {
            const map = {};
            for (const p of profiles) { map[p.key] = p; }
            return map;
        }
    } catch(_) { logger.warn('styleInjector', '[SILENT-CATCH]', { value1: _.message || _ }); }
    return null;
}

async function getStyleProfileForProject(projectId) {
    const { getDataContext } = require('../dataContext');
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    if (!project) return null;

    const key = project.styleProfileKey || project.genre || project.template?.style || '';
    if (!key) return null;

    const profile = await getStyleProfileByKey(key);
    if (profile) return profile;

    const { resolveGenreFromProject } = require('../genreConfig');
    const genre = resolveGenreFromProject(project);
    if (genre?.styleProfile) {
        return { key: genre.id, label: genre.label, ...genre.styleProfile };
    }

    return null;
}

function detectGenreFromProject(project) {
    const { resolveGenreFromProject } = require('../genreConfig');
    return resolveGenreFromProject(project);
}

module.exports = {
    getStyleProfileByKey,
    getAllStyleProfiles,
    getStyleProfileForProject,
    detectGenreFromProject
};
