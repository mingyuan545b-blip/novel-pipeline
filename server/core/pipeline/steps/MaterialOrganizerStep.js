const { BaseStep } = require('./BaseStep');
const { StepResult } = require('./StepResult');
const { handleMaterialOrganizer } = require('../../../services/pipeline/steps/materialOrganizer');

class MaterialOrganizerStep extends BaseStep {
    constructor() { super('material-organizer'); }

    async execute(params) {
        const orgResult = await handleMaterialOrganizer(params);

        // material-organizer返回organizingPlan而非标准chapter
        // organizingPlan需要传递给material-registrar
        // 通过StepResult的result字段传递organizingPlan
        return StepResult.pass(this.name, {
            result: { response: orgResult.response || '', organizingPlan: orgResult.organizingPlan },
            chapter: params.chapter,
            feedback: { summary: 'material-organizer完成', issues: [], suggestions: [] }
        });
    }
}

module.exports = MaterialOrganizerStep;
