const { detectGenre, GENRE_REGISTRY } = require('./genreDetection');

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
        if (genre.constraintPresets) Object.assign(all, genre.constraintPresets);
    }
    return all;
}

function getAllGenreDedupRules() {
    const all = [];
    for (const genre of GENRE_REGISTRY) {
        if (genre.dedupRules && genre.dedupRules.length > 0) all.push(...genre.dedupRules);
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
    if (!genre || !genre.detectors || !genre.detectors.modernSlang) return { count: 0, instances: [] };
    return genre.detectors.modernSlang(content, styleProfile);
}

function getGenrePerspectiveResult(content, styleProfile) {
    const genre = detectGenre(styleProfile);
    if (!genre || !genre.detectors || !genre.detectors.perspective) return { isViolation: false, issues: [], hasCriticalIssue: false };
    return genre.detectors.perspective(content, styleProfile);
}

function getGenreTerminologyResult(content, styleProfile) {
    const genre = detectGenre(styleProfile);
    if (!genre || !genre.detectors || !genre.detectors.terminology) return { count: 0, instances: [], violationCount: 0 };
    return genre.detectors.terminology(content, styleProfile);
}

function getGenreQualityResults(content, styleProfile) {
    const genre = detectGenre(styleProfile);
    if (!genre || !genre.detectors) return { onomatopoeia: null, visualAnchors: null, motherChildDialogue: null };
    const results = {};
    if (genre.qualityChecks?.onomatopoeia?.enabled && genre.detectors.onomatopoeia) results.onomatopoeia = genre.detectors.onomatopoeia(content, styleProfile);
    if (genre.qualityChecks?.visualAnchors?.enabled && genre.detectors.visualAnchors) results.visualAnchors = genre.detectors.visualAnchors(content, styleProfile);
    if (genre.qualityChecks?.motherChildDialogue?.enabled && genre.detectors.motherChildDialogue) results.motherChildDialogue = genre.detectors.motherChildDialogue(content, styleProfile);
    return results;
}

function getGenrePerspectiveSchema(genre) {
    if (!genre || !genre.perspectiveSchema) {
        return { fields: '"perspective":"protagonist/narrator/other"', label: '视角：protagonist/narrator/other', values: ['protagonist', 'narrator', 'other'] };
    }
    return genre.perspectiveSchema;
}

module.exports = {
    getGenreDetectors, getGenreInterceptors, getGenreConstraintPresets,
    getGenreDedupRules, getGenreReviewRules, getAllGenreConstraintPresets,
    getAllGenreDedupRules, runGenreFirstReviewIntercept, runGenreSecondReviewIntercept,
    getGenreWriterInjection, getGenreModernSlangResult, getGenrePerspectiveResult,
    getGenreTerminologyResult, getGenreQualityResults, getGenrePerspectiveSchema
};
