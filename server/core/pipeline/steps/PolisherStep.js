/**
 * PolisherStep - 润色步骤
 * 委托给现有handlePolisher，但使用BaseStep的persist/error handling
 * 解决：润色输出未持久化
 */
const { BaseStep } = require('./BaseStep');
const { StepResult } = require('./StepResult');
const { handlePolisher } = require('../../../services/pipeline/steps/polisher');

class PolisherStep extends BaseStep {
    constructor() {
        super('polisher');
    }

    /**
     * @param {object} params
     * @returns {Promise<StepResult>}
     */
    async execute(params) {
        const polisherResult = await handlePolisher(params);

        // polisher总是通过（只做文采提升）
        return StepResult.pass(this.name, {
            result: polisherResult.result,
            chapter: polisherResult.chapter || params.chapter
        });
    }
}

module.exports = PolisherStep;
