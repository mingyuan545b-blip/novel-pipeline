/**
 * llmBudgetGuard.test.js — LLM 调用层预算闸门单测
 *
 * 覆盖：项目归属解析（显式参数 > 运行上下文 > 无）、begin 的断言传播、
 *      record 的 usage→记账参数换算、异常吞掉不影响生成。
 * 对应工单：docs/worklog/2026-09-30-P0兜底四件套.md（P0-2 闸门必须覆盖
 *   绕过 agentRunner 的调用方，如 outlineGenerator 直连 llm.chat）
 */
'use strict';

const mockAssert = jest.fn(async () => ({ status: 'ok' }));
const mockRecordSpend = jest.fn(async () => ({ tokens: 1 }));

jest.mock('../../server/services/pipeline/projectBudget', () => ({
    assertProjectBudget: (...a) => mockAssert(...a),
    recordSpend: (...a) => mockRecordSpend(...a),
}));

const { runWithContext } = require('../../server/shared/runContext');
const guard = require('../../server/services/pipeline/llmBudgetGuard');

beforeEach(() => { jest.clearAllMocks(); });

describe('resolveProjectId', () => {
    test('显式 options.projectId 优先', () => {
        expect(guard.resolveProjectId({ projectId: 'p1' })).toBe('p1');
    });

    test('无显式项目时回落流水线运行上下文', () => {
        const got = runWithContext({ projectId: 'p-ctx' }, () => guard.resolveProjectId({}));
        expect(got).toBe('p-ctx');
    });

    test('上下文里也没有则返回 null（诊断/评测类调用不参与预算）', () => {
        expect(guard.resolveProjectId({})).toBeNull();
        expect(guard.resolveProjectId(undefined)).toBeNull();
    });

    test('skipBudgetGuard 显式跳出（testConnection 用）', () => {
        const got = runWithContext({ projectId: 'p-ctx' }, () => guard.resolveProjectId({ skipBudgetGuard: true }));
        expect(got).toBeNull();
    });
});

describe('begin（解析 + 断言一步到位）', () => {
    test('有项目时执行断言并返回 projectId', async () => {
        await expect(guard.begin({ projectId: 'p1' })).resolves.toBe('p1');
        expect(mockAssert).toHaveBeenCalledWith('p1');
    });

    test('无项目时不触发断言', async () => {
        await expect(guard.begin({})).resolves.toBeNull();
        expect(mockAssert).not.toHaveBeenCalled();
    });

    test('预算超限错误必须向上抛（不能被吞成普通告警）', async () => {
        mockAssert.mockRejectedValueOnce(Object.assign(new Error('超限'), { isBudgetExceeded: true }));
        await expect(guard.begin({ projectId: 'p1' })).rejects.toThrow('超限');
    });

    test('非预算类异常只告警不阻断（记账/查询故障不能变成生成事故）', async () => {
        mockAssert.mockRejectedValueOnce(new Error('db down'));
        await expect(guard.begin({ projectId: 'p1' })).resolves.toBe('p1');
    });
});

describe('record', () => {
    test('把 LLM usage 换算成记账参数', async () => {
        await guard.record('p1', {
            model: 'qwen3.8-flash', step: 'writer',
            usage: { total_tokens: 1234, prompt_tokens: 1000, completion_tokens: 234 },
        });
        expect(mockRecordSpend).toHaveBeenCalledWith('p1', {
            tokens: 1234, promptTokens: 1000, completionTokens: 234, model: 'qwen3.8-flash', step: 'writer',
        });
    });

    test('无 projectId 时不记账', async () => {
        await guard.record(null, { usage: { total_tokens: 1 } });
        expect(mockRecordSpend).not.toHaveBeenCalled();
    });

    test('记账失败被吞掉，不影响调用方', async () => {
        mockRecordSpend.mockRejectedValueOnce(new Error('write failed'));
        await expect(guard.record('p1', { usage: { total_tokens: 1 } })).resolves.toBeNull();
    });
});
