/**
 * orchestratorRoundHelpers 单元测试
 * 覆盖：handleStopped, clearRoundOutputs, checkCircuitBreaker, handleStepError, buildRetryContext
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn()
}));

jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

jest.mock('../../server/config/systemConfig', () => ({
    LLM_DEFAULTS: {
        overloadedWaitMs: 100,
        timeoutWaitMs: 100,
        contextErrorCooldownMs: 60000
    }
}));

jest.mock('../../server/shared/errors', () => ({
    DomainError: class DomainError extends Error {
        constructor(message, code) { super(message); this.code = code; }
    }
}));

jest.mock('../../server/services/fileOutput', () => ({
    AGENT_ROLE_NAMES: { 'writer': '执笔人', 'first-review': '初审' }
}));

jest.mock('../../server/core/pipeline/errorRecovery', () => ({
    classifyError: jest.fn()
}));

jest.mock('../../server/core/pipeline/orchestratorHelpers', () => ({
    checkStopped: jest.fn(),
    clearDownstreamOutputs: jest.fn(),
    persistPipelineLog: jest.fn()
}));

const store = require('../../server/store');
const { classifyError } = require('../../server/core/pipeline/errorRecovery');
const {
    handleStopped,
    clearRoundOutputs,
    checkCircuitBreaker,
    handleStepError,
    buildRetryContext
} = require('../../server/core/pipeline/orchestratorRoundHelpers');

describe('orchestratorRoundHelpers.handleStopped', () => {
    beforeEach(() => jest.clearAllMocks());

    test('更新章节状态为 outlined 并返回停止结果', async () => {
        const chapter = { id: 'ch-1', status: 'first-reviewing', skipUntil: 123 };
        const pipelineLog = [{ step: 'writer' }];

        const result = await handleStopped('p1', 'ch-1', 5, chapter, pipelineLog, {});

        expect(chapter.status).toBe('outlined');
        expect(chapter.skipUntil).toBeUndefined();
        expect(chapter.updatedAt).toBeDefined();
        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', chapter);
        expect(result).toEqual({ success: false, rounds: 0, log: pipelineLog, message: '流水线已停止' });
    });
});

describe('orchestratorRoundHelpers.clearRoundOutputs', () => {
    beforeEach(() => jest.clearAllMocks());

    test('round>1 时清除 finalEditorOutput/reviserOutput 等字段', async () => {
        const chapter = {
            id: 'ch-1',
            finalEditorOutput: 'FE_OUTPUT_LONG_TEXT_FOR_TEST',
            reviserOutput: 'REV_OUTPUT',
            materialManagerOutput: 'MM_OUT',
            polisherOutput: 'POL_OUT'
        };

        await clearRoundOutputs(chapter, 'ch-1', 2, 1);

        expect(chapter.finalEditorOutput).toBeUndefined();
        expect(chapter.reviserOutput).toBeUndefined();
        expect(chapter.materialManagerOutput).toBeUndefined();
        expect(chapter.polisherOutput).toBeUndefined();
        expect(chapter.updatedAt).toBeDefined();
        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', chapter);
    });

    test('startRound===1 且 round===1 时也执行清除', async () => {
        const chapter = { id: 'ch-1', finalEditorOutput: 'FE_OUT' };
        await clearRoundOutputs(chapter, 'ch-1', 1, 1);
        expect(chapter.finalEditorOutput).toBeUndefined();
        expect(store.setItem).toHaveBeenCalled();
    });

    test('无可清除字段时不调用 setItem', async () => {
        const chapter = { id: 'ch-1' };
        await clearRoundOutputs(chapter, 'ch-1', 2, 1);
        expect(store.setItem).not.toHaveBeenCalled();
    });

    test('round===1 且 startRound!==1 时不执行清除', async () => {
        const chapter = { id: 'ch-1', finalEditorOutput: 'FE_OUT' };
        await clearRoundOutputs(chapter, 'ch-1', 1, 3);
        expect(chapter.finalEditorOutput).toBe('FE_OUT');
        expect(store.setItem).not.toHaveBeenCalled();
    });
});

describe('orchestratorRoundHelpers.checkCircuitBreaker', () => {
    beforeEach(() => jest.clearAllMocks());

    test('alertResult 为 falsy 时返回 tripped=false', async () => {
        jest.doMock('../../server/services/pipeline/pipelineUtils', () => ({
            checkAlertLoop: jest.fn().mockResolvedValue(null)
        }));
        // 由于 require 缓存，重新加载模块
        jest.resetModules();
        jest.mock('../../server/services/pipeline/pipelineUtils', () => ({
            checkAlertLoop: jest.fn().mockResolvedValue(null)
        }));
        const mod = require('../../server/core/pipeline/orchestratorRoundHelpers');
        const circuitBreaker = { isTripped: jest.fn() };

        const result = await mod.checkCircuitBreaker('p1', 2, circuitBreaker, [], 'ch-1', 'p1');

        expect(result.tripped).toBe(false);
        expect(circuitBreaker.isTripped).not.toHaveBeenCalled();
    });

    test('alertResult 触发且 isTripped 且 round>=5 时 tripped=true', async () => {
        jest.resetModules();
        jest.mock('../../server/services/pipeline/pipelineUtils', () => ({
            checkAlertLoop: jest.fn().mockResolvedValue({ reason: 'alert' })
        }));
        const mod = require('../../server/core/pipeline/orchestratorRoundHelpers');
        const circuitBreaker = { isTripped: jest.fn().mockResolvedValue(true) };

        const result = await mod.checkCircuitBreaker('p1', 5, circuitBreaker, [{ step: 'x' }], 'ch-1', 'p1');

        expect(result.tripped).toBe(true);
        expect(result.alertResult).toEqual({ reason: 'alert' });
    });

    test('alertResult 触发但 isTripped=false 时 tripped=false', async () => {
        jest.resetModules();
        jest.mock('../../server/services/pipeline/pipelineUtils', () => ({
            checkAlertLoop: jest.fn().mockResolvedValue({ reason: 'alert' })
        }));
        const mod = require('../../server/core/pipeline/orchestratorRoundHelpers');
        const circuitBreaker = { isTripped: jest.fn().mockResolvedValue(false) };

        const result = await mod.checkCircuitBreaker('p1', 5, circuitBreaker, [], 'ch-1', 'p1');

        expect(result.tripped).toBe(false);
    });

    test('alertResult 触发且 isTripped=true 但 round<5 时 tripped=false', async () => {
        jest.resetModules();
        jest.mock('../../server/services/pipeline/pipelineUtils', () => ({
            checkAlertLoop: jest.fn().mockResolvedValue({ reason: 'alert' })
        }));
        const mod = require('../../server/core/pipeline/orchestratorRoundHelpers');
        const circuitBreaker = { isTripped: jest.fn().mockResolvedValue(true) };

        const result = await mod.checkCircuitBreaker('p1', 3, circuitBreaker, [], 'ch-1', 'p1');

        expect(result.tripped).toBe(false);
    });
});

describe('orchestratorRoundHelpers.handleStepError', () => {
    beforeEach(() => jest.clearAllMocks());

    test('overloaded 错误：retryCount<=3 时返回 retry', async () => {
        classifyError.mockReturnValue({
            isOverloaded: true, isContextErr: false, isTimeout: false,
            errorDetail: 'AI服务繁忙'
        });
        store.getItem.mockResolvedValue({ id: 'ch-1', status: 'written' });

        const result = await handleStepError(new Error('overloaded'), 'writer', 1, 'ch-1', 'p1', [], 0);

        expect(result.action).toBe('retry');
        expect(result.retryCount).toBe(1);
        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', expect.objectContaining({ status: 'written' }));
    });

    test('overloaded 错误：retryCount>3 时返回 fail', async () => {
        classifyError.mockReturnValue({
            isOverloaded: true, isContextErr: false, isTimeout: false,
            errorDetail: 'AI服务繁忙'
        });
        store.getItem.mockResolvedValue({ id: 'ch-1', status: 'written' });

        const result = await handleStepError(new Error('overloaded'), 'writer', 1, 'ch-1', 'p1', [], 3);

        expect(result.action).toBe('fail');
        expect(result.retryCount).toBe(4);
        expect(result.isOverloaded).toBe(true);
    });

    test('timeout 错误：返回 retry', async () => {
        classifyError.mockReturnValue({
            isOverloaded: false, isContextErr: false, isTimeout: true,
            errorDetail: '步骤超时'
        });
        store.getItem.mockResolvedValue({ id: 'ch-1' });

        const result = await handleStepError(new Error('timeout'), 'writer', 1, 'ch-1', 'p1', [], 0);

        expect(result.action).toBe('retry');
        expect(result.retryCount).toBe(1);
    });

    test('context 错误：设置 status=context-error 并返回 fail', async () => {
        classifyError.mockReturnValue({
            isOverloaded: false, isContextErr: true, isTimeout: false,
            errorDetail: '上下文溢出'
        });
        store.getItem.mockResolvedValue({ id: 'ch-1', status: 'written' });

        const result = await handleStepError(new Error('ctx'), 'final-editor', 1, 'ch-1', 'p1', [], 0);

        expect(result.action).toBe('fail');
        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', expect.objectContaining({ status: 'context-error' }));
        expect(store.setItem.mock.calls[0][2].skipUntil).toBeDefined();
    });

    test('普通错误：设置 status=pipeline-failed 并返回 fail', async () => {
        classifyError.mockReturnValue({
            isOverloaded: false, isContextErr: false, isTimeout: false,
            errorDetail: '步骤final-editor执行出错: boom'
        });
        store.getItem.mockResolvedValue({ id: 'ch-1', status: 'written' });

        const result = await handleStepError(new Error('boom'), 'final-editor', 1, 'ch-1', 'p1', [], 0);

        expect(result.action).toBe('fail');
        expect(result.error).toBe('步骤final-editor执行出错: boom');
        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', expect.objectContaining({ status: 'pipeline-failed' }));
    });

    test('review 步骤错误：status 保持 written', async () => {
        classifyError.mockReturnValue({
            isOverloaded: false, isContextErr: false, isTimeout: false,
            errorDetail: '步骤first-review执行出错'
        });
        store.getItem.mockResolvedValue({ id: 'ch-1', status: 'first-reviewing' });

        await handleStepError(new Error('boom'), 'first-review', 1, 'ch-1', 'p1', [], 0);

        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', expect.objectContaining({ status: 'written' }));
    });

    test('store.getItem 返回 null 时不抛错', async () => {
        classifyError.mockReturnValue({
            isOverloaded: false, isContextErr: false, isTimeout: false,
            errorDetail: '错误'
        });
        store.getItem.mockResolvedValue(null);

        const result = await handleStepError(new Error('boom'), 'writer', 1, 'ch-1', 'p1', [], 0);

        expect(result.action).toBe('fail');
        expect(store.setItem).not.toHaveBeenCalled();
    });

    test('store.setItem 抛错时不影响主流程', async () => {
        classifyError.mockReturnValue({
            isOverloaded: false, isContextErr: false, isTimeout: false,
            errorDetail: '错误'
        });
        store.getItem.mockResolvedValue({ id: 'ch-1', status: 'written' });
        store.setItem.mockRejectedValue(new Error('save failed'));

        const result = await handleStepError(new Error('boom'), 'writer', 1, 'ch-1', 'p1', [], 0);

        expect(result.action).toBe('fail');
    });
});

describe('orchestratorRoundHelpers.buildRetryContext', () => {
    test('round=1 时返回基础 context', () => {
        const ctx = buildRetryContext(1, 'writer', {}, {}, [], '', 'novel');
        expect(ctx).toEqual({ mode: 'novel' });
    });

    test('round>1 且 step=writer 且单一审核者拒绝：使用 allFeedbackParts', () => {
        const ctx = buildRetryContext(2, 'writer', {},
            { 'first-review': true }, ['【初审意见】\n问题1'], 'fallback', 'novel');
        expect(ctx.reviewFeedback).toBe('【初审意见】\n问题1');
        expect(ctx.mode).toBe('novel');
    });

    test('round>1 且 step=writer 且多位审核者拒绝：使用汇总', () => {
        const ctx = buildRetryContext(2, 'writer', {},
            { 'first-review': true, 'second-review': true },
            ['【初审意见】\n问题1', '【复审意见】\n问题2'], 'fallback', 'novel');
        expect(ctx.reviewFeedback).toContain('【⚠ 多位审核者意见汇总】');
        expect(ctx.reviewFeedback).toContain('【初审意见】');
        expect(ctx.reviewFeedback).toContain('【复审意见】');
    });

    test('round>1 且 step!=writer：返回基础 context', () => {
        const ctx = buildRetryContext(2, 'first-review', {}, {}, ['反馈'], '', 'novel');
        expect(ctx).toEqual({ mode: 'novel' });
    });

    test('reviewFeedback 截断到 3000 字符', () => {
        const longFeedback = 'x'.repeat(5000);
        const ctx = buildRetryContext(2, 'writer', {},
            { 'first-review': true }, [longFeedback], '', 'novel');
        expect(ctx.reviewFeedback.length).toBe(3000);
    });
});
