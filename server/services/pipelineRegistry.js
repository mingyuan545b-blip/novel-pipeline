const logger = require('../shared/logger');

const _stepFn = {};
const _pipelineFn = {};
const STEP_REGISTRY = new Map();

function registerStepFn(fn) {
    _stepFn.value = fn;
}

function getStepFn() {
    if (typeof _stepFn.value === 'function') return _stepFn.value;
    try {
        const m = require('./pipeline');
        if (typeof m.runPipelineStep === 'function') {
            _stepFn.value = m.runPipelineStep;
            return _stepFn.value;
        }
    } catch (e) {
        logger.error('pipelineRegistry', 'Failed to require pipeline:', e.message);
    }
    throw new Error('runPipelineStep is not available');
}

function registerPipelineFn(fn) {
    _pipelineFn.value = fn;
}

function getPipelineFn() {
    if (typeof _pipelineFn.value === 'function') return _pipelineFn.value;
    try {
        const m = require('./pipeline');
        if (typeof m.runFullPipeline === 'function') {
            _pipelineFn.value = m.runFullPipeline;
            return _pipelineFn.value;
        }
    } catch (e) {
        logger.error('pipelineRegistry', 'Failed to require fullPipeline:', e.message);
    }
    throw new Error('runFullPipeline is not available');
}

function registerStep(stepId, stepConfig) {
    if (!stepId || typeof stepId !== 'string') throw new Error('stepId must be a non-empty string');
    const config = {
        id: stepId,
        label: stepConfig.label || stepId,
        description: stepConfig.description || '',
        category: stepConfig.category || 'core',
        dependencies: stepConfig.dependencies || [],
        optional: stepConfig.optional || false,
        maxRetries: stepConfig.maxRetries || 3,
        timeout: stepConfig.timeout || 600000,
        handler: stepConfig.handler || null,
        registeredAt: new Date().toISOString()
    };
    STEP_REGISTRY.set(stepId, config);
    logger.info('pipelineRegistry', `Registered step: ${stepId} (${config.category})`);
}

function getStep(stepId) {
    return STEP_REGISTRY.get(stepId) || null;
}

function getStepsByCategory(category) {
    const steps = [];
    for (const [, config] of STEP_REGISTRY) {
        if (config.category === category) steps.push(config);
    }
    return steps;
}

function getAllSteps() {
    return Array.from(STEP_REGISTRY.values());
}

function unregisterStep(stepId) {
    const removed = STEP_REGISTRY.delete(stepId);
    if (removed) logger.info('pipelineRegistry', `Unregistered step: ${stepId}`);
    return removed;
}

function resolveStepOrder(stepIds) {
    const resolved = [];
    const visited = new Set();
    const visiting = new Set();

    function visit(id) {
        if (visited.has(id)) return;
        if (visiting.has(id)) throw new Error(`Circular dependency detected: ${id}`);
        visiting.add(id);
        const step = STEP_REGISTRY.get(id);
        if (step) {
            for (const dep of step.dependencies) visit(dep);
        }
        visiting.delete(id);
        visited.add(id);
        resolved.push(id);
    }

    for (const id of stepIds) visit(id);
    return resolved;
}

function validateStepConfig(stepId, stepConfig) {
    const errors = [];
    if (!stepId) errors.push('stepId is required');
    if (stepConfig.handler && typeof stepConfig.handler !== 'function') errors.push('handler must be a function');
    if (stepConfig.dependencies && !Array.isArray(stepConfig.dependencies)) errors.push('dependencies must be an array');
    return { valid: errors.length === 0, errors };
}

module.exports = {
    registerStepFn, getStepFn, registerPipelineFn, getPipelineFn,
    registerStep, getStep, getStepsByCategory, getAllSteps,
    unregisterStep, resolveStepOrder, validateStepConfig
};
