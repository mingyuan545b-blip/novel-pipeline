const store = require('../../store');
const llm = require('../../services/llm');
const memory = require('../../services/memory');
const stateSnapshot = require('../../services/stateSnapshot');
const consistency = require('../../services/consistency');
const { AGENT_PROMPTS, SHUANGWEN_AGENT_PROMPTS, TOMATO_SHORT_AGENT_PROMPTS, CONSTRAINT_PRESETS, buildConstraintInjection, buildFoundationPrompt, buildStyleInjection, getStyleProfileForProject, getAgentPrompt, deduplicateSystemPrompt } = require('../agentPrompts');
const { MAX_CHAPTER_WORDS, MODE_CONFIGS, getModeConfig, deduplicateContent, truncateChapter, cleanFinalContent, cleanChapterContent, ensureCliffhanger, validateTomatoMetrics, detectTellVerbs, extractEndingTension, calcInfoDripScore, detectModernSlang, detectAdultPerspective, detectTechJargon, detectPipelineMetadataLeak, detectCrossChapterRepetition, detectOnomatopoeiaDensity, detectVisualAnchors, detectMotherChildDialogue } = require('../contentUtils');
const { extractJSON } = require('../jsonUtils');
const { detectGenre, runGenreFirstReviewIntercept, runGenreSecondReviewIntercept, getGenreWriterInjection, getGenreReviewRules, getGenrePerspectiveSchema } = require('../genreConfig');
const llmConfig = require('../llmConfig');
const { OUTPUT_DIR, AGENT_ROLE_NAMES, ensureOutputDir, getChapterFileName, saveAgentOutput, saveFinalContent, getAgentOutputPaths } = require('../fileOutput');
const { ContextBudget, estimateTokens, truncateToTokens, COMPACT_PRIORITIES, LONG_PRIORITIES, ULTRA_LONG_PRIORITIES } = require('../contextBudget');
const trendingSearch = require('../trendingSearch');
const reviewRemediation = require('../reviewRemediation');
const materialIndex = require('../materialIndex');
const { validateMaterial, getMaterialValidationPrompt } = require('../materialValidator');
const { getCircuitBreaker } = require('../reviewCircuitBreaker');
const { createVersionTag } = require('../versionControl');
const { getMetrics } = require('../metricsCollector');
const { PIPELINE_CONFIG, getModePipelineConfig } = require('../pipelineConfig');
const techIndex = require('../techIndex');
const { ValidationEngine } = require('../validationEngine');
const { getBeatAllocator } = require('../beatAllocator');
const { getHookBudgetForProject } = require('../hookBudget');
const { getRuleStackForProject } = require('../ruleStack');
const { getContextTraceForProject } = require('../contextTrace');
const { getChapterIntentPlanner } = require('../chapterIntent');
const { scanContent: scanSensitiveWords } = require('../sensitiveWordGuard');
const promptAuditor = require('../promptAuditor');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const imageGen = require('../../services/imageGen');

module.exports = {
    store,
    llm,
    memory,
    stateSnapshot,
    consistency,
    AGENT_PROMPTS,
    SHUANGWEN_AGENT_PROMPTS,
    TOMATO_SHORT_AGENT_PROMPTS,
    CONSTRAINT_PRESETS,
    buildConstraintInjection,
    buildFoundationPrompt,
    buildStyleInjection,
    getStyleProfileForProject,
    getAgentPrompt,
    deduplicateSystemPrompt,
    MAX_CHAPTER_WORDS,
    MODE_CONFIGS,
    getModeConfig,
    deduplicateContent,
    truncateChapter,
    cleanFinalContent,
    cleanChapterContent,
    ensureCliffhanger,
    validateTomatoMetrics,
    detectTellVerbs,
    extractEndingTension,
    calcInfoDripScore,
    detectModernSlang,
    detectAdultPerspective,
    detectTechJargon,
    detectPipelineMetadataLeak,
    detectCrossChapterRepetition,
    detectOnomatopoeiaDensity,
    detectVisualAnchors,
    detectMotherChildDialogue,
    extractJSON,
    detectGenre,
    runGenreFirstReviewIntercept,
    runGenreSecondReviewIntercept,
    getGenreWriterInjection,
    getGenreReviewRules,
    getGenrePerspectiveSchema,
    llmConfig,
    OUTPUT_DIR,
    AGENT_ROLE_NAMES,
    ensureOutputDir,
    getChapterFileName,
    saveAgentOutput,
    saveFinalContent,
    getAgentOutputPaths,
    ContextBudget,
    estimateTokens,
    truncateToTokens,
    COMPACT_PRIORITIES,
    LONG_PRIORITIES,
    ULTRA_LONG_PRIORITIES,
    trendingSearch,
    reviewRemediation,
    materialIndex,
    validateMaterial,
    getMaterialValidationPrompt,
    getCircuitBreaker,
    createVersionTag,
    getMetrics,
    PIPELINE_CONFIG,
    getModePipelineConfig,
    techIndex,
    ValidationEngine,
    getBeatAllocator,
    getHookBudgetForProject,
    getRuleStackForProject,
    getContextTraceForProject,
    getChapterIntentPlanner,
    scanSensitiveWords,
    promptAuditor,
    uuidv4,
    fs,
    path,
    imageGen
};
