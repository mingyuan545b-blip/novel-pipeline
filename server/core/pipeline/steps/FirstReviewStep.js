const { BaseStep } = require('./BaseStep');
const { StepResult } = require('./StepResult');
const { handleFirstReview } = require('../../../services/pipeline/steps/review/firstReview');

class FirstReviewStep extends BaseStep {
    constructor() { super('first-review'); }

    async execute(params) {
        const reviewResult = await handleFirstReview(params);

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

module.exports = FirstReviewStep;
