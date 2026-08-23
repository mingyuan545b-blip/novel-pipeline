const { runInfinitePipeline, stopInfinitePipeline, setRunPipelineStepFn } = require("./batchExecutor");
const { setRunFullPipelineRef, setRunPipelineStepRef: execSetStepRef } = require("./chapterExecutor");
const { getInfinitePipelineStatus, forceResetPipeline, cleanupStalePipelineStates } = require("./stateManager");

function setRunPipelineStepRef(fn) {
    setRunPipelineStepFn(fn);
    execSetStepRef(fn);
}

module.exports = {
    runInfinitePipeline,
    stopInfinitePipeline,
    forceResetPipeline,
    getInfinitePipelineStatus,
    setRunFullPipelineRef,
    setRunPipelineStepRef,
    cleanupStalePipelineStates
};
