/**
 * orchestratorStepLoop 单元测试
 * 覆盖：executeStepLoop（停止信号/字数硬拦截/各步骤分支/错误处理）
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn()
}));

jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

jest.mock('../../server/services/pipeline/pipelineHelpers', () => ({
    checkWordCountHardLimit: jest.fn()
}));

jest.mock('../../server/services/fileOutput', () => ({
    AGENT_ROLE_NAMES: { 'writer': '执笔人', 'first-review': '初审', 'final-editor': '定稿人', 'material-manager': '素材管理' }
}));

jest.mock('../../server/services/chapterIntent', () => ({
    getChapterIntentPlanner: jest.fn()
}));

jest.mock('../../server/services/hookBudget', () => ({
    getHookBudgetForProject: jest.fn()
}));

jest.mock('../../server/core/pipeline/orchestratorHelpers', () => ({
    checkStopped: jest.fn(),
    clearDownstreamOutputs: jest.fn(),
    persistPipelineLog: jest.fn()
}));

jest.mock('../../server/core/pipeline/orchestratorStepHandlers', () => ({
    executeStep: jest.fn(),
    handleFinalEditorResult: jest.fn(),
    handleReviewResult: jest.fn()
}));

jest.mock('../../server/core/pipeline/orchestratorRoundHelpers', () => ({
    handleStepError: jest.fn(),
    buildRetryContext: jest.fn(() => ({ mode: 'novel' }))
}));

const store = require('../../server/store');
const { checkWordCountHardLimit } = require('../../server/services/pipeline/pipelineHelpers');
const { getChapterIntentPlanner } = require('../../server/services/chapterIntent');
const { getHookBudgetForProject } = require('../../server/services/hookBudget');
const { checkStopped, persistPipelineLog } = require('../../server/core/pipeline/orchestratorHelpers');
const { executeStep, handleFinalEditorResult, handleReviewResult } = require('../../server/core/pipeline/orchestratorStepHandlers');
const { handleStepError } = require('../../server/core/pipeline/orchestratorRoundHelpers');
const { executeStepLoop } = require('../../server/core/pipeline/orchestratorStepLoop');

const baseParams = () => ({
    projectId: 'p1',
    chapterId: 'ch-1',
    steps: ['writer', 'first-review', 'final-editor'],
    round: 1,
    chapter: { chapterNumber: 5, content: 'C' },
    config: { word: { rejectMin: 100 }, flow: {} },
    project: {},
    mode: 'novel',
    pipelineLog: [],
    onStep: jest.fn(),
    runStepFn: jest.fn(),
    abortController: { signal: { aborted: false } },
    rejectionTracker: {},
    allFeedbackParts: [],
    lastFeedback: '',
    materialGuidance: '',
    chapterIntent: null,
    genre: 'novel',
    circuitBreaker: { recordFailure: jest.fn() },
    options: { maxRounds: 3 },
    retryCount: 0
});

// 统一设置默认 mock，避免每个测试重复
const setupDefaultMocks = () => {
    checkStopped.mockReturnValue(false);
    checkWordCountHardLimit.mockResolvedValue({ blocked: false });
    executeStep.mockResolvedValue({ result: { passed: true, feedback: {} }, durationMs: 5 });
    handleReviewResult.mockResolvedValue({ passed: true });
    handleFinalEditorResult.mockResolvedValue({ success: true, rounds: 1, log: [], message: 'approved' });
    handleStepError.mockResolvedValue({ action: 'fail', retryCount: 0, error: 'err', isOverloaded: false });
    store.setItem.mockResolvedValue();
    persistPipelineLog.mockResolvedValue();
};

describe('orchestratorStepLoop.executeStepLoop - 停止信号', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('开始时检测到停止信号：更新章节状态并返回 done=true', async () => {
        checkStopped.mockReturnValue(true);
        const params = baseParams();

        const result = await executeStepLoop(params);

        expect(result.done).toBe(true);
        expect(result.result.success).toBe(false);
        expect(result.result.message).toBe('流水线已停止');
        expect(params.chapter.status).toBe('outlined');
        expect(params.chapter.skipUntil).toBeUndefined();
        expect(persistPipelineLog).toHaveBeenCalled();
    });

    test('步骤执行后检测到停止信号：返回 done=true', async () => {
        checkStopped.mockReturnValueOnce(false).mockReturnValueOnce(true);
        const params = baseParams();
        params.steps = ['writer'];

        const result = await executeStepLoop(params);

        expect(result.done).toBe(true);
        expect(result.result.message).toBe('流水线已停止');
    });
});

describe('orchestratorStepLoop.executeStepLoop - 字数硬拦截', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('checkWordCountHardLimit 返回 blocked=true 时返回 roundFailed', async () => {
        const wcStepResult = { passed: false, feedback: { summary: '字数硬拦截' } };
        checkWordCountHardLimit.mockResolvedValue({ blocked: true, stepResult: wcStepResult });
        const params = baseParams();
        params.steps = ['writer'];

        const result = await executeStepLoop(params);

        expect(result.done).toBe(false);
        expect(result.roundFailed).toBe(true);
        expect(params.pipelineLog).toContain(wcStepResult);
        expect(params.onStep).toHaveBeenCalledWith(expect.objectContaining({ passed: false }));
    });
});

describe('orchestratorStepLoop.executeStepLoop - writer 步骤分支', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('writer 未通过时设置 currentFeedback 并返回 roundFailed', async () => {
        executeStep.mockResolvedValue({
            result: { passed: false, feedback: { summary: 'writer fail' } },
            durationMs: 5
        });
        const params = baseParams();
        params.steps = ['writer'];

        const result = await executeStepLoop(params);

        expect(result.roundFailed).toBe(true);
        expect(result.currentFeedback).toBe('writer fail');
        expect(params.allFeedbackParts).toContain('【执笔人反馈】\nwriter fail');
    });

    test('writer 通过且有 chapterIntent：注入 chapterIntent 到 context', async () => {
        const intentPlanner = { formatIntentForPrompt: jest.fn().mockResolvedValue('intent-data') };
        getChapterIntentPlanner.mockReturnValue(intentPlanner);
        const params = baseParams();
        params.steps = ['writer', 'first-review'];
        params.chapterIntent = { intent: 'x' };

        await executeStepLoop(params);

        expect(intentPlanner.formatIntentForPrompt).toHaveBeenCalledWith(5);
        expect(executeStep).toHaveBeenCalledWith('p1', 'ch-1', 'writer', 1,
            expect.objectContaining({ chapterIntent: 'intent-data' }),
            expect.any(Array), expect.any(Function), expect.any(Function), expect.any(Object));
    });

    test('round>1 且 writer 步骤且字数达标：切换为 reviser', async () => {
        const params = baseParams();
        params.steps = ['writer'];
        params.round = 2;
        params.chapter.content = 'x'.repeat(200);
        params.config.word.rejectMin = 100;

        await executeStepLoop(params);

        expect(executeStep).toHaveBeenCalledWith('p1', 'ch-1', 'reviser', 2,
            expect.any(Object), expect.any(Array), expect.any(Function), expect.any(Function), expect.any(Object));
    });
});

describe('orchestratorStepLoop.executeStepLoop - final-editor 步骤分支', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('final-editor 返回 success=true 时返回 done=true', async () => {
        handleFinalEditorResult.mockResolvedValue({ success: true, rounds: 1, log: [], message: 'approved' });
        const params = baseParams();
        params.steps = ['final-editor'];

        const result = await executeStepLoop(params);

        expect(result.done).toBe(true);
        expect(result.result.success).toBe(true);
    });

    test('final-editor 返回 roundFailed=true 时返回 roundFailed', async () => {
        handleFinalEditorResult.mockResolvedValue({
            roundFailed: true, lastFeedback: 'fe fail', feedbackHeader: '【定稿人意见】'
        });
        const params = baseParams();
        params.steps = ['final-editor'];

        const result = await executeStepLoop(params);

        expect(result.roundFailed).toBe(true);
        expect(result.currentFeedback).toBe('fe fail');
        expect(params.allFeedbackParts).toContain('【定稿人意见】\nfe fail');
        expect(params.rejectionTracker['final-editor']).toBe(true);
    });
});

describe('orchestratorStepLoop.executeStepLoop - review 步骤分支', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('first-review 返回 passed=true 时继续下一步', async () => {
        handleReviewResult.mockResolvedValue({ passed: true });
        const params = baseParams();
        params.steps = ['first-review', 'final-editor'];

        const result = await executeStepLoop(params);

        expect(result.done).toBe(true);
        expect(result.result.success).toBe(true);
    });

    test('first-review 返回 passed=false 时返回 roundFailed', async () => {
        handleReviewResult.mockResolvedValue({
            passed: false, roundFailed: true, lastFeedback: 'rv fail', feedbackHeader: '【初审意见】'
        });
        const params = baseParams();
        params.steps = ['first-review'];

        const result = await executeStepLoop(params);

        expect(result.roundFailed).toBe(true);
        expect(result.currentFeedback).toBe('rv fail');
        expect(params.allFeedbackParts).toContain('【初审意见】\nrv fail');
    });

    test('second-review 在 first-review 有 _criticalBlocker 时被跳过', async () => {
        const params = baseParams();
        params.steps = ['second-review', 'final-editor'];
        params.pipelineLog.push({ step: 'first-review', result: { feedback: { _criticalBlocker: true } } });

        await executeStepLoop(params);

        // executeStep 只应被调用一次（final-editor），second-review 被跳过
        expect(executeStep).toHaveBeenCalledTimes(1);
        expect(executeStep.mock.calls[0][2]).toBe('final-editor');
    });
});

describe('orchestratorStepLoop.executeStepLoop - 错误处理', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('executeStep 抛错且 handleStepError 返回 retry 时重试当前步骤', async () => {
        executeStep.mockRejectedValueOnce(new Error('step err'))
            .mockResolvedValueOnce({ result: { passed: true, feedback: {} }, durationMs: 5 });
        handleStepError.mockResolvedValue({ action: 'retry', retryCount: 1 });
        const params = baseParams();
        params.steps = ['first-review', 'final-editor'];

        const result = await executeStepLoop(params);

        expect(result.done).toBe(true);
        expect(result.result.success).toBe(true);
        expect(executeStep).toHaveBeenCalledTimes(3); // 1st err + retry + final-editor
        expect(params.retryCount).toBe(1);
    });

    test('executeStep 抛错且 handleStepError 返回 fail 时返回 done=true', async () => {
        executeStep.mockRejectedValue(new Error('step err'));
        handleStepError.mockResolvedValue({ action: 'fail', retryCount: 0, error: 'fatal err', isOverloaded: false });
        const params = baseParams();
        params.steps = ['writer'];

        const result = await executeStepLoop(params);

        expect(result.done).toBe(true);
        expect(result.result.success).toBe(false);
        expect(result.result.error).toBe('fatal err');
        expect(persistPipelineLog).toHaveBeenCalled();
    });
});

describe('orchestratorStepLoop.executeStepLoop - 正常完成', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('所有步骤通过且无 done 信号：返回 roundFailed=false', async () => {
        const params = baseParams();
        params.steps = ['first-review']; // 仅 review 步骤，避免 final-editor 的 done 信号

        const result = await executeStepLoop(params);

        expect(result.done).toBe(false);
        expect(result.roundFailed).toBe(false);
    });
});

describe('orchestratorStepLoop.executeStepLoop - context 注入分支', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('writer 步骤注入 hookAgenda', async () => {
        const hookBudget = { formatHookAgendaForPrompt: jest.fn().mockResolvedValue('hook-agenda') };
        getHookBudgetForProject.mockReturnValue(hookBudget);
        const params = baseParams();
        params.steps = ['writer', 'first-review'];

        await executeStepLoop(params);

        expect(hookBudget.formatHookAgendaForPrompt).toHaveBeenCalledWith(5);
        expect(executeStep).toHaveBeenCalledWith('p1', 'ch-1', 'writer', 1,
            expect.objectContaining({ hookAgenda: 'hook-agenda' }),
            expect.any(Array), expect.any(Function), expect.any(Function), expect.any(Object));
    });

    test('writer 步骤 hookBudget 抛错时仅 warn 不阻断', async () => {
        getHookBudgetForProject.mockImplementation(() => { throw new Error('hook err'); });
        const params = baseParams();
        params.steps = ['writer', 'final-editor'];

        const result = await executeStepLoop(params);

        expect(result.done).toBe(true);
        expect(result.result.success).toBe(true);
    });

    test('material-manager 步骤注入 materialGuidance', async () => {
        const params = baseParams();
        params.steps = ['material-manager'];
        params.materialGuidance = 'guidance-data';

        await executeStepLoop(params);

        expect(executeStep).toHaveBeenCalledWith('p1', 'ch-1', 'material-manager', 1,
            expect.objectContaining({ materialGuidance: 'guidance-data' }),
            expect.any(Array), expect.any(Function), expect.any(Function), expect.any(Object));
    });

    test('审核步骤（first-review）注入 chapterIntent', async () => {
        const intentPlanner = { formatIntentForPrompt: jest.fn().mockResolvedValue('review-intent') };
        getChapterIntentPlanner.mockReturnValue(intentPlanner);
        const params = baseParams();
        params.steps = ['first-review', 'final-editor'];
        params.chapterIntent = { intent: 'x' };

        await executeStepLoop(params);

        expect(intentPlanner.formatIntentForPrompt).toHaveBeenCalledWith(5);
    });

    test('second-review 步骤注入 chapterIntent', async () => {
        const intentPlanner = { formatIntentForPrompt: jest.fn().mockResolvedValue('review-intent') };
        getChapterIntentPlanner.mockReturnValue(intentPlanner);
        const params = baseParams();
        params.steps = ['second-review', 'final-editor'];
        params.chapterIntent = { intent: 'x' };

        await executeStepLoop(params);

        expect(intentPlanner.formatIntentForPrompt).toHaveBeenCalledWith(5);
    });

    test('fast-review 步骤注入 chapterIntent', async () => {
        const intentPlanner = { formatIntentForPrompt: jest.fn().mockResolvedValue('review-intent') };
        getChapterIntentPlanner.mockReturnValue(intentPlanner);
        const params = baseParams();
        params.steps = ['fast-review', 'final-editor'];
        params.chapterIntent = { intent: 'x' };

        await executeStepLoop(params);

        expect(intentPlanner.formatIntentForPrompt).toHaveBeenCalledWith(5);
    });
});

describe('orchestratorStepLoop.executeStepLoop - allFeedbackParts 替换分支', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('writer 未通过且 allFeedbackParts 已有执笔人反馈时替换（idx>=0）', async () => {
        executeStep.mockResolvedValue({
            result: { passed: false, feedback: { summary: 'new feedback' } },
            durationMs: 5
        });
        const params = baseParams();
        params.steps = ['writer'];
        params.allFeedbackParts = ['【执笔人反馈】\nold feedback'];

        const result = await executeStepLoop(params);

        expect(result.roundFailed).toBe(true);
        expect(params.allFeedbackParts).toContain('【执笔人反馈】\nnew feedback');
        expect(params.allFeedbackParts).not.toContain('【执笔人反馈】\nold feedback');
        expect(params.allFeedbackParts).toHaveLength(1);
    });

    test('final-editor roundFailed 且 allFeedbackParts 已有定稿人意见时替换（idx>=0）', async () => {
        handleFinalEditorResult.mockResolvedValue({
            roundFailed: true, lastFeedback: 'new fe feedback', feedbackHeader: '【定稿人意见】'
        });
        const params = baseParams();
        params.steps = ['final-editor'];
        params.allFeedbackParts = ['【定稿人意见】\nold fe feedback'];

        const result = await executeStepLoop(params);

        expect(result.roundFailed).toBe(true);
        expect(params.allFeedbackParts).toContain('【定稿人意见】\nnew fe feedback');
        expect(params.allFeedbackParts).not.toContain('【定稿人意见】\nold fe feedback');
        expect(params.allFeedbackParts).toHaveLength(1);
    });

    test('review 未通过且 allFeedbackParts 已有初审意见时替换（idx>=0）', async () => {
        handleReviewResult.mockResolvedValue({
            passed: false, roundFailed: true, lastFeedback: 'new rv feedback', feedbackHeader: '【初审意见】'
        });
        const params = baseParams();
        params.steps = ['first-review'];
        params.allFeedbackParts = ['【初审意见】\nold rv feedback'];

        const result = await executeStepLoop(params);

        expect(result.roundFailed).toBe(true);
        expect(params.allFeedbackParts).toContain('【初审意见】\nnew rv feedback');
        expect(params.allFeedbackParts).not.toContain('【初审意见】\nold rv feedback');
        expect(params.allFeedbackParts).toHaveLength(1);
    });
});
