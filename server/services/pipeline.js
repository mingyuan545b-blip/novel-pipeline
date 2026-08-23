/**
 * pipeline.js — Pipeline统一入口
 * 直接从子模块导入，无中间代理层
 */
const { CHAPTER_STATUS, STUCK_STATUSES, validateStatusConsistency, getOutlineApiConfig } = require('./pipeline/constants');
const { runAgent } = require('./pipeline/agentRunner');
const { runFullPipeline, setRunPipelineStepFn } = require('./pipeline/fullPipeline');
const { runPipelineStep } = require('./pipeline/pipelineStepRunner');
const { generateInitialMaterials, generateChapterOutlines, generateFromTemplate, supplementChapterOutlines } = require('./pipeline/outlineGenerator');
const { runInfinitePipeline, stopInfinitePipeline, forceResetPipeline, getInfinitePipelineStatus, setRunFullPipelineRef } = require('./pipeline/infinitePipeline');
const { getVisibleMaterials, getVolumeOrder, getVolumeSubplane } = require('./pipeline/volumeHelpers');
const { saveAgentOutput, saveFinalContent, getAgentOutputPaths } = require('./fileOutput');
const { getAgentPrompt, AGENT_PROMPTS } = require('./agentPrompts');

// ── 循环依赖解耦：注入步骤执行器和全流程函数 ──
setRunPipelineStepFn(runPipelineStep);
setRunFullPipelineRef(runFullPipeline);

module.exports = {
    getAgentPrompt,
    runAgent,
    runPipelineStep,
    runFullPipeline,
    generateInitialMaterials,
    generateChapterOutlines,
    getAgentOutputPaths,
    saveAgentOutput,
    saveFinalContent,
    supplementChapterOutlines,
    runInfinitePipeline,
    stopInfinitePipeline,
    forceResetPipeline,
    getInfinitePipelineStatus,
    generateFromTemplate,
    getVisibleMaterials,
    getVolumeOrder,
    getVolumeSubplane,
    AGENT_PROMPTS,
    // 常量透传
    CHAPTER_STATUS,
    STUCK_STATUSES,
    validateStatusConsistency,
    getOutlineApiConfig
};
