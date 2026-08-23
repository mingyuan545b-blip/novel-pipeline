const { detectGenre } = require('./genreConfig');
const { getDataContext } = require('./dataContext');

function getGenreConfig(projectIdOrStyleProfile) {
    if (typeof projectIdOrStyleProfile === 'string') {
        return getGenreConfigByProjectId(projectIdOrStyleProfile);
    }
    const genre = detectGenre(projectIdOrStyleProfile);
    return genre || null;
}

async function getGenreConfigAsync(projectId) {
    const store = require('../store');
    const _gccCtx = await getDataContext(projectId);
    const project = await _gccCtx.getProject();
    if (!project) return null;
    return getGenreConfig(project.styleProfile || {});
}

function getGenreConfigByProjectId(projectId) {
    try {
        const store = require('../store');
        const project = store.getItemSync ? store.getItemSync('projects', projectId) : null;
        if (!project) return null;
        return getGenreConfig(project.styleProfile || {});
    } catch (_) {
        return null;
    }
}

function getStateSchema(genreOrStyleProfile) {
    const genre = typeof genreOrStyleProfile === 'string'
        ? getGenreConfigByProjectId(genreOrStyleProfile)
        : getGenreConfig(genreOrStyleProfile);
    return genre?.stateSchema || null;
}

function getKvImportantKeys(genreOrStyleProfile) {
    const genre = typeof genreOrStyleProfile === 'string'
        ? getGenreConfigByProjectId(genreOrStyleProfile)
        : getGenreConfig(genreOrStyleProfile);
    return genre?.kvImportantKeys || [];
}

function getCharacterProfile(genreOrStyleProfile) {
    const genre = typeof genreOrStyleProfile === 'string'
        ? getGenreConfigByProjectId(genreOrStyleProfile)
        : getGenreConfig(genreOrStyleProfile);
    return genre?.characterProfile || null;
}

function getMilestones(genreOrStyleProfile) {
    const genre = typeof genreOrStyleProfile === 'string'
        ? getGenreConfigByProjectId(genreOrStyleProfile)
        : getGenreConfig(genreOrStyleProfile);
    return genre?.milestones || {};
}

function getPacingConfig(genreOrStyleProfile) {
    const genre = typeof genreOrStyleProfile === 'string'
        ? getGenreConfigByProjectId(genreOrStyleProfile)
        : getGenreConfig(genreOrStyleProfile);
    return genre?.pacingConfig || {};
}

function getMaterialRules(genreOrStyleProfile) {
    const genre = typeof genreOrStyleProfile === 'string'
        ? getGenreConfigByProjectId(genreOrStyleProfile)
        : getGenreConfig(genreOrStyleProfile);
    return genre?.materialRules || {};
}

function isDepthProfile(genreOrStyleProfile) {
    const genre = typeof genreOrStyleProfile === 'string'
        ? getGenreConfigByProjectId(genreOrStyleProfile)
        : getGenreConfig(genreOrStyleProfile);
    return !!(genre?.characterProfile?.supportingWriterPrinciples);
}

module.exports = {
    getGenreConfig,
    getGenreConfigAsync,
    getStateSchema,
    getKvImportantKeys,
    getCharacterProfile,
    getMilestones,
    getPacingConfig,
    getMaterialRules,
    isDepthProfile
};
