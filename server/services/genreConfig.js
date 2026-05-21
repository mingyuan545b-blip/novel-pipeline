const fs = require('fs');
const path = require('path');

const genresDir = path.join(__dirname, 'genres');
const genreFiles = fs.readdirSync(genresDir).filter(f => f.endsWith('.js'));

const GENRE_REGISTRY = [];
const genreMap = {};

for (const file of genreFiles) {
    const genre = require(path.join(genresDir, file));
    GENRE_REGISTRY.push(genre);
    if (genre.id) genreMap[genre.id] = genre;
}

const BABY_GENRE = genreMap['baby'] || null;
const URBAN_FANTASY_GENRE = genreMap['urban-fantasy'] || null;
const RULE_HORROR_GENRE = genreMap['rule-horror'] || null;
const INFINITE_DUNGEON_GENRE = genreMap['infinite-dungeon'] || null;

function detectGenre(styleProfile) {
    if (!styleProfile) return null;
    const key = (styleProfile?.key || '').toLowerCase();
    const exactMatch = GENRE_REGISTRY.find(g => g.id === key);
    if (exactMatch) return exactMatch;
    for (const genre of GENRE_REGISTRY) {
        if (genre.isMatch(styleProfile)) return genre;
    }
    return null;
}

function getGenreById(genreId) {
    return GENRE_REGISTRY.find(g => g.id === genreId) || null;
}

function getRegisteredGenres() {
    return [...GENRE_REGISTRY];
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
                    if (prop === 'foundation' && dataRules.foundation) {
                        return { ...target.foundation || {}, ...dataRules.foundation };
                    }
                    if (prop === 'constraintPresets' && dataRules.constraintPresets) {
                        return { ...target.constraintPresets || {}, ...dataRules.constraintPresets };
                    }
                    if (prop === 'dedupRules' && dataRules.dedupRules) return dataRules.dedupRules;
                    if (prop === 'materialTemplates' && dataRules.materialTemplates) return dataRules.materialTemplates;
                    if (prop === 'newContentValidation' && dataRules.newContentValidation) {
                        return { ...target.newContentValidation || {}, ...dataRules.newContentValidation };
                    }
                    return target[prop];
                }
            });
        }
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    return genre;
}

function validateNewMaterial(material, styleProfile, existingMaterials) {
    const genre = detectGenre(styleProfile);
    if (!genre?.newContentValidation?.onMaterialCreate) return { errors: [], warnings: [] };
    return genre.newContentValidation.onMaterialCreate.call(genre, material, existingMaterials);
}

function validateChapterContent(content, styleProfile) {
    const genre = detectGenre(styleProfile);
    if (!genre?.newContentValidation?.onChapterContent) return { errors: [], warnings: [] };
    return genre.newContentValidation.onChapterContent.call(genre, content);
}

function isBabyGenre(styleProfile) {
    const genre = detectGenre(styleProfile);
    return genre?.id === 'baby';
}

function getGenreDetectors(genre) {
    if (!genre || !genre.detectors) return null;
    return genre.detectors;
}

function getGenreInterceptors(genre) {
    if (!genre || !genre.interceptors) return null;
    return genre.interceptors;
}

function getGenreConstraintPresets(genre) {
    if (!genre || !genre.constraintPresets) return {};
    return genre.constraintPresets;
}

function getGenreDedupRules(genre) {
    if (!genre || !genre.dedupRules) return [];
    return genre.dedupRules;
}

function getGenreReviewRules(genre) {
    if (!genre || !genre.reviewRules) return null;
    return genre.reviewRules;
}

function getAllGenreConstraintPresets() {
    const all = {};
    for (const genre of GENRE_REGISTRY) {
        if (genre.constraintPresets) {
            Object.assign(all, genre.constraintPresets);
        }
    }
    return all;
}

function getAllGenreDedupRules() {
    const all = [];
    for (const genre of GENRE_REGISTRY) {
        if (genre.dedupRules && genre.dedupRules.length > 0) {
            all.push(...genre.dedupRules);
        }
    }
    return all;
}

