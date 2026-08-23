/**
 * FastReviewStep - 快审步骤
 * 委托给现有handleFastReview，但使用BaseStep的persist/error handling
 * 解决：fast-review通过时chapter输出字段未持久化
 */
const { BaseStep } = require('./BaseStep');
const { StepResult } = require('./StepResult');
const { handleFastReview } = require('../../../services/pipeline/steps/review/fastReview');

class FastReviewStep extends BaseStep {
    constructor() {
        super('fast-review');
    }

    /**
     * @param {object} params
     * @returns {Promise<StepResult>}
     */
    async execute(params) {
        const frResult = await handleFastReview(params);

        if (frResult.passed) {
            // fast-review通过：chapter已设置firstReviewOutput/status
            return StepResult.pass(this.name, {
                result: frResult.result,
                chapter: params.chapter,
                feedback: frResult.feedback
            });
        }

        // fast-review未通过：handler内部已保存chapter
        return StepResult.fail(this.name, {
            result: frResult.result,
            chapter: params.chapter,
            feedback: frResult.feedback,
            materialGuidance: frResult.materialGuidance || ''
        });
    }
}

module.exports = FastReviewStep;
