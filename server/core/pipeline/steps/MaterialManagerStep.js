const { BaseStep } = require('./BaseStep');
const { StepResult } = require('./StepResult');
const { handleMaterialManager } = require('../../../services/pipeline/steps/materialManager');
const { handleMaterialOrganizer } = require('../../../services/pipeline/steps/materialOrganizer');
const { handleMaterialRegistrar } = require('../../../services/pipeline/steps/materialRegistrar');
const store = require('../../../store');
const { saveAgentOutput } = require('../../../services/fileOutput');

class MaterialManagerStep extends BaseStep {
    constructor() { super('material-manager'); }

    async execute(params) {
        const { projectId, chapter, materials, agentContext, context, runAgent } = params;
        const project = await store.getItem('projects', projectId);
        const useSplitMode = project?.features?.enableSplitMaterialManager;

        if (useSplitMode) {
            return await this._executeSplitMode(params);
        }

        const mmResult = await handleMaterialManager(params);
        return StepResult.pass(this.name, {
            result: { response: mmResult.response },
            chapter: params.chapter,
            feedback: mmResult.feedback || { summary: '素材管理完成', updates: [] }
        });
    }

    async _executeSplitMode(params) {
        const { projectId, chapter, materials, agentContext, context, runAgent } = params;

        const organizerResult = await handleMaterialOrganizer({ projectId, chapter, materials, agentContext, context, runAgent, saveAgentOutput });
        const registrarResult = await handleMaterialRegistrar({ projectId, chapter, materials, agentContext, context, organizingPlan: organizerResult.organizingPlan });

        const result = { response: organizerResult.response || '' };
        const feedback = registrarResult.errors.length > 0
            ? { summary: `素材管理完成(拆分模式), ${registrarResult.errors.length} 个错误`, updates: registrarResult.operations }
            : { summary: `素材管理完成(拆分模式): ${registrarResult.operations.length} 项操作`, updates: registrarResult.operations };

        return StepResult.pass(this.name, {
            result,
            chapter: params.chapter,
            feedback
        });
    }
}

module.exports = MaterialManagerStep;
