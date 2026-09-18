/**
 * orchestrator (PipelineOrchestrator) 单元测试
 * 覆盖：setRunPipelineStepFn, _getRunPipelineStep, run() 主流程
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn()
}));

jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

jest.mock('../../server/shared/errors', () => ({
    DomainError: class DomainError extends Error {
        constructor(message, code) { super(message); this.code = code; }
    }
}));

jest.mock('../../server/config/systemConfig', () => ({
    LLM_DEFAULTS: { contextErrorCooldownMs: 60000 }
}));

jest.mock('../../server/config', () => ({
    resolveConfig: jest.fn()
}));

jest.mock('../../server/services/genreConfig', () => ({
    resolveGenreFromProject: jest.fn()
}));

jest.mock('../../server/services/dataContext', () => ({
    getDataContext: jest.fn()
}));

jest.mock('../../server/services/pipelineRegistry', () => ({
    registerStepFn: jest.fn(),
    getStepFn: jest.fn()
}));

jest.mock('../../server/services/characterStateCache', () => ({
    startSession: jest.fn(),
    endSession: jest.fn(),
    invalidateForProject: jest.fn(),
    getCacheForChapter: jest.fn(),
    commitSession: jest.fn()
}));

jest.mock('../../server/services/reviewCircuitBreaker', () => ({
    getCircuitBreaker: jest.fn()
}));

jest.mock('../../server/services/pipeline/degradationTracker', () => ({
    summarizeDegradations: jest.fn(),
    drainDegradations: jest.fn()
}));

jest.mock('../../server/core/pipeline/orchestratorHelpers', () => ({
    checkStopped: jest.fn(),
    getSteps: jest.fn(),
    persistPipelineLog: jest.fn(),
    tagLogMeta: (log) => log
}));

jest.mock('../../server/core/pipeline/orchestratorPreflight', () => ({
    runPreflightChecks: jest.fn(),
    handleChapterIntent: jest.fn(),
    syncHooksAndRules: jest.fn()
}));

jest.mock('../../server/core/pipeline/orchestratorRoundHelpers', () => ({
    clearRoundOutputs: jest.fn(),
    checkCircuitBreaker: jest.fn()
}));

jest.mock('../../server/core/pipeline/orchestratorStepLoop', () => ({
    executeStepLoop: jest.fn()
}));

const store = require('../../server/store');
const { resolveConfig } = require('../../server/config');
const { resolveGenreFromProject } = require('../../server/services/genreConfig');
const { getDataContext } = require('../../server/services/dataContext');
const pipelineRegistry = require('../../server/services/pipelineRegistry');
const characterStateCache = require('../../server/services/characterStateCache');
const { getCircuitBreaker } = require('../../server/services/reviewCircuitBreaker');
const { summarizeDegradations, drainDegradations } = require('../../server/services/pipeline/degradationTracker');
const { checkStopped, getSteps, persistPipelineLog } = require('../../server/core/pipeline/orchestratorHelpers');
const { runPreflightChecks, handleChapterIntent, syncHooksAndRules } = require('../../server/core/pipeline/orchestratorPreflight');
const { clearRoundOutputs, checkCircuitBreaker } = require('../../server/core/pipeline/orchestratorRoundHelpers');
const { executeStepLoop } = require('../../server/core/pipeline/orchestratorStepLoop');
const { PipelineOrchestrator } = require('../../server/core/pipeline/orchestrator');

const setupDefaultMocks = () => {
    const project = { id: 'p1', mode: 'novel' };
    const dataContext = { getProject: jest.fn().mockResolvedValue(project) };
    getDataContext.mockResolvedValue(dataContext);
    resolveGenreFromProject.mockReturnValue('novel');
    resolveConfig.mockReturnValue({ chapter: { maxRounds: 3 }, flow: {}, word: {} });
    getSteps.mockReturnValue(['writer', 'first-review', 'final-editor']);
    runPreflightChecks.mockResolvedValue();
    handleChapterIntent.mockResolvedValue(null);
    syncHooksAndRules.mockResolvedValue();
    getCircuitBreaker.mockReturnValue({ getAdjustedConfig: () => ({}) });
    checkStopped.mockReturnValue(false);
    clearRoundOutputs.mockResolvedValue();
    checkCircuitBreaker.mockResolvedValue({ tripped: false });
    persistPipelineLog.mockResolvedValue();
    summarizeDegradations.mockReturnValue(null);
    characterStateCache.startSession.mockReturnValue();
    characterStateCache.endSession.mockReturnValue();
    store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 5, content: 'C', status: 'written', outline: 'O' });
    store.setItem.mockResolvedValue();
    pipelineRegistry.getStepFn.mockReturnValue(jest.fn());
};

describe('PipelineOrchestrator - setRunPipelineStepFn', () => {
    beforeEach(() => jest.clearAllMocks());

    test('设置 _runPipelineStepFn 并注册到 pipelineRegistry', () => {
        const orch = new PipelineOrchestrator({});
        const fn = jest.fn();
        orch.setRunPipelineStepFn(fn);
        expect(orch._runPipelineStepFn).toBe(fn);
        expect(pipelineRegistry.registerStepFn).toHaveBeenCalledWith(fn);
    });
});

describe('PipelineOrchestrator - _getRunPipelineStep', () => {
    beforeEach(() => jest.clearAllMocks());

    test('已设置 _runPipelineStepFn 时直接返回', () => {
        const orch = new PipelineOrchestrator({});
        const fn = jest.fn();
        orch._runPipelineStepFn = fn;
        expect(orch._getRunPipelineStep()).toBe(fn);
    });

    test('未设置时从 pipelineRegistry 获取', () => {
        const fn = jest.fn();
        pipelineRegistry.getStepFn.mockReturnValue(fn);
        const orch = new PipelineOrchestrator({});
        expect(orch._getRunPipelineStep()).toBe(fn);
        expect(orch._runPipelineStepFn).toBe(fn);
    });

    test('pipelineRegistry 抛错时抛出 DomainError', () => {
        pipelineRegistry.getStepFn.mockImplementation(() => { throw new Error('not found'); });
        const orch = new PipelineOrchestrator({});
        expect(() => orch._getRunPipelineStep()).toThrow();
    });
});

describe('PipelineOrchestrator - run() 审批通过路径', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('executeStepLoop 返回 done=true/success=true 时 run 返回成功', async () => {
        executeStepLoop.mockResolvedValue({
            done: true,
            result: { success: true, rounds: 1, log: [{ step: 'writer' }], message: 'approved' }
        });

        const orch = new PipelineOrchestrator({});
        const result = await orch.run('p1', 'ch-1', 5, {});

        expect(result.success).toBe(true);
        expect(result.rounds).toBe(1);
        expect(characterStateCache.endSession).toHaveBeenCalledWith('p1', 5);
    });

    test('executeStepLoop 返回 done=true/success=false（停止）时 run 返回停止', async () => {
        executeStepLoop.mockResolvedValue({
            done: true,
            result: { success: false, rounds: 1, log: [], message: '流水线已停止' }
        });

        const orch = new PipelineOrchestrator({});
        const result = await orch.run('p1', 'ch-1', 5, {});

        expect(result.success).toBe(false);
        expect(result.message).toBe('流水线已停止');
    });
});

describe('PipelineOrchestrator - run() 停止信号路径', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('循环中检测到停止信号时返回停止', async () => {
        checkStopped.mockReturnValue(true);

        const orch = new PipelineOrchestrator({});
        const result = await orch.run('p1', 'ch-1', 5, {});

        expect(result.success).toBe(false);
        expect(result.message).toBe('流水线已停止');
        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', expect.objectContaining({ status: 'outlined' }));
    });
});

describe('PipelineOrchestrator - run() 熔断路径', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('round>1 且熔断触发时返回熔断暂停', async () => {
        checkCircuitBreaker.mockResolvedValue({ tripped: true, alertResult: { reason: 'alert' } });

        const orch = new PipelineOrchestrator({});
        // 设置 startRound > 1 以触发 round > 1 分支
        store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 5, content: 'C', status: 'written', round: 1 });

        const result = await orch.run('p1', 'ch-1', 5, {});

        expect(result.success).toBe(false);
        expect(result.message).toBe('流水线熔断暂停');
        expect(result.alertLoopReport).toEqual({ reason: 'alert' });
    });
});

describe('PipelineOrchestrator - run() 章节状态处理', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('chapter.status=outlined 且 content>500 字时 status 改为 written', async () => {
        store.getItem.mockResolvedValue({
            id: 'ch-1', chapterNumber: 5,
            content: 'x'.repeat(600), status: 'outlined', outline: 'O'
        });
        executeStepLoop.mockResolvedValue({
            done: true,
            result: { success: true, rounds: 1, log: [], message: 'approved' }
        });

        const orch = new PipelineOrchestrator({});
        await orch.run('p1', 'ch-1', 5, {});

        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', expect.objectContaining({ status: 'written' }));
    });

    test('chapter.status=outlined 且 content<=500 字时清空 content', async () => {
        store.getItem.mockResolvedValue({
            id: 'ch-1', chapterNumber: 5,
            content: 'short', status: 'outlined', outline: 'O'
        });
        executeStepLoop.mockResolvedValue({
            done: true,
            result: { success: true, rounds: 1, log: [], message: 'approved' }
        });

        const orch = new PipelineOrchestrator({});
        await orch.run('p1', 'ch-1', 5, {});

        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', expect.objectContaining({
            content: '', wordCount: 0
        }));
    });
});

describe('PipelineOrchestrator - run() 循环失败路径', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('所有轮次完成仍未通过时返回失败', async () => {
        // executeStepLoop 每次返回 roundFailed=true，循环直到结束
        executeStepLoop.mockResolvedValue({
            done: false,
            roundFailed: true,
            currentFeedback: 'fail feedback',
            currentMaterialGuidance: 'mg'
        });

        const orch = new PipelineOrchestrator({});
        const result = await orch.run('p1', 'ch-1', 3, {});

        expect(result.success).toBe(false);
        expect(result.message).toContain('Pipeline经');
        expect(result.lastFeedback).toBe('fail feedback');
        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', expect.objectContaining({ status: 'outlined' }));
    });

    test('失败时 lastLog 含字数问题时 failureType=word-count', async () => {
        executeStepLoop.mockImplementation(params => {
            params.pipelineLog.push({
                step: 'first-review',
                feedback: { issues: [{ desc: '字数低于最低要求' }] }
            });
            return { done: false, roundFailed: true, currentFeedback: 'f', currentMaterialGuidance: '' };
        });

        const orch = new PipelineOrchestrator({});
        const result = await orch.run('p1', 'ch-1', 3, {});

        expect(result.failureType).toBe('word-count');
    });
});

describe('PipelineOrchestrator - run() finally 块', () => {
    beforeEach(() => { jest.clearAllMocks(); setupDefaultMocks(); });

    test('执行成功时 finally 块仍调用 endSession 和 persistPipelineLog', async () => {
        executeStepLoop.mockResolvedValue({
            done: true,
            result: { success: true, rounds: 1, log: [{ step: 'x' }], message: 'approved' }
        });

        const orch = new PipelineOrchestrator({});
        await orch.run('p1', 'ch-1', 5, {});

        expect(characterStateCache.endSession).toHaveBeenCalledWith('p1', 5);
        expect(summarizeDegradations).toHaveBeenCalledWith('chapter-5');
    });

    test('执行抛错时 finally 块仍执行且抛出原始错误', async () => {
        runPreflightChecks.mockRejectedValue(new Error('preflight boom'));

        const orch = new PipelineOrchestrator({});
        await expect(orch.run('p1', 'ch-1', 5, {})).rejects.toThrow('preflight boom');

        expect(characterStateCache.endSession).toHaveBeenCalled();
    });

    test('summarizeDegradations 返回非空时记录警告并 drain', async () => {
        summarizeDegradations.mockReturnValue('degradation summary');
        executeStepLoop.mockResolvedValue({
            done: true,
            result: { success: true, rounds: 1, log: [{ step: 'x' }], message: 'approved' }
        });

        const orch = new PipelineOrchestrator({});
        await orch.run('p1', 'ch-1', 5, {});

        expect(drainDegradations).toHaveBeenCalled();
    });
});
