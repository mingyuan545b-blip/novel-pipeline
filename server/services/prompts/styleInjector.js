const { getStyleProfileByKey, getAllStyleProfiles, getStyleProfileForProject, detectGenreFromProject } = require('./styleProfileLoader');
const { buildStyleProfileInjection } = require('./styleProfileInjection');

async function buildStyleInjection(projectId) {
    const profile = await getStyleProfileForProject(projectId);
    if (!profile) return { prepend: '', append: '', logEntries: [] };

    const genre = detectGenreFromProject(null);
    return buildStyleProfileInjection(profile, 'writer', genre, projectId);
}

module.exports = {
    getStyleProfileByKey,
    getAllStyleProfiles,
    getStyleProfileForProject,
    buildStyleInjection,
    buildStyleProfileInjection
};
