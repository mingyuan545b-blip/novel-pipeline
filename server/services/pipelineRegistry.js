const _stepFn = {};
const _pipelineFn = {};

function registerStepFn(fn) {
    _stepFn.value = fn;
}

function getStepFn() {
    if (typeof _stepFn.value === 'function') return _stepFn.value;
    try {
        const m = require('./_pipelineLegacy');
        if (typeof m.runPipelineStep === 'function') {
            _stepFn.value = m.runPipelineStep;
            return _stepFn.value;
        }
    } catch (e) {
        console.error('[pipelineRegistry] Failed to require _pipelineLegacy:', e.message);
    }
    throw new Error('runPipelineStep is not available');
}

function registerPipelineFn(fn) {
    _pipelineFn.value = fn;
}

function getPipelineFn() {
    if (typeof _pipelineFn.value === 'function') return _pipelineFn.value;
    try {
        const m = require('./pipeline/fullPipeline');
        if (typeof m.runFullPipeline === 'function') {
            _pipelineFn.value = m.runFullPipeline;
            return _pipelineFn.value;
        }
    } catch (e) {
        console.error('[pipelineRegistry] Failed to require fullPipeline:', e.message);
    }
    throw new Error('runFullPipeline is not available');
}

module.exports = { registerStepFn, getStepFn, registerPipelineFn, getPipelineFn };
