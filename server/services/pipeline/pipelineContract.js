/**
 * pipelineContract.js — Pipeline契约系统（YAML驱动版）
 *
 * 阶段3迁移：STEP_CONTRACTS硬编码已删除，getStepContract/getContractSummary
 * 从YAML契约生成兼容格式（见contractCompat.js）
 *
 * 保留：PIPELINE_CONTRACT常量 + validateStepOutput + enforceContract + 数据流校验
 */
const logger = require('../../shared/logger');
const store = require('../../store');
const { ContractViolationError } = require('../../shared/errors');
const { getStepContract, getContractSummary } = require('./contractCompat');

// ── 契约常量 ──
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

async function enforceContract(projectId, stepId, output) {
    const validation = validateStepOutput(stepId, output);
    if (!validation.valid) {
        logger.error('pipelineContract', `Contract violation for step ${stepId}`, {
            errorCode: 'PIPELINE_CONTRACT_VIOLATION',
            projectId,
            stepId,
            violations: validation.errors
        });
        throw new ContractViolationError(
            `Step ${stepId} output failed contract validation: ${validation.errors.join(', ')}`,
            validation.errors
        );
    }
    return { passed: true, errors: [] };
}

async function checkDataFlowIntegrity(projectId, fromStep, toStep) {
    const { DATA_FLOW_SPEC } = require('./dataFlowSpec');
    const fromSpec = DATA_FLOW_SPEC[fromStep];
    const toSpec = DATA_FLOW_SPEC[toStep];
    if (!fromSpec || !toSpec) return { valid: true, warnings: [] };

    const warnings = [];
    if (fromSpec.outputs && toSpec.inputs) {
        for (const input of toSpec.inputs) {
            if (!fromSpec.outputs.includes(input) && !fromSpec.optionalOutputs?.includes(input)) {
                warnings.push(`Step ${toStep} expects input "${input}" not provided by ${fromStep}`);
            }
        }
    }
    return { valid: warnings.length === 0, warnings };
}

async function validatePipelineState(projectId) {
    const chapters = await store.queryItems('chapters', { projectId });
    const issues = [];
    for (const ch of chapters) {
        if (ch.status && isTerminalStatus(ch.status)) continue;
        if (!ch.outline && ch.chapterNumber > 0) issues.push(`Ch${ch.chapterNumber}: missing outline`);
        if (ch.content && !ch.wordCount) issues.push(`Ch${ch.chapterNumber}: has content but no wordCount`);
    }
    return { valid: issues.length === 0, issues };
}

module.exports = {
    PIPELINE_CONTRACT, validateStepOutput, isTerminalStatus, isReviewStep, getNextStep,
    getStepContract, getContractSummary,
    enforceContract, checkDataFlowIntegrity, validatePipelineState
};
