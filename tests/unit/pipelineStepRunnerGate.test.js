/**
 * pipelineStepRunner 章节因果门槛兜底网（P1-4a）
 * 覆盖：writer 步在前序章节素材未归档时必须被拦下（抛 MATERIAL_GATE_BLOCKED），
 *      且不进入 preflight/契约校验（快速失败）。
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    queryItems: jest.fn()
}));
jest.mock('../../server/services/pipeline/stepContextBuilder', () => ({
    buildStepContext: jest.fn()
}));
jest.mock('../../server/services/pipeline/pipelinePreflight', () => ({
    preflight: jest.fn()
}));
jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const store = require('../../server/store');
const { buildStepContext } = require('../../server/services/pipeline/stepContextBuilder');
const { preflight } = require('../../server/services/pipeline/pipelinePreflight');
const { runPipelineStep } = require('../../server/services/pipeline/pipelineStepRunner');

describe('pipelineStepRunner 门槛兜底网', () => {
    beforeEach(() => jest.clearAllMocks());

    test('writer 步：前序未归档 → 抛 MATERIAL_GATE_BLOCKED，且不跑 preflight', async () => {
        buildStepContext.mockResolvedValue({
            chapter: { id: 'ch-5', chapterNumber: 5 },
            materials: [], project: {}, agentContext: {}, budget: {}, maxChapterWords: 3000
        });
        store.queryItems.mockResolvedValue([{ id: 'ch-4', chapterNumber: 4, status: 'failed-skipped' }]);

        await expect(runPipelineStep('p1', 'ch-5', 'writer', 1, {}))
            .rejects.toMatchObject({ code: 'MATERIAL_GATE_BLOCKED' });
        expect(preflight).not.toHaveBeenCalled();
    });

    test('非 writer 步（material-manager 补跑）不做门槛判定', async () => {
        buildStepContext.mockResolvedValue({
            chapter: { id: 'ch-4', chapterNumber: 4 },
            materials: [], project: {}, agentContext: {}, budget: {}, maxChapterWords: 3000
        });
        store.queryItems.mockResolvedValue([{ id: 'ch-3', chapterNumber: 3, status: 'failed-skipped' }]);

        // 补跑链不能被门槛打断（否则前序缺口永远修不上）；结果不应携带门槛错误
        let gateErr = null;
        try {
            const r = await runPipelineStep('p1', 'ch-4', 'material-manager', 1, {});
            gateErr = r?.contractError?.code === 'MATERIAL_GATE_BLOCKED' ? r.contractError : null;
        } catch (e) {
            gateErr = e;
        }
        expect(gateErr).toBeNull();
    });
});
