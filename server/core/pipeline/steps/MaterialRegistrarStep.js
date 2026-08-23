const { BaseStep } = require('./BaseStep');
const { StepResult } = require('./StepResult');
const { handleMaterialRegistrar } = require('../../../services/pipeline/steps/materialRegistrar');

class MaterialRegistrarStep extends BaseStep {
    constructor() { super('material-registrar'); }

    async execute(params) {
        // material-registrar需要organizingPlan参数
        // 从params.context或上一步骤的result中获取
        const regParams = { ...params };
        if (params.organizingPlan) {
            regParams.organizingPlan = params.organizingPlan;
        }

        const regResult = await handleMaterialRegistrar(regParams);

        // material-registrar不修改chapter，返回operations/errors/stateSummary
        const passed = regResult.passed;
        const feedbackSummary = passed
            ? 'material-registrar完成'
            : `material-registrar失败: ${(regResult.errors || []).join('; ')}`;

        return (passed ? StepResult.pass : StepResult.fail)(this.name, {
            result: { response: '', operations: regResult.operations || [], errors: regResult.errors || [], stateSummary: regResult.stateSummary || '' },
            chapter: params.chapter,
            feedback: { summary: feedbackSummary, issues: regResult.errors || [], suggestions: [] }
        });
    }
}

module.exports = MaterialRegistrarStep;
