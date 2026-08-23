const store = require('../../../../store');
const { cleanChapterContent, deduplicateContent, truncateChapter, validateTomatoMetrics, ensureCliffhanger, detectReversalDensity, detectCowardBehavior } = require('../../../contentUtils');
const { resolveConfig } = require('../../../../config');
const { getVolumeSubplane } = require('../../volumeHelpers');
const { detectGenre, resolveGenreFromProject } = require('../../../genreConfig');
const { resolve } = require('../../../../config/promptFragments');
const { getDataContext } = require('../../../dataContext');
const itemDefinition = require('../../../itemDefinition');
const { getStyleProfileForProject } = require('../../../agentPrompts');
const materialIndex = require('../../../materialIndex');
const reviewRemediation = require('../../../reviewRemediation');
const trendingSearch = require('../../../trendingSearch');

module.exports = {
    store, cleanChapterContent, deduplicateContent, truncateChapter,
    validateTomatoMetrics, ensureCliffhanger, detectReversalDensity, detectCowardBehavior,
    resolveConfig, getVolumeSubplane, detectGenre, resolveGenreFromProject, resolve, getDataContext,
    itemDefinition, getStyleProfileForProject, materialIndex, reviewRemediation, trendingSearch
};
