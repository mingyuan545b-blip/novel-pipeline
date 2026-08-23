const { BaseStep } = require('./BaseStep');
const { StepResult } = require('./StepResult');
const { handleReviser } = require('../../../services/pipeline/steps/reviser');

class ReviserStep extends BaseStep {
    constructor() { super('reviser'); }

    async execute(params) {
        const reviserResult = await handleReviser(params);

        if (reviserResult.passed) {
            return StepResult.pass(this.name, {
                result: reviserResult.result || { response: '' },
                chapter: reviserResult.chapter || params.chapter,
                feedback: reviserResult.feedback,
                materialGuidance: reviserResult.materialGuidance || ''
            });
        }

        return StepResult.fail(this.name, {
            result: reviserResult.result || { response: '' },
            chapter: reviserResult.chapter || params.chapter,
            feedback: reviserResult.feedback,
            materialGuidance: reviserResult.materialGuidance || ''
        });
    }
}

module.exports = ReviserStep;
