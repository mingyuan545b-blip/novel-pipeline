const cleaners = require('./contentCleaners');
const detectors = require('./contentDetectors');
const metrics = require('./contentMetrics');

module.exports = {
    MAX_CHAPTER_WORDS: cleaners.MAX_CHAPTER_WORDS,
    TOMATO_SUBGENRE_CONFIGS: metrics.TOMATO_SUBGENRE_CONFIGS,
    getTomatoSubgenreConfig: metrics.getTomatoSubgenreConfig,
    deduplicateContent: cleaners.deduplicateContent,
    truncateChapter: cleaners.truncateChapter,
    cleanFinalContent: cleaners.cleanFinalContent,
    cleanChapterContent: cleaners.cleanChapterContent,
    ensureCliffhanger: cleaners.ensureCliffhanger,
    validateTomatoMetrics: metrics.validateTomatoMetrics,
    detectReversalDensity: metrics.detectReversalDensity,
    detectOpeningHook: metrics.detectOpeningHook,
    detectTellVerbs: detectors.detectTellVerbs,
    extractEndingTension: detectors.extractEndingTension,
    calcInfoDripScore: detectors.calcInfoDripScore,
    detectModernSlang: detectors.detectModernSlang,
    detectAdultPerspective: detectors.detectAdultPerspective,
    detectTechJargon: detectors.detectTechJargon,
    detectPipelineMetadataLeak: detectors.detectPipelineMetadataLeak,
    detectCrossChapterRepetition: detectors.detectCrossChapterRepetition,
    detectOnomatopoeiaDensity: detectors.detectOnomatopoeiaDensity,
    detectVisualAnchors: detectors.detectVisualAnchors,
    detectMotherChildDialogue: detectors.detectMotherChildDialogue,
    detectCombatDensity: detectors.detectCombatDensity,
    detectHumorPacing: detectors.detectHumorPacing,
    detectCowardBehavior: detectors.detectCowardBehavior,
    detectCharacterNameMismatch: detectors.detectCharacterNameMismatch,
    normalizeForDedup: cleaners.normalizeForDedup
};