function runGenreFirstReviewIntercept(content, styleProfile, chapterOutline) {
    const genre = detectGenre(styleProfile);
    if (!genre || !genre.interceptors || !genre.interceptors.firstReview) {
        return { hardBlockIssues: [], warningIssues: [], hints: [] };
    }
    return genre.interceptors.firstReview.call(genre, content, styleProfile, { outline: chapterOutline });
}

function runGenreSecondReviewIntercept(content, styleProfile, chapterOutline) {
    const genre = detectGenre(styleProfile);
    if (!genre || !genre.interceptors || !genre.interceptors.secondReview) {
        return { hardBlockIssues: [], warningIssues: [], hints: [] };
    }
    return genre.interceptors.secondReview.call(genre, content, styleProfile, { outline: chapterOutline });
}

function getGenreWriterInjection(genre) {
    if (!genre || !genre.writerHints) return '';
    return genre.writerHints.terminologyDimming || '';
}

function getGenreModernSlangResult(content, styleProfile) {
    const genre = detectGenre(styleProfile);
    if (!genre || !genre.detectors || !genre.detectors.modernSlang) {
        return { count: 0, instances: [] };
    }
    return genre.detectors.modernSlang(content, styleProfile);
}

function getGenrePerspectiveResult(content, styleProfile) {
    const genre = detectGenre(styleProfile);
    if (!genre || !genre.detectors || !genre.detectors.perspective) {
        return { isViolation: false, issues: [], hasCriticalIssue: false };
    }
    return genre.detectors.perspective(content, styleProfile);
}

function getGenreTerminologyResult(content, styleProfile) {
    const genre = detectGenre(styleProfile);
    if (!genre || !genre.detectors || !genre.detectors.terminology) {
        return { count: 0, instances: [], violationCount: 0 };
    }
    return genre.detectors.terminology(content, styleProfile);
}

function getGenreQualityResults(content, styleProfile) {
    const genre = detectGenre(styleProfile);
    if (!genre || !genre.detectors) {
        return { onomatopoeia: null, visualAnchors: null, motherChildDialogue: null };
    }
    const results = {};
    if (genre.qualityChecks?.onomatopoeia?.enabled && genre.detectors.onomatopoeia) {
        results.onomatopoeia = genre.detectors.onomatopoeia(content, styleProfile);
    }
    if (genre.qualityChecks?.visualAnchors?.enabled && genre.detectors.visualAnchors) {
        results.visualAnchors = genre.detectors.visualAnchors(content, styleProfile);
    }
    if (genre.qualityChecks?.motherChildDialogue?.enabled && genre.detectors.motherChildDialogue) {
        results.motherChildDialogue = genre.detectors.motherChildDialogue(content, styleProfile);
    }
    return results;
}

function getGenrePerspectiveSchema(genre) {
    if (!genre || !genre.perspectiveSchema) {
        return {
            fields: '"perspective":"protagonist/narrator/other"',
            label: '视角：protagonist/narrator/other',
            values: ['protagonist', 'narrator', 'other']
        };
    }
    return genre.perspectiveSchema;
}

module.exports = {
    BABY_GENRE,
    URBAN_FANTASY_GENRE,
    RULE_HORROR_GENRE,
    INFINITE_DUNGEON_GENRE,
    GENRE_REGISTRY,
    detectGenre,
    getGenreById,
    getRegisteredGenres,
    getGenrePlugin,
    validateNewMaterial,
    validateChapterContent,
    isBabyGenre,
    getGenreDetectors,
    getGenreInterceptors,
    getGenreConstraintPresets,
    getGenreDedupRules,
    getGenreReviewRules,
    getAllGenreConstraintPresets,
    getAllGenreDedupRules,
    runGenreFirstReviewIntercept,
    runGenreSecondReviewIntercept,
    getGenreWriterInjection,
    getGenreModernSlangResult,
    getGenrePerspectiveResult,
    getGenreTerminologyResult,
    getGenreQualityResults,
    getGenrePerspectiveSchema
};

