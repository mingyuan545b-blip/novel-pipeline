const { BaseStep } = require('./BaseStep');
const { StepResult } = require('./StepResult');
const { handleReader } = require('../../../services/pipeline/steps/reader');

class ReaderStep extends BaseStep {
    constructor() { super('reader'); }

    async execute(params) {
        const readerResult = await handleReader(params);

        // reader修改params.chapter.readerOutput但不返回chapter
        // BaseStep.runWithRetry()中result.chapter为null时不会persist
        // 但pipelineStepRunner中会通过Object.assign同步
        return StepResult.pass(this.name, {
            result: readerResult.result || { response: '' },
            chapter: params.chapter,
            feedback: { summary: 'reader完成', issues: [], suggestions: [] }
        });
    }
}

module.exports = ReaderStep;
