const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');

const genresDir = path.join(__dirname, 'genres');
const SKIP_ENTRIES = new Set(['baseGenreTemplate.js', 'genrePluginSpec.js']);

const GENRE_REGISTRY = [];
const genreMap = {};

for (const entry of fs.readdirSync(genresDir)) {
    const entryPath = path.join(genresDir, entry);
    const stat = fs.statSync(entryPath);

    if (stat.isDirectory()) {
        const indexPath = path.join(entryPath, 'index.js');
        if (fs.existsSync(indexPath)) {
            const genre = require(indexPath);
            if (genre && genre.id && typeof genre.isMatch === 'function') {
                GENRE_REGISTRY.push(genre);
                genreMap[genre.id] = genre;
            }
        }
        continue;
    }

    if (!entry.endsWith('.js') || SKIP_ENTRIES.has(entry) || entry.startsWith('_')) continue;
    const genreId = entry.replace('.js', '');
    if (fs.existsSync(path.join(genresDir, genreId))) continue;
    const genre = require(entryPath);
    if (genre && genre.id && typeof genre.isMatch === 'function') {
        GENRE_REGISTRY.push(genre);
        genreMap[genre.id] = genre;
    }
}

function detectGenre(styleProfile) {
    if (!styleProfile) return null;
    const key = (styleProfile?.key || styleProfile?.genreProfile || styleProfile?.genre || styleProfile?._genreId || '').toLowerCase();
    if (key) {
        const exactMatch = GENRE_REGISTRY.find(g => g.id === key);
        if (exactMatch) return exactMatch;
    }
    const label = (styleProfile?.label || styleProfile?.genre || '').toLowerCase();
    if (label) {
        for (const genre of GENRE_REGISTRY) {
            if (genre.genreProfileIds && genre.genreProfileIds.some(id => id === label)) return genre;
        }
        let bestMatch = null;
        let bestMatchLength = 0;
        for (const genre of GENRE_REGISTRY) {
            if (genre.genreProfileIds) {
                for (const id of genre.genreProfileIds) {
                    if (label.includes(id) || id.includes(label)) {
                        if (id.length > bestMatchLength) { bestMatch = genre; bestMatchLength = id.length; }
                    }
                }
            }
        }
        if (bestMatch) return bestMatch;
    }
    for (const genre of GENRE_REGISTRY) {
        if (genre.isMatch(styleProfile)) return genre;
    }
    return null;
}

function getGenreById(genreId) {
    return GENRE_REGISTRY.find(g => g.id === genreId) || null;
}

function resolveGenreFromProject(project) {
    if (!project) return null;
    const subGenre = project.subGenre || project.subgenre || '';
    if (subGenre) {
        const byId = getGenreById(subGenre);
        if (byId) return byId;
    }
    if (project.styleProfile) {
        const fromStyle = detectGenre(project.styleProfile);
        if (fromStyle) return fromStyle;
    }
    if (project.genre) {
        return getGenreById(project.genre) || detectGenre({ genre: project.genre });
    }
    return null;
}

function getGenrePlugin(styleProfile) {
    const genre = detectGenre(styleProfile);
    if (!genre) return null;
    try {
        const rulesLoader = require('./rulesLoader');
        const dataRules = rulesLoader.getGenreRules(genre.id);
        if (dataRules) {
            return new Proxy(genre, {
                get(target, prop) {
                    if (prop === 'reviewRules' && dataRules.reviewRules) return dataRules.reviewRules;
                    if (prop === 'foundation' && dataRules.foundation) return { ...target.foundation || {}, ...dataRules.foundation };
                    if (prop === 'constraintPresets' && dataRules.constraintPresets) return { ...target.constraintPresets || {}, ...dataRules.constraintPresets };
                    if (prop === 'dedupRules' && dataRules.dedupRules) return dataRules.dedupRules;
                    if (prop === 'materialTemplates' && dataRules.materialTemplates) return dataRules.materialTemplates;
                    if (prop === 'newContentValidation' && dataRules.newContentValidation) return { ...target.newContentValidation || {}, ...dataRules.newContentValidation };
                    return target[prop];
                }
            });
        }
    } catch(_) { logger.warn('genreConfig', _.message || _); }
    return genre;
}

module.exports = { GENRE_REGISTRY, genreMap, detectGenre, getGenreById, resolveGenreFromProject, getGenrePlugin };
