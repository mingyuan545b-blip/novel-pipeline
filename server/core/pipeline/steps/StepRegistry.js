/**
 * StepRegistry - Pipeline步骤注册表
 * 统一管理新旧步骤的调度，支持渐进式迁移
 *
 * 设计原则：
 * 1. 新步骤优先使用BaseStep架构（自带persist/error handling）
 * 2. 所有步骤已迁移到BaseStep架构，通过pipelineStepRunner调度
 * 3. 注册表是唯一入口，orchestrator只通过注册表调度步骤
 */
const WriterStep = require('./WriterStep');
const FastReviewStep = require('./FastReviewStep');
const FinalEditorStep = require('./FinalEditorStep');
const PolisherStep = require('./PolisherStep');
const MaterialManagerStep = require('./MaterialManagerStep');
const FirstReviewStep = require('./FirstReviewStep');
const SecondReviewStep = require('./SecondReviewStep');
const ReviserStep = require('./ReviserStep');
const ReaderStep = require('./ReaderStep');
const MaterialOrganizerStep = require('./MaterialOrganizerStep');
const MaterialRegistrarStep = require('./MaterialRegistrarStep');

// 新架构步骤实例（自带persist + error handling + retry）
// adjuster已废弃，由consistencyConstraint机制替代
const NEW_STEPS = {
    'writer': new WriterStep(),
    'fast-review': new FastReviewStep(),
    'first-review': new FirstReviewStep(),
    'second-review': new SecondReviewStep(),
    'reviser': new ReviserStep(),
    'final-editor': new FinalEditorStep(),
    'polisher': new PolisherStep(),
    'reader': new ReaderStep(),
    'material-manager': new MaterialManagerStep(),
    'material-organizer': new MaterialOrganizerStep(),
    'material-registrar': new MaterialRegistrarStep()
};

/**
 * 检查步骤是否已迁移到新架构
 * @param {string} stepName
 * @returns {boolean}
 */
function hasNewStep(stepName) {
    return stepName in NEW_STEPS;
}

/**
 * 获取新架构步骤实例
 * @param {string} stepName
 * @returns {import('./BaseStep').BaseStep | null}
 */
function getStep(stepName) {
    return NEW_STEPS[stepName] || null;
}

/**
 * 执行新架构步骤（带重试和持久化）
 * @param {string} stepName
 * @param {object} params
 * @param {number} [maxRetries]
 * @returns {Promise<import('./StepResult').StepResult>}
 */
async function executeStep(stepName, params, maxRetries) {
    const step = getStep(stepName);
    if (!step) throw new Error(`StepRegistry: unknown step "${stepName}"`);
    return step.runWithRetry(params, maxRetries);
}

/**
 * 获取所有已迁移的步骤名称
 * @returns {string[]}
 */
function getMigratedSteps() {
    return Object.keys(NEW_STEPS);
}

module.exports = { hasNewStep, getStep, executeStep, getMigratedSteps };
