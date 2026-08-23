const { BASE_CONSTRAINT_PRESETS, getConstraintPresets, buildConstraintInjection } = require('./constraintInjector');
const { getStyleProfileByKey, getAllStyleProfiles, getStyleProfileForProject, buildStyleInjection } = require('./styleInjector');
const { FALLBACK_FOUNDATION, FALLBACK_AGENT_TEMPLATES, getAgentTemplate, getFoundationPrompt, buildFoundationPrompt, deduplicateSystemPrompt, getAgentPrompt } = require('./promptBuilder');
const { NOVEL_DEFAULTS } = require('../../config/genreDefaults');
const { assembleAgentPrompt } = require('./agentPromptAssembler');
const { getJobTemplate, listJobTemplates } = require('./agentJobTemplates');
const { listSlotDefinitions, getSlotDefinition } = require('./agentSlotRegistry');
const { shouldApplyConstraint, isWritingAgent, isReviewAgent, getConstraintHeader } = require('./constraintScopes');
const { resolveMemoryPyramid } = require('./slotResolvers');

const AGENT_PROMPTS = {};
const CONSTRAINT_PRESETS = BASE_CONSTRAINT_PRESETS;

let _STYLE_PROFILES = null;
let _FOUNDATION_PROMPT = null;

module.exports = {
    AGENT_PROMPTS,
    CONSTRAINT_PRESETS,
    NOVEL_DEFAULT_CONSTRAINTS: NOVEL_DEFAULTS.defaultConstraints,
    get STYLE_PROFILES() { return _STYLE_PROFILES; },
    buildConstraintInjection,
    buildFoundationPrompt,
    buildStyleInjection,
    getStyleProfileForProject,
    get FOUNDATION_PROMPT() { return _FOUNDATION_PROMPT; },
    getAgentPrompt,
    getConstraintPresets,
    getAllStyleProfiles,
    getAgentTemplate,
    getFoundationPrompt: getFoundationPrompt,
    deduplicateSystemPrompt,
    assembleAgentPrompt,
    getJobTemplate,
    listJobTemplates,
    listSlotDefinitions,
    getSlotDefinition,
    shouldApplyConstraint,
    isWritingAgent,
    isReviewAgent,
    getConstraintHeader,
    resolveMemoryPyramid,
};
