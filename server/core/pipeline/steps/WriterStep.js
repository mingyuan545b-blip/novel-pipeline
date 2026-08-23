/**
 * WriterStep - 执笔步骤
 * 委托给现有handleWriter，但使用BaseStep的persist/error handling基础设施
 * 解决：writer输出未持久化、限流重试跳到下一步
 */
const { BaseStep } = require('./BaseStep');
const { StepResult } = require('./StepResult');
const { handleWriter } = require('../../../services/pipeline/steps/writer');

class WriterStep extends BaseStep {
    constructor() {
        super('writer');
    }

    /**
     * @param {object} params
     * @param {string} params.projectId
     * @param {object} params.chapter
     * @param {object} params.materials
     * @param {object} params.agentContext
     * @param {object} params.context
     * @param {function} params.runAgent
     * @param {function} params.saveAgentOutput
     * @param {number} params.round
     * @param {string} params.mode
     * @param {object} params.modeConfig
     * @param {number} params.maxChapterWords
     * @param {object} params.budget
     * @returns {Promise<StepResult>}
     */
    async execute(params) {
        const writerResult = await handleWriter(params);

        if (writerResult.passed) {
            // writer通过：chapter已设置content/writerOutput/status/wordCount
            return StepResult.pass(this.name, {
                result: writerResult.result || { response: params.chapter.content },
                chapter: writerResult.chapter || params.chapter,
                feedback: writerResult.feedback
            });
        }

        // writer未通过（字数不足等）：chapter已设置_wordCountRejected
        // 注意：handleWriter内部已保存chapter到store（字数不足时）
        return StepResult.fail(this.name, {
            result: writerResult.result || { response: '' },
            chapter: writerResult.chapter || params.chapter,
            feedback: writerResult.feedback,
            materialGuidance: writerResult.materialGuidance || ''
        });
    }
}

module.exports = WriterStep;
