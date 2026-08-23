/**
 * orchestratorFinalEditorHandler 单元测试
 * 覆盖：handleFinalEditorResult（审批通过/字数覆盖/多轮覆盖/普通拒绝四条路径）
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn()
}));

jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

jest.mock('../../server/services/pipeline/pipelineHelpers', () => ({
    formatFeedbackText: jest.fn(f => f?.summary || 'FMT'),
    runPostApproval: jest.fn()
}));

jest.mock('../../server/services/characterStateCache', () => ({
    invalidateForProject: jest.fn(),
    getCacheForChapter: jest.fn(),
    commitSession: jest.fn()
}));

jest.mock('../../server/services/reviewCircuitBreaker', () => ({
    getCircuitBreaker: jest.fn()
}));

jest.mock('../../server/core/pipeline/orchestratorHelpers', () => ({
    clearDownstreamOutputs: jest.fn(),
    generateOverrideOutput: jest.fn((reason, role, feedback) => ({ _override: true, reason, role, feedback })),
    persistPipelineLog: jest.fn()
}));

jest.mock('../../server/services/pipelineModuleRegistry', () => ({
    onPostApproval: jest.fn()
}));

const store = require('../../server/store');
const { formatFeedbackText, runPostApproval } = require('../../server/services/pipeline/pipelineHelpers');
const characterStateCache = require('../../server/services/characterStateCache');
const { getCircuitBreaker } = require('../../server/services/reviewCircuitBreaker');
const { onPostApproval } = require('../../server/services/pipelineModuleRegistry');
const { handleFinalEditorResult } = require('../../server/core/pipeline/orchestratorFinalEditorHandler');

describe('orchestratorFinalEditorHandler.handleFinalEditorResult - 审批通过路径', () => {
    beforeEach(() => jest.clearAllMocks());

    test('stepResult.passed=true 时审批通过：更新 chapter status=approved', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 5, content: 'C', status: 'final-editing' });
        getCircuitBreaker.mockReturnValue({ getAdjustedConfig: () => ({}) });

        const stepResult = { passed: true, feedback: { summary: 'ok' } };
        const result = await handleFinalEditorResult(stepResult, 'ch-1', 'p1',
            { chapterNumber: 5 }, 2, [], null, jest.fn(), 'mg', {}, null, 'novel', 'novel', null);

        expect(result.success).toBe(true);
        expect(result.rounds).toBe(2);
        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', expect.objectContaining({
            status: 'approved',
            normalContent: 'C'
        }));
        expect(runPostApproval).toHaveBeenCalled();
        expect(characterStateCache.commitSession).toHaveBeenCalledWith('p1', 5);
        expect(onPostApproval).toHaveBeenCalledWith('p1', 5, 'C');
    });

    test('feedback.approved=true 时审批通过', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 5, content: 'C' });
        getCircuitBreaker.mockReturnValue({ getAdjustedConfig: () => ({}) });

        const stepResult = { passed: false, feedback: { approved: true, summary: 'manual approve' } };
        const result = await handleFinalEditorResult(stepResult, 'ch-1', 'p1',
            { chapterNumber: 5 }, 1, [], null, jest.fn(), '', {}, null, '', 'novel', null);

        expect(result.success).toBe(true);
    });

    test('chapter.status===approved 时审批通过', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 5, content: 'C', status: 'approved' });
        getCircuitBreaker.mockReturnValue({ getAdjustedConfig: () => ({}) });

        const stepResult = { passed: false, feedback: {} };
        const result = await handleFinalEditorResult(stepResult, 'ch-1', 'p1',
            { chapterNumber: 5, status: 'approved' }, 1, [], null, jest.fn(), '', {}, null, '', 'novel', null);

        expect(result.success).toBe(true);
    });

    test('审批通过时 characterStateCache.invalidateForProject 抛错不影响主流程', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 5, content: 'C' });
        getCircuitBreaker.mockReturnValue({ getAdjustedConfig: () => ({}) });
        characterStateCache.invalidateForProject.mockRejectedValue(new Error('cache err'));

        const stepResult = { passed: true, feedback: {} };
        const result = await handleFinalEditorResult(stepResult, 'ch-1', 'p1',
            { chapterNumber: 5 }, 1, [], null, jest.fn(), '', {}, null, '', 'novel', null);

        expect(result.success).toBe(true);
    });

    test('审批通过时 onPostApproval 抛错不影响主流程', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 5, content: 'C' });
        getCircuitBreaker.mockReturnValue({ getAdjustedConfig: () => ({}) });
        onPostApproval.mockRejectedValue(new Error('post approve err'));

        const stepResult = { passed: true, feedback: {} };
        const result = await handleFinalEditorResult(stepResult, 'ch-1', 'p1',
            { chapterNumber: 5 }, 1, [], null, jest.fn(), '', {}, null, '', 'novel', null);

        expect(result.success).toBe(true);
    });
});

describe('orchestratorFinalEditorHandler.handleFinalEditorResult - 字数拒绝覆盖路径', () => {
    beforeEach(() => jest.clearAllMocks());

    test('summary 含"字数超限"时触发字数覆盖：调用runPostApproval', async () => {
        store.getItem.mockResolvedValueOnce({ id: 'ch-1', chapterNumber: 5, content: 'C', status: 'final-editing' });
        getCircuitBreaker.mockReturnValue({ getAdjustedConfig: () => ({}) });
        const runStepFn = jest.fn().mockResolvedValue({ passed: true, feedback: { summary: 'mm ok' } });

        const stepResult = {
            passed: false,
            feedback: { summary: '字数超限', issues: [] }
        };
        const result = await handleFinalEditorResult(stepResult, 'ch-1', 'p1',
            { chapterNumber: 5 }, 1, [], null, runStepFn, 'mg', {}, null, '', 'novel', null);

        expect(result.success).toBe(true);
        expect(result.message).toBe('Chapter approved (word-count override)');
        expect(stepResult.passed).toBe(true);
        expect(stepResult.feedback.approved).toBe(true);
        // 陷阱#91修复：字数覆盖路径现在调用runPostApproval（而非直接调用material-manager）
        // pipelineLog在调用前已push了stepResult，所以是含1个元素的数组
        expect(runPostApproval).toHaveBeenCalledWith('p1', 'ch-1', 5, 1, expect.any(Array), null,
            expect.objectContaining({ mode: 'novel', materialGuidance: 'mg' }));
        expect(characterStateCache.commitSession).toHaveBeenCalledWith('p1', 5);
    });

    test('issues 含"字数过多"时触发字数覆盖', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 5, content: 'C', status: 'final-editing' });
        getCircuitBreaker.mockReturnValue({ getAdjustedConfig: () => ({}) });
        const runStepFn = jest.fn().mockResolvedValue({ passed: true });

        const stepResult = {
            passed: false,
            feedback: { summary: '其他', issues: [{ description: '字数过多' }] }
        };
        const result = await handleFinalEditorResult(stepResult, 'ch-1', 'p1',
            { chapterNumber: 5 }, 1, [], null, runStepFn, '', {}, null, '', 'novel', null);

        expect(result.success).toBe(true);
        expect(runPostApproval).toHaveBeenCalled();
    });

    test('字数覆盖时调用onPostApproval且其抛错不影响审批通过', async () => {
        store.getItem.mockResolvedValueOnce({ id: 'ch-1', chapterNumber: 5, content: 'C' });
        getCircuitBreaker.mockReturnValue({ getAdjustedConfig: () => ({}) });
        onPostApproval.mockRejectedValue(new Error('post approval err'));

        const stepResult = {
            passed: false,
            feedback: { summary: '字数超限' }
        };
        const result = await handleFinalEditorResult(stepResult, 'ch-1', 'p1',
            { chapterNumber: 5 }, 1, [], null, jest.fn(), '', {}, null, '', 'novel', null);

        expect(result.success).toBe(true);
    });

    test('字数覆盖时不再直接设置status=material-updated（由runPostApproval内部处理）', async () => {
        store.getItem.mockResolvedValueOnce({ id: 'ch-1', chapterNumber: 5, content: 'C' });
        getCircuitBreaker.mockReturnValue({ getAdjustedConfig: () => ({}) });
        const runStepFn = jest.fn().mockResolvedValue({ passed: true });

        const stepResult = {
            passed: false,
            feedback: { summary: '字数超限' }
        };
        const result = await handleFinalEditorResult(stepResult, 'ch-1', 'p1',
            { chapterNumber: 5 }, 1, [], null, runStepFn, '', {}, null, '', 'novel', null);

        expect(result.success).toBe(true);
        // 陷阱#91修复：字数覆盖路径不再直接设置status=material-updated
        // store.setItem 只在 chapter.status='approved' 时调用一次
        expect(store.setItem).toHaveBeenCalledTimes(1);
    });
});

describe('orchestratorFinalEditorHandler.handleFinalEditorResult - 多轮覆盖路径', () => {
    beforeEach(() => jest.clearAllMocks());

    test('round>=maxRounds 且无 hardBlock 时多轮覆盖', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 5, content: 'C' });
        getCircuitBreaker.mockReturnValue({ getAdjustedConfig: () => ({}) });

        const stepResult = {
            passed: false,
            feedback: { summary: '剧情不连贯' }
        };
        const result = await handleFinalEditorResult(stepResult, 'ch-1', 'p1',
            { chapterNumber: 5 }, 3, [], null, jest.fn(), 'mg',
            { maxRounds: 3 }, null, '', 'novel', null);

        expect(result.success).toBe(true);
        expect(result.message).toContain('multi-round override');
        expect(stepResult.passed).toBe(true);
        expect(stepResult.feedback._overridden).toBe(true);
        expect(runPostApproval).toHaveBeenCalled();
        expect(characterStateCache.commitSession).toHaveBeenCalledWith('p1', 5);
    });

    test('round>=maxRounds 但有 hardBlock 时不覆盖', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 5, content: 'C' });

        const stepResult = {
            passed: false,
            feedback: { summary: '剧情问题', _hardBlock: true }
        };
        const result = await handleFinalEditorResult(stepResult, 'ch-1', 'p1',
            { chapterNumber: 5 }, 3, [], null, jest.fn(), 'mg',
            { maxRounds: 3 }, null, '', 'novel', null);

        expect(result.success).toBeUndefined();
        expect(result.roundFailed).toBe(true);
        expect(stepResult.passed).toBe(false);
    });

    test('round<maxRounds 时不触发多轮覆盖', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 5, content: 'C' });

        const stepResult = {
            passed: false,
            feedback: { summary: '剧情问题' }
        };
        const result = await handleFinalEditorResult(stepResult, 'ch-1', 'p1',
            { chapterNumber: 5 }, 2, [], null, jest.fn(), 'mg',
            { maxRounds: 3 }, null, '', 'novel', null);

        expect(result.roundFailed).toBe(true);
        expect(result.lastFeedback).toBe('剧情问题');
        expect(result.feedbackHeader).toBe('【定稿人意见】');
    });
});

describe('orchestratorFinalEditorHandler.handleFinalEditorResult - 普通拒绝路径', () => {
    beforeEach(() => jest.clearAllMocks());

    test('普通拒绝：返回 roundFailed + feedbackHeader', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 5, content: 'C' });

        const stepResult = {
            passed: false,
            feedback: { summary: '剧情不连贯', issues: [{ desc: '问题1' }] }
        };
        const result = await handleFinalEditorResult(stepResult, 'ch-1', 'p1',
            { chapterNumber: 5 }, 1, [], null, jest.fn(), 'mg',
            { maxRounds: 3 }, null, '', 'novel', null);

        expect(result.roundFailed).toBe(true);
        expect(result.lastFeedback).toBe('剧情不连贯');
        expect(result.feedbackHeader).toBe('【定稿人意见】');
        expect(formatFeedbackText).toHaveBeenCalled();
    });
});
