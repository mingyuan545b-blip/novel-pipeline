/**
 * Step 子类 execute() 单元测试
 * 覆盖 11 个 Step 子类的 passed/fail 分支和 StepResult 构造
 * 策略：mock 底层 handler，验证 Step 的分支逻辑和 StepResult 组装
 */

// ── Mock 底层 handlers ──
jest.mock('../../server/services/pipeline/steps/writer', () => ({ handleWriter: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/reviser', () => ({ handleReviser: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/review/fastReview', () => ({ handleFastReview: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/review/firstReview', () => ({ handleFirstReview: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/review/secondReview', () => ({ handleSecondReview: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/finalEditor', () => ({ handleFinalEditor: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/polisher', () => ({ handlePolisher: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/reader', () => ({ handleReader: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/materialManager', () => ({ handleMaterialManager: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/materialOrganizer', () => ({ handleMaterialOrganizer: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/materialRegistrar', () => ({ handleMaterialRegistrar: jest.fn() }));
jest.mock('../../server/store', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(true),
    queryItems: jest.fn().mockResolvedValue([])
}));

const { handleWriter } = require('../../server/services/pipeline/steps/writer');
const { handleReviser } = require('../../server/services/pipeline/steps/reviser');
const { handleFastReview } = require('../../server/services/pipeline/steps/review/fastReview');
const { handleFirstReview } = require('../../server/services/pipeline/steps/review/firstReview');
const { handleSecondReview } = require('../../server/services/pipeline/steps/review/secondReview');
const { handleFinalEditor } = require('../../server/services/pipeline/steps/finalEditor');
const { handlePolisher } = require('../../server/services/pipeline/steps/polisher');
const { handleReader } = require('../../server/services/pipeline/steps/reader');
const { handleMaterialManager } = require('../../server/services/pipeline/steps/materialManager');
const { handleMaterialOrganizer } = require('../../server/services/pipeline/steps/materialOrganizer');
const { handleMaterialRegistrar } = require('../../server/services/pipeline/steps/materialRegistrar');
const store = require('../../server/store');

const WriterStep = require('../../server/core/pipeline/steps/WriterStep');
const ReviserStep = require('../../server/core/pipeline/steps/ReviserStep');
const FastReviewStep = require('../../server/core/pipeline/steps/FastReviewStep');
const FirstReviewStep = require('../../server/core/pipeline/steps/FirstReviewStep');
const SecondReviewStep = require('../../server/core/pipeline/steps/SecondReviewStep');
const FinalEditorStep = require('../../server/core/pipeline/steps/FinalEditorStep');
const PolisherStep = require('../../server/core/pipeline/steps/PolisherStep');
const ReaderStep = require('../../server/core/pipeline/steps/ReaderStep');
const MaterialManagerStep = require('../../server/core/pipeline/steps/MaterialManagerStep');
const MaterialOrganizerStep = require('../../server/core/pipeline/steps/MaterialOrganizerStep');
const MaterialRegistrarStep = require('../../server/core/pipeline/steps/MaterialRegistrarStep');

const BASE_PARAMS = {
    projectId: 'proj-1',
    chapterId: 'ch-1',
    chapter: { id: 'ch-1', chapterNumber: 1, content: 'test content' },
    materials: [],
    agentContext: {},
    context: {},
    runAgent: jest.fn(),
    round: 1,
    mode: 'long'
};

beforeEach(() => jest.clearAllMocks());

// ── WriterStep ──
describe('WriterStep.execute()', () => {
    const step = new WriterStep();
    test('passed=true 返回 StepResult.pass', async () => {
        handleWriter.mockResolvedValue({ passed: true, chapter: { content: 'new' }, feedback: { summary: 'ok' }, result: { response: 'new' } });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(true);
        expect(r.step).toBe('writer');
        expect(r.feedback).toEqual({ summary: 'ok' });
    });
    test('passed=false 返回 StepResult.fail', async () => {
        handleWriter.mockResolvedValue({ passed: false, chapter: {}, feedback: { summary: '字数不足' }, materialGuidance: 'guide' });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(false);
        expect(r.materialGuidance).toBe('guide');
    });
    test('result 缺失时使用默认值', async () => {
        handleWriter.mockResolvedValue({ passed: true, chapter: BASE_PARAMS.chapter });
        const r = await step.execute(BASE_PARAMS);
        expect(r.result.response).toBe('test content');
    });
});

// ── ReviserStep ──
describe('ReviserStep.execute()', () => {
    const step = new ReviserStep();
    test('passed=true 返回 StepResult.pass', async () => {
        handleReviser.mockResolvedValue({ passed: true, chapter: {}, feedback: { summary: 'ok' }, result: { response: 'rev' } });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(true);
        expect(r.step).toBe('reviser');
    });
    test('passed=false 返回 StepResult.fail 含 materialGuidance', async () => {
        handleReviser.mockResolvedValue({ passed: false, feedback: { summary: 'fail' }, materialGuidance: 'mg' });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(false);
        expect(r.materialGuidance).toBe('mg');
    });
});

// ── FastReviewStep ──
describe('FastReviewStep.execute()', () => {
    const step = new FastReviewStep();
    test('passed=true', async () => {
        handleFastReview.mockResolvedValue({ passed: true, result: { response: 'r' }, feedback: { summary: 'ok' } });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(true);
        expect(r.step).toBe('fast-review');
    });
    test('passed=false 含 materialGuidance 默认空字符串', async () => {
        handleFastReview.mockResolvedValue({ passed: false, result: { response: '' }, feedback: { summary: 'fail' } });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(false);
        expect(r.materialGuidance).toBe('');
    });
});

// ── FirstReviewStep ──
describe('FirstReviewStep.execute()', () => {
    const step = new FirstReviewStep();
    test('passed=true 优先用 reviewResult.chapter', async () => {
        const ch = { id: 'ch-1', content: 'reviewed' };
        handleFirstReview.mockResolvedValue({ passed: true, chapter: ch, feedback: { summary: 'ok' }, result: { response: 'r' } });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(true);
        expect(r.chapter).toBe(ch);
    });
    test('passed=false fallback 用 params.chapter', async () => {
        handleFirstReview.mockResolvedValue({ passed: false, feedback: { summary: 'fail' } });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(false);
        expect(r.chapter).toBe(BASE_PARAMS.chapter);
    });
});

// ── SecondReviewStep ──
describe('SecondReviewStep.execute()', () => {
    const step = new SecondReviewStep();
    test('passed=true', async () => {
        handleSecondReview.mockResolvedValue({ passed: true, chapter: {}, feedback: { summary: 'ok' }, result: { response: 'r' } });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(true);
        expect(r.step).toBe('second-review');
    });
    test('passed=false', async () => {
        handleSecondReview.mockResolvedValue({ passed: false, feedback: { summary: 'fail' }, materialGuidance: 'mg' });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(false);
    });
});

// ── FinalEditorStep ──
describe('FinalEditorStep.execute()', () => {
    const step = new FinalEditorStep();
    test('passed=true 含 materialGuidance', async () => {
        handleFinalEditor.mockResolvedValue({ passed: true, chapter: {}, feedback: { summary: 'approved' }, result: { response: 'r' }, materialGuidance: 'mg' });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(true);
        expect(r.materialGuidance).toBe('mg');
    });
    test('passed=false', async () => {
        handleFinalEditor.mockResolvedValue({ passed: false, feedback: { summary: 'rejected' }, result: { response: '' } });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(false);
    });
});

// ── PolisherStep ──
describe('PolisherStep.execute()', () => {
    const step = new PolisherStep();
    test('总是返回 passed=true', async () => {
        handlePolisher.mockResolvedValue({ result: { response: 'polished' }, chapter: { content: 'polished' } });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(true);
        expect(r.step).toBe('polisher');
        expect(r.result.response).toBe('polished');
    });
    test('chapter 缺失时 fallback params.chapter', async () => {
        handlePolisher.mockResolvedValue({ result: { response: 'p' } });
        const r = await step.execute(BASE_PARAMS);
        expect(r.chapter).toBe(BASE_PARAMS.chapter);
    });
});

// ── ReaderStep ──
describe('ReaderStep.execute()', () => {
    const step = new ReaderStep();
    test('总是返回 passed=true 含默认 feedback', async () => {
        handleReader.mockResolvedValue({ result: { response: 'reader output' } });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(true);
        expect(r.step).toBe('reader');
        expect(r.feedback.summary).toBe('reader完成');
    });
    test('result 缺失时使用默认 response', async () => {
        handleReader.mockResolvedValue({});
        const r = await step.execute(BASE_PARAMS);
        expect(r.result.response).toBe('');
    });
});

// ── MaterialManagerStep ──
describe('MaterialManagerStep.execute()', () => {
    const step = new MaterialManagerStep();
    test('非拆分模式：总是 passed=true', async () => {
        store.getItem.mockResolvedValue(null); // useSplitMode=false
        handleMaterialManager.mockResolvedValue({ response: 'mm output', feedback: { summary: '完成' } });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(true);
        expect(r.step).toBe('material-manager');
        expect(r.feedback.summary).toBe('完成');
    });
    test('非拆分模式：feedback 缺失时使用默认值', async () => {
        store.getItem.mockResolvedValue(null);
        handleMaterialManager.mockResolvedValue({ response: 'mm' });
        const r = await step.execute(BASE_PARAMS);
        expect(r.feedback.summary).toBe('素材管理完成');
        expect(r.feedback.updates).toEqual([]);
    });
    test('拆分模式：无错误', async () => {
        store.getItem.mockResolvedValue({ features: { enableSplitMaterialManager: true } });
        handleMaterialOrganizer.mockResolvedValue({ response: 'org', organizingPlan: { items: [] } });
        handleMaterialRegistrar.mockResolvedValue({ passed: true, operations: [{ type: 'update' }], errors: [], stateSummary: 'summary' });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(true);
        expect(r.feedback.summary).toContain('拆分模式');
        expect(r.feedback.updates).toEqual([{ type: 'update' }]);
    });
    test('拆分模式：有错误', async () => {
        store.getItem.mockResolvedValue({ features: { enableSplitMaterialManager: true } });
        handleMaterialOrganizer.mockResolvedValue({ response: 'org', organizingPlan: {} });
        handleMaterialRegistrar.mockResolvedValue({ passed: false, operations: [], errors: ['err1', 'err2'], stateSummary: '' });
        const r = await step.execute(BASE_PARAMS);
        expect(r.feedback.summary).toContain('2 个错误');
    });
});

// ── MaterialOrganizerStep ──
describe('MaterialOrganizerStep.execute()', () => {
    const step = new MaterialOrganizerStep();
    test('总是 passed=true 且含 organizingPlan', async () => {
        handleMaterialOrganizer.mockResolvedValue({ response: 'org', organizingPlan: { items: ['a'] } });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(true);
        expect(r.step).toBe('material-organizer');
        expect(r.result.organizingPlan).toEqual({ items: ['a'] });
    });
    test('response 缺失时默认空字符串', async () => {
        handleMaterialOrganizer.mockResolvedValue({ organizingPlan: {} });
        const r = await step.execute(BASE_PARAMS);
        expect(r.result.response).toBe('');
    });
});

// ── MaterialRegistrarStep ──
describe('MaterialRegistrarStep.execute()', () => {
    const step = new MaterialRegistrarStep();
    test('passed=true', async () => {
        handleMaterialRegistrar.mockResolvedValue({ passed: true, operations: [{ type: 'add' }], errors: [], stateSummary: 's' });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(true);
        expect(r.step).toBe('material-registrar');
        expect(r.feedback.summary).toBe('material-registrar完成');
    });
    test('passed=false 含错误信息', async () => {
        handleMaterialRegistrar.mockResolvedValue({ passed: false, operations: [], errors: ['err1'], stateSummary: '' });
        const r = await step.execute(BASE_PARAMS);
        expect(r.passed).toBe(false);
        expect(r.feedback.summary).toContain('err1');
    });
    test('organizingPlan 透传', async () => {
        handleMaterialRegistrar.mockResolvedValue({ passed: true, operations: [], errors: [], stateSummary: '' });
        await step.execute({ ...BASE_PARAMS, organizingPlan: { items: ['x'] } });
        expect(handleMaterialRegistrar).toHaveBeenCalledWith(expect.objectContaining({ organizingPlan: { items: ['x'] } }));
    });
});
