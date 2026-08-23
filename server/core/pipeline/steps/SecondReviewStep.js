const { BaseStep } = require('./BaseStep');
const { StepResult } = require('./StepResult');
const { handleSecondReview } = require('../../../services/pipeline/steps/review/secondReview');

class SecondReviewStep extends BaseStep {
    constructor() { super('second-review'); }

    async execute(params) {
        const reviewResult = await handleSecondReview(params);

        if (reviewResult.passed) {
            return StepResult.pass(this.name, {
                result: reviewResult.result || { response: '' },
                chapter: reviewResult.chapter || params.chapter,
                feedback: reviewResult.feedback
            });
        }

        return StepResult.fail(this.name, {
            result: reviewResult.result || { response: '' },
            chapter: reviewResult.chapter || params.chapter,
            feedback: reviewResult.feedback,
            materialGuidance: reviewResult.materialGuidance || ''
        });
    }
}

module.exports = SecondReviewStep;
