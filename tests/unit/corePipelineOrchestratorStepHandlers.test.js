/**
 * orchestratorStepHandlers 单元测试
 * 覆盖：executeStep、handleReviewResult（含 passed/failed/override/multi-round override 路径）
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    queryItems: jest.fn()
}));

jest.mock('../../server/services/pipeline/reviewOverride', () => ({
    shouldOverrideReviewRejection: jest.fn()
}));

jest.mock('../../server/services/fileOutput', () => ({
    AGENT_ROLE_NAMES: { 'writer': '执笔人', 'first-review': '初审', 'final-editor': '定稿人' }
}));

jest.mock('../../server/services/pipeline/pipelineHelpers', () => ({
    checkWordCountHardLimit: jest.fn(),
    formatFeedbackText: jest.fn(f => f?.summary || 'FMT'),
    runPostApproval: jest.fn()
}));

jest.mock('../../server/services/pipelineMetrics', () => ({
    recordStepStart: jest.fn(() => ({ startTime: Date.now() })),
    recordStepEnd: jest.fn()
}));

jest.mock('../../server/services/pipelineModuleRegistry', () => ({
    onPostApproval: jest.fn()
}));

jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

jest.mock('../../server/core/pipeline/orchestratorFinalEditorHandler', () => ({
    handleFinalEditorResult: jest.fn()
}));

const store = require('../../server/store');
const { shouldOverrideReviewRejection } = require('../../server/services/pipeline/reviewOverride');
const pipelineMetrics = require('../../server/services/pipelineMetrics');
const { executeStep, handleReviewResult } = require('../../server/core/pipeline/orchestratorStepHandlers');

describe('orchestratorStepHandlers.executeStep', () => {
    beforeEach(() => jest.clearAllMocks());

    test('正常执行：返回 { result, durationMs }', async () => {
        const stepResult = { passed: true, feedback: { summary: 'ok' } };
        const runStepFn = jest.fn().mockResolvedValue(stepResult);
        const pipelineLog = [];
        const onStep = jest.fn();

        const r = await executeStep('p1', 'ch-1', 'writer', 1, {}, pipelineLog, onStep, runStepFn, null);

        expect(r.result).toBe(stepResult);
        expect(r.durationMs).toBeGreaterThanOrEqual(0);
        expect(pipelineLog).toContain(stepResult);
        expect(onStep).toHaveBeenCalledWith(expect.objectContaining({ step: 'writer', passed: true, roleName: '执笔人' }));
        expect(pipelineMetrics.recordStepEnd).toHaveBeenCalledWith(expect.any(Object), true);
    });

    test('runStepFn 抛错时记录失败并重新抛出', async () => {
        const runStepFn = jest.fn().mockRejectedValue(new Error('step boom'));
        await expect(executeStep('p1', 'ch-1', 'writer', 1, {}, [], null, runStepFn, null))
            .rejects.toThrow('step boom');
        expect(pipelineMetrics.recordStepEnd).toHaveBeenCalledWith(expect.any(Object), false);
    });

    test('stepResult.passed=false 时 recordStepEnd 收到 false', async () => {
        const stepResult = { passed: false, feedback: {} };
        const runStepFn = jest.fn().mockResolvedValue(stepResult);
        await executeStep('p1', 'ch-1', 'writer', 1, {}, [], null, runStepFn, null);
        expect(pipelineMetrics.recordStepEnd).toHaveBeenCalledWith(expect.any(Object), false);
    });

    test('pipelineLog 超过 200 条时裁剪', async () => {
        const stepResult = { passed: true, feedback: {} };
        const runStepFn = jest.fn().mockResolvedValue(stepResult);
        const pipelineLog = Array.from({ length: 200 }, (_, i) => ({ step: 'old' + i }));
        await executeStep('p1', 'ch-1', 'writer', 1, {}, pipelineLog, null, runStepFn, null);
        expect(pipelineLog.length).toBe(200);
    });

    test('onStep 缺失时不抛错且仍调用 runStepFn', async () => {
        const stepResult = { passed: true };
        const runStepFn = jest.fn().mockResolvedValue(stepResult);
        const result = await executeStep('p1', 'ch-1', 'writer', 1, {}, [], null, runStepFn, null);
        expect(runStepFn).toHaveBeenCalled();          // 真断言（原测试只调用不验证）
        expect(result).toBeDefined();
    });

    test('abortController 透传给 context', async () => {
        const stepResult = { passed: true };
        const runStepFn = jest.fn().mockResolvedValue(stepResult);
        const controller = { signal: { aborted: false } };
        await executeStep('p1', 'ch-1', 'writer', 1, { foo: 1 }, [], null, runStepFn, controller);
        expect(runStepFn).toHaveBeenCalledWith('p1', 'ch-1', 'writer', 1, expect.objectContaining({ foo: 1, signal: controller.signal }));
    });
});

describe('orchestratorStepHandlers.handleReviewResult', () => {
    beforeEach(() => jest.clearAllMocks());

    test('passed=true 且 step=first-review 时更新 chapter status 为 first-reviewed', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', status: 'first-reviewing' });
        const result = await handleReviewResult('first-review', { passed: true }, 'ch-1', 'p1', {}, 1, {}, {}, [], {}, {});
        expect(result).toEqual({ passed: true });
        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', expect.objectContaining({ status: 'first-reviewed' }));
    });

    test('passed=true 且 step=second-review 时更新 chapter status 为 second-reviewed', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', status: 'second-reviewing' });
        const result = await handleReviewResult('second-review', { passed: true }, 'ch-1', 'p1', {}, 1, {}, {}, [], {}, {});
        expect(result).toEqual({ passed: true });
        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', expect.objectContaining({ status: 'second-reviewed' }));
    });

    test('passed=true 但 chapter.status 不是 reviewing 时不更新', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', status: 'other' });
        const result = await handleReviewResult('first-review', { passed: true }, 'ch-1', 'p1', {}, 1, {}, {}, [], {}, {});
        expect(result).toEqual({ passed: true });
        expect(store.setItem).not.toHaveBeenCalled();
    });

    test('passed=false 且 override 成功时返回 passed=true', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', status: 'first-reviewing', content: 'c' });
        store.queryItems.mockResolvedValue([]);
        shouldOverrideReviewRejection.mockReturnValue({ override: true, reason: 'R' });
        const rejectionTracker = {};

        const result = await handleReviewResult('first-review', { passed: false, feedback: {} }, 'ch-1', 'p1', {}, 1, { word: { rejectMin: 100 } }, {}, [], rejectionTracker, {});

        expect(result).toEqual({ passed: true });
        expect(rejectionTracker['first-review']).toBe(true);
    });

    test('passed=false 且 override 失败且 round < maxRounds 时返回 roundFailed', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', content: 'c' });
        store.queryItems.mockResolvedValue([]);
        shouldOverrideReviewRejection.mockReturnValue({ override: false });
        const rejectionTracker = {};
        const circuitBreaker = { recordFailure: jest.fn() };

        const result = await handleReviewResult('first-review',
            { passed: false, feedback: { summary: 'S', issues: [{ desc: 'issue' }] } },
            'ch-1', 'p1', { chapterNumber: 1 }, 1, { word: { rejectMin: 100 } }, {}, [], rejectionTracker, circuitBreaker);

        expect(result.passed).toBe(false);
        expect(result.roundFailed).toBe(true);
        expect(result.lastFeedback).toBe('S');
        expect(result.feedbackHeader).toBe('【初审意见】');
    });

    test('passed=false 且 first-review 字数问题不触发 circuitBreaker.recordFailure', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', content: 'c' });
        store.queryItems.mockResolvedValue([]);
        shouldOverrideReviewRejection.mockReturnValue({ override: false });
        const circuitBreaker = { recordFailure: jest.fn() };

        await handleReviewResult('first-review',
            { passed: false, feedback: { issues: [{ desc: '字数低于最低要求' }] } },
            'ch-1', 'p1', { chapterNumber: 1 }, 1, { word: { rejectMin: 100 } }, {}, [], {}, circuitBreaker);

        expect(circuitBreaker.recordFailure).not.toHaveBeenCalled();
    });

    test('passed=false 且 first-review 非字数问题触发 circuitBreaker.recordFailure', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', content: 'c' });
        store.queryItems.mockResolvedValue([]);
        shouldOverrideReviewRejection.mockReturnValue({ override: false });
        const circuitBreaker = { recordFailure: jest.fn() };

        await handleReviewResult('first-review',
            { passed: false, feedback: { issues: [{ desc: '剧情问题' }] } },
            'ch-1', 'p1', { chapterNumber: 1 }, 1, { word: { rejectMin: 100 } }, {}, [], {}, circuitBreaker);

        expect(circuitBreaker.recordFailure).toHaveBeenCalledWith('first-review', 1);
    });

    test('round >= maxRounds 且无 hardBlock 时多轮覆盖', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', status: 'first-reviewing', content: 'c' });
        store.queryItems.mockResolvedValue([]);
        shouldOverrideReviewRejection.mockReturnValue({ override: false });
        const config = { chapter: { maxRounds: 3 }, word: { rejectMin: 100 } };
        const circuitBreaker = { recordFailure: jest.fn() };

        const result = await handleReviewResult('first-review',
            { passed: false, feedback: { summary: 'S' } },
            'ch-1', 'p1', { chapterNumber: 1 }, 3, config, {}, [], {}, circuitBreaker);

        expect(result.passed).toBe(true);
    });

    test('round >= maxRounds 但有 hardBlock 时不覆盖', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', content: 'c' });
        store.queryItems.mockResolvedValue([]);
        shouldOverrideReviewRejection.mockReturnValue({ override: false });
        const config = { chapter: { maxRounds: 3 }, word: { rejectMin: 100 } };
        const circuitBreaker = { recordFailure: jest.fn() };

        const result = await handleReviewResult('first-review',
            { passed: false, feedback: { _hardBlock: true, summary: 'S' } },
            'ch-1', 'p1', { chapterNumber: 1 }, 3, config, {}, [], {}, circuitBreaker);

        expect(result.passed).toBe(false);
        expect(result.roundFailed).toBe(true);
    });

    test('feedbackHeader 根据 step 选择正确值', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', content: 'c' });
        store.queryItems.mockResolvedValue([]);
        shouldOverrideReviewRejection.mockReturnValue({ override: false });
        const circuitBreaker = { recordFailure: jest.fn() };

        const r1 = await handleReviewResult('first-review',
            { passed: false, feedback: { summary: 'S' } }, 'ch-1', 'p1', {}, 1, { word: {} }, {}, [], {}, circuitBreaker);
        expect(r1.feedbackHeader).toBe('【初审意见】');

        jest.clearAllMocks();
        store.getItem.mockResolvedValue({ id: 'ch-1', content: 'c' });
        store.queryItems.mockResolvedValue([]);
        shouldOverrideReviewRejection.mockReturnValue({ override: false });

        const r2 = await handleReviewResult('fast-review',
            { passed: false, feedback: { summary: 'S' } }, 'ch-1', 'p1', {}, 1, { word: {} }, {}, [], {}, {});
        expect(r2.feedbackHeader).toBe('【快审意见】');
    });
});
