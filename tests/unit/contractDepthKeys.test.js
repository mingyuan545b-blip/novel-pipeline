/**
 * S2：契约深度键单一源 + 生产端真正产出 + severity 分级（WARN 不阻断）
 */
jest.mock('../../server/store', () => ({ getItem: jest.fn(), setItem: jest.fn(), queryItems: jest.fn() }));
jest.mock('../../server/services/pipeline/stepContextBuilder', () => ({ buildStepContext: jest.fn() }));
jest.mock('../../server/services/pipeline/pipelinePreflight', () => ({ preflight: jest.fn() }));
jest.mock('../../server/services/pipeline/materialGate', () => ({ assertChapterReady: jest.fn(), buildGateError: jest.fn() }));
jest.mock('../../server/services/pipeline/contractMaterialEnricher', () => ({ enrichMaterialsForContract: jest.fn(async m => m) }));
jest.mock('../../server/services/pipeline/contractValidator', () => ({
    validateInput: jest.fn(), validateOutput: jest.fn(), validatePostMaterial: jest.fn()
}));
jest.mock('../../server/core/pipeline/steps/StepRegistry', () => ({ hasNewStep: jest.fn(() => true), executeStep: jest.fn() }));
jest.mock('../../server/services/fileOutput', () => ({ saveAgentOutput: jest.fn(), AGENT_ROLE_NAMES: {} }));
jest.mock('../../server/services/pipeline/techniqueContextHelpers', () => ({ recordReviewFeedback: jest.fn() }));
jest.mock('../../server/services/auditLog', () => ({ log: jest.fn(), ACTIONS: { PIPELINE_COMPLETE: 'x', PIPELINE_ERROR: 'y' } }));
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { buildStepContext } = require('../../server/services/pipeline/stepContextBuilder');
const { assertChapterReady } = require('../../server/services/pipeline/materialGate');
const contractValidator = require('../../server/services/pipeline/contractValidator');
const StepRegistry = require('../../server/core/pipeline/steps/StepRegistry');
const { runPipelineStep } = require('../../server/services/pipeline/pipelineStepRunner');
const { buildStateJson } = require('../../server/services/pipeline/agentMaterialHelpers');
const { resolveRef, CHARACTER_DEPTH_KEYS } = require('../../server/services/pipeline/contracts/_registry');

describe('S2 契约深度键', () => {
    test('@characterDepthKeys 引用可解析为 5 个键', () => {
        expect(resolveRef('@characterDepthKeys')).toEqual(CHARACTER_DEPTH_KEYS);
        expect(CHARACTER_DEPTH_KEYS).toContain('innerConflict');
        expect(CHARACTER_DEPTH_KEYS).toContain('independentStance');
        expect(CHARACTER_DEPTH_KEYS).toContain('fateArc');
    });

    test('7 份契约 stateJson.anyOf 均引用单一源（非手写数组）', () => {
        const realValidator = jest.requireActual('../../server/services/pipeline/contractValidator');
        for (const agent of ['writer', 'first-review', 'second-review', 'fast-review', 'final-editor', 'reviser', 'polisher']) {
            const c = realValidator.loadContract(agent);
            expect(c.input.materialFields.character.stateJson.anyOf).toBe('@characterDepthKeys');
        }
    });

    test('buildStateJson 从实体 profile 真正产出深度键（改生产端）', async () => {
        const state = await buildStateJson({
            id: 'e1', name: '岑野', roleLevel: 'protagonist',
            personality: '冷厉', profile: { innerConflict: '复仇 vs 良知', fateArc: '从孤狼到守护' }
        }, null);
        expect(state.innerConflict).toBe('复仇 vs 良知');
        expect(state.fateArc).toBe('从孤狼到守护');
        expect(state.personality).toBe('冷厉');
    });
});

describe('S2 severity 分级：WARN 不再阻断', () => {
    beforeEach(() => jest.clearAllMocks());

    test('输入契约仅 WARN → step 继续执行，warnings 回传不失败', async () => {
        buildStepContext.mockResolvedValue({
            chapter: { id: 'ch-2', chapterNumber: 2 }, materials: [], project: {}, agentContext: {}, budget: {}, maxChapterWords: 3000
        });
        assertChapterReady.mockResolvedValue({ ready: true, blockedBy: [], repaired: [] });
        contractValidator.validateInput.mockReturnValue({
            passed: true, errors: [], warnings: [{ errorCode: 'MM-IN-002', severity: 'HIGH', message: '素材应可获取' }]
        });
        contractValidator.validateOutput.mockReturnValue({ passed: true, errors: [], warnings: [] });
        StepRegistry.executeStep.mockResolvedValue({
            step: 'writer', passed: true, result: { response: 'x'.repeat(200) }, feedback: { summary: 'ok' }
        });

        const r = await runPipelineStep('p1', 'ch-2', 'writer', 1, {});
        expect(r.passed).toBe(true);
        expect(r.contractWarnings).toHaveLength(1);
        expect(r.contractError).toBeUndefined();
    });

    test('输入契约有 CRITICAL error → 仍然阻断', async () => {
        buildStepContext.mockResolvedValue({
            chapter: { id: 'ch-2', chapterNumber: 2 }, materials: [], project: {}, agentContext: {}, budget: {}, maxChapterWords: 3000
        });
        assertChapterReady.mockResolvedValue({ ready: true, blockedBy: [], repaired: [] });
        contractValidator.validateInput.mockReturnValue({
            passed: false, errors: [{ errorCode: 'WR-IN-004', severity: 'CRITICAL', message: '缺深度字段' }], warnings: []
        });

        const r = await runPipelineStep('p1', 'ch-2', 'writer', 1, {});
        expect(r.passed).toBe(false);
        expect(r.contractError.code).toBe('NODE_CONTRACT_PRE_FAIL');
    });
});
