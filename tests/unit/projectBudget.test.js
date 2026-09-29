/**
 * projectBudget.test.js — 项目级预算熔断单测
 *
 * 覆盖：单价匹配与成本估算、增量累加（纯函数）、记账→体检→断言的完整闭环、
 *      超限硬停抛错、limit=0 视为不限制、未启用时短路。
 * 对应工单：docs/worklog/2026-09-30-P0兜底四件套.md（P0-2 无预算硬停风险）
 */
'use strict';

jest.mock('../../server/services/pipeline/tokenLedger', () => ({}));

const mockStore = new Map();
jest.mock('../../server/store', () => ({
    getItem: jest.fn(async (type, id) => mockStore.get(type + ':' + id) || null),
    setItem: jest.fn(async (type, id, val) => { mockStore.set(type + ':' + id, val); return val; }),
    updateItem: jest.fn(async (type, id, fn) => {
        const cur = mockStore.get(type + ':' + id);
        if (!cur) return null;
        const next = fn({ ...cur });
        mockStore.set(type + ':' + id, next);
        return next;
    }),
}));

const projectBudget = require('../../server/services/pipeline/projectBudget');
const { BudgetExceededError } = projectBudget;

function putProject(id, budget) {
    mockStore.set('projects:' + id, { id, budget });
}

beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
});

describe('pricePerMtok / estimateCostCny', () => {
    test('按模型名子串匹配单价', () => {
        expect(projectBudget.pricePerMtok('qwen3.8-flash')).toBe(2);
        expect(projectBudget.pricePerMtok('QWEN-TURBO')).toBe(0.3);
    });
    test('未命中用保守兜底价（宁可高估，不可低估）', () => {
        expect(projectBudget.pricePerMtok('unknown-model')).toBe(2);
        expect(projectBudget.pricePerMtok(null)).toBe(2);
    });
    test('成本按 token 量线性换算', () => {
        expect(projectBudget.estimateCostCny('qwen3.8-flash', 1000000)).toBe(2);
        expect(projectBudget.estimateCostCny('qwen3.8-flash', 500000)).toBe(1);
        expect(projectBudget.estimateCostCny('qwen3.8-flash', 0)).toBe(0);
    });
});

describe('applyDelta（纯函数，不得修改入参）', () => {
    test('累加 tokens/成本/调用次数，并按模型与步骤分桶', () => {
        const cur = { tokens: 100, costCny: 0.2, calls: 1, byModel: { m1: 100 }, byStep: { writer: 100 } };
        const next = projectBudget.applyDelta(cur, { tokens: 50, model: 'm2', step: 'polisher', cost: 0.1 });
        expect(next.tokens).toBe(150);
        expect(next.calls).toBe(2);
        expect(next.costCny).toBeCloseTo(0.3, 4);
        expect(next.byModel).toEqual({ m1: 100, m2: 50 });
        expect(next.byStep).toEqual({ writer: 100, polisher: 50 });
        expect(cur.tokens).toBe(100); // 入参未被改动
    });
});

describe('recordSpend / checkProjectBudget 闭环', () => {
    test('首次记账自建记录，再次记账累加', async () => {
        await projectBudget.recordSpend('p1', { tokens: 1000, model: 'qwen3.8-flash', step: 'writer' });
        await projectBudget.recordSpend('p1', { tokens: 2000, model: 'qwen3.8-flash', step: 'polisher' });
        const spend = await projectBudget.getSpend('p1');
        expect(spend.tokens).toBe(3000);
        expect(spend.calls).toBe(2);
        expect(spend.costCny).toBeCloseTo(0.006, 4);
    });

    test('tokens<=0 或缺少 projectId 时不记账', async () => {
        expect(await projectBudget.recordSpend('p1', { tokens: 0 })).toBeNull();
        expect(await projectBudget.recordSpend(null, { tokens: 100 })).toBeNull();
        expect((await projectBudget.getSpend('p1')).tokens).toBe(0);
    });
});

describe('checkProjectBudget 状态机', () => {
    test('未设置限额 → unlimited', async () => {
        putProject('p1', {});
        await projectBudget.recordSpend('p1', { tokens: 999999 });
        expect((await projectBudget.checkProjectBudget('p1')).status).toBe('unlimited');
    });

    test('达到告警比例 → warn（不拦截）', async () => {
        putProject('p1', { tokenLimit: 1000, warnRatio: 0.8 });
        await projectBudget.recordSpend('p1', { tokens: 850 });
        const r = await projectBudget.checkProjectBudget('p1');
        expect(r.status).toBe('warn');
        expect(r.ratio).toBeCloseTo(0.85, 3);
    });

    test('超过限额 → exceeded', async () => {
        putProject('p1', { tokenLimit: 1000 });
        await projectBudget.recordSpend('p1', { tokens: 1200 });
        expect((await projectBudget.checkProjectBudget('p1')).status).toBe('exceeded');
    });

    test('成本上限与 token 上限取更严的那个', async () => {
        putProject('p1', { tokenLimit: 1000000, costLimitCny: 0.001 });
        await projectBudget.recordSpend('p1', { tokens: 1000, model: 'qwen3.8-flash' });
        // 1000 token → ¥0.002 > ¥0.001，即使 token 远未到上限也应超限
        expect((await projectBudget.checkProjectBudget('p1')).status).toBe('exceeded');
    });

    test('项目级 enabled=false 时短路为 disabled', async () => {
        putProject('p1', { enabled: false, tokenLimit: 1 });
        await projectBudget.recordSpend('p1', { tokens: 999999 });
        expect((await projectBudget.checkProjectBudget('p1')).status).toBe('disabled');
    });
});

describe('assertProjectBudget（硬停）', () => {
    test('超限且 hardStop → 抛 BudgetExceededError（带 code，上层不应重试）', async () => {
        putProject('p1', { tokenLimit: 100, hardStop: true });
        await projectBudget.recordSpend('p1', { tokens: 500 });
        await expect(projectBudget.assertProjectBudget('p1')).rejects.toThrow(BudgetExceededError);
        await expect(projectBudget.assertProjectBudget('p1')).rejects.toMatchObject({ code: 'BUDGET_EXCEEDED', isBudgetExceeded: true });
    });

    test('超限但 hardStop=false → 只观察不拦截', async () => {
        putProject('p1', { tokenLimit: 100, hardStop: false });
        await projectBudget.recordSpend('p1', { tokens: 500 });
        await expect(projectBudget.assertProjectBudget('p1')).resolves.toMatchObject({ status: 'exceeded' });
    });

    test('未超限 → 正常返回体检结果', async () => {
        putProject('p1', { tokenLimit: 10000 });
        await projectBudget.recordSpend('p1', { tokens: 100 });
        await expect(projectBudget.assertProjectBudget('p1')).resolves.toMatchObject({ status: 'ok' });
    });
});
