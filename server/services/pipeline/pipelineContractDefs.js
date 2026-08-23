const logger = require('../../shared/logger');

const PIPELINE_CONTRACT = {
    VERSION: '3.0',
    STEP_ORDER: ['outline-generator', 'writer', 'first-review', 'fast-review', 'second-review', 'final-editor', 'polisher', 'material-manager', 'consistency-constraint'],
    TERMINAL_STATUSES: ['approved', 'cooldown-waiting', 'cancelled'],
    REVIEW_STATUSES: ['first-review', 'fast-review', 'second-review', 'final-editor'],
    WRITING_STATUSES: ['outlined', 'drafted', 'written'],
    REQUIRED_OUTPUT_FIELDS: {
        'outline-generator': ['outlines'],
        'writer': ['content', 'wordCount'],
        'first-review': ['passed', 'issues'],
        'fast-review': ['passed', 'issues'],
        'second-review': ['passed', 'issues'],
        'final-editor': ['content', 'wordCount'],
        'polisher': ['content'],
        'material-manager': ['operations'],
        'consistency-constraint': ['constraints']
    },
    MAX_WORD_COUNT: 3500,
    MIN_WORD_COUNT: 1500,
    MAX_RETRIES: 3
};

function validateStepOutput(stepId, output) {
    if (!output) return { valid: false, errors: ['No output provided'] };
    const requiredFields = PIPELINE_CONTRACT.REQUIRED_OUTPUT_FIELDS[stepId];
    if (!requiredFields) return { valid: true, errors: [] };
    const errors = [];
    for (const field of requiredFields) {
        if (output[field] === undefined || output[field] === null) errors.push(`Missing required field: ${field}`);
    }
    return { valid: errors.length === 0, errors };
}

function isTerminalStatus(status) {
    return PIPELINE_CONTRACT.TERMINAL_STATUSES.includes(status);
}

function isReviewStep(stepId) {
    return PIPELINE_CONTRACT.REVIEW_STATUSES.includes(stepId);
}

function getNextStep(currentStep) {
    const order = PIPELINE_CONTRACT.STEP_ORDER;
    const idx = order.indexOf(currentStep);
    if (idx < 0 || idx >= order.length - 1) return null;
    return order[idx + 1];
}

module.exports = { PIPELINE_CONTRACT, validateStepOutput, isTerminalStatus, isReviewStep, getNextStep };
