const legacy = require('./_pipelineLegacy');
const { CHAPTER_STATUS, STUCK_STATUSES, validateStatusConsistency, getOutlineApiConfig } = require('./pipeline/constants');
const { runAgent } = require('./pipeline/agentRunner');
const fpModule = require('./pipeline/fullPipeline');

fpModule.setRunPipelineStepFn(legacy.runPipelineStep);

const fpModule2 = require('./pipeline/fullPipeline');

const subModules = {
    runAgent,
    getOutlineApiConfig,
    CHAPTER_STATUS,
    STUCK_STATUSES,
    validateStatusConsistency
};

module.exports = {
    getAgentPrompt: legacy.getAgentPrompt,
    runAgent: subModules.runAgent,
    runPipelineStep: legacy.runPipelineStep,
    runFullPipeline: fpModule.runFullPipeline,
    generateInitialMaterials: legacy.generateInitialMaterials,
    generateChapterOutlines: legacy.generateChapterOutlines,
    getAgentOutputPaths: legacy.getAgentOutputPaths,
    saveAgentOutput: legacy.saveAgentOutput,
    saveFinalContent: legacy.saveFinalContent,
    supplementChapterOutlines: legacy.supplementChapterOutlines,
    runInfinitePipeline: legacy.runInfinitePipeline,
    stopInfinitePipeline: legacy.stopInfinitePipeline,
    forceResetPipeline: legacy.forceResetPipeline,
    getInfinitePipelineStatus: legacy.getInfinitePipelineStatus,
    generateFromTemplate: legacy.generateFromTemplate,
    getVisibleMaterials: legacy.getVisibleMaterials,
    getVolumeOrder: legacy.getVolumeOrder,
    getVolumeSubplane: legacy.getVolumeSubplane,
    AGENT_PROMPTS: legacy.AGENT_PROMPTS,
    SHUANGWEN_AGENT_PROMPTS: legacy.SHUANGWEN_AGENT_PROMPTS,
    TOMATO_SHORT_AGENT_PROMPTS: legacy.TOMATO_SHORT_AGENT_PROMPTS
};
