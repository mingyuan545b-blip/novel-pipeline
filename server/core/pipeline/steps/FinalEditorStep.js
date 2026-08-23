/**
 * FinalEditorStep - 定稿步骤
 * 委托给现有handleFinalEditor，但使用BaseStep的persist/error handling
 * 解决：定稿人输出未持久化、硬编码字数常量
 */
const { BaseStep } = require('./BaseStep');
const { StepResult } = require('./StepResult');
const { handleFinalEditor } = require('../../../services/pipeline/steps/finalEditor');

class FinalEditorStep extends BaseStep {
    constructor() {
        super('final-editor');
    }

    /**
     * @param {object} params
     * @returns {Promise<StepResult>}
     */
    async execute(params) {
        const feResult = await handleFinalEditor(params);

        if (feResult.passed) {
            // 定稿通过：handler内部已保存chapter（approved状态）
            return StepResult.pass(this.name, {
                result: feResult.result,
                chapter: feResult.chapter || params.chapter,
                feedback: feResult.feedback,
                materialGuidance: feResult.materialGuidance || ''
            });
        }

        // 定稿未通过：handler内部已保存chapter（final-editing状态）
        return StepResult.fail(this.name, {
            result: feResult.result,
            chapter: feResult.chapter || params.chapter,
            feedback: feResult.feedback,
            materialGuidance: feResult.materialGuidance || ''
        });
    }
}

module.exports = FinalEditorStep;
