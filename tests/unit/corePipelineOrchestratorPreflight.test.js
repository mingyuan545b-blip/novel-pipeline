/**
 * orchestratorPreflight 单元测试
 * 覆盖：runPreflightChecks（含 material-manager 补跑 + emptyMaterials 回填）、
 *      handleChapterIntent、syncHooksAndRules
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    queryItems: jest.fn()
}));

jest.mock('../../server/services/chapterIntent', () => ({
    getChapterIntentPlanner: jest.fn()
}));

jest.mock('../../server/services/hookBudget', () => ({
    getHookBudgetForProject: jest.fn()
}));

jest.mock('../../server/services/ruleStack', () => ({
    getRuleStackForProject: jest.fn()
}));

jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const store = require('../../server/store');
const { getChapterIntentPlanner } = require('../../server/services/chapterIntent');
const { getHookBudgetForProject } = require('../../server/services/hookBudget');
const { getRuleStackForProject } = require('../../server/services/ruleStack');
const { runPreflightChecks, handleChapterIntent, syncHooksAndRules } = require('../../server/core/pipeline/orchestratorPreflight');

describe('orchestratorPreflight.runPreflightChecks', () => {
    beforeEach(() => jest.clearAllMocks());

    test('chapter 不存在时直接返回', async () => {
        store.getItem.mockResolvedValue(null);
        await runPreflightChecks('p1', 'ch-1', [], jest.fn(), jest.fn());
        expect(store.queryItems).not.toHaveBeenCalled();
    });

    test('chapter.chapterNumber <= 1 时直接返回', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 1 });
        await runPreflightChecks('p1', 'ch-1', [], jest.fn(), jest.fn());
        expect(store.queryItems).not.toHaveBeenCalled();
    });

    test('prevChapter 已 approved 但缺 materialManagerOutput 时补跑 material-manager', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-2', chapterNumber: 2, projectId: 'p1' });
        store.queryItems.mockImplementation(async (table) => {
            if (table === 'chapters') return [{ id: 'ch-1', chapterNumber: 1, status: 'approved' }];
            if (table === 'materials') return [];
            return [];
        });
        const runStepFn = jest.fn().mockResolvedValue({ passed: true, feedback: { summary: 'mm ok' } });
        const pipelineLog = [];
        const onStep = jest.fn();

        await runPreflightChecks('p1', 'ch-2', pipelineLog, onStep, runStepFn);

        expect(runStepFn).toHaveBeenCalledWith('p1', 'ch-1', 'material-manager', 1, { materialGuidance: '' });
        expect(pipelineLog).toContainEqual(expect.objectContaining({ step: 'material-manager-catchup' }));
        expect(onStep).toHaveBeenCalled();
    });

    test('material-manager 补跑失败 3 次后跳过', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-2', chapterNumber: 2, projectId: 'p1' });
        const prevCh = { id: 'ch-1', chapterNumber: 1, status: 'approved' };
        store.queryItems.mockImplementation(async (table) => {
            if (table === 'chapters') return [prevCh];
            return [];
        });
        const runStepFn = jest.fn().mockRejectedValue(new Error('mm failed'));
        await runPreflightChecks('p1', 'ch-2', [], jest.fn(), runStepFn);

        expect(prevCh._matManagerRetries).toBe(1);
        expect(prevCh.status).toBe('approved');
    });

    test('P1-4a：补跑连续失败达到阈值时不伪造 material-updated（保持缺口 + 标记）', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-2', chapterNumber: 2, projectId: 'p1' });
        const prevCh = { id: 'ch-1', chapterNumber: 1, status: 'approved', _matManagerRetries: 2 };
        store.queryItems.mockImplementation(async (table) => {
            if (table === 'chapters') return [prevCh];
            return [];
        });
        const runStepFn = jest.fn().mockRejectedValue(new Error('mm failed'));
        await runPreflightChecks('p1', 'ch-2', [], jest.fn(), runStepFn);

        expect(prevCh._matManagerRetries).toBe(3);
        expect(prevCh.status).toBe('approved');
        expect(prevCh.materialManagerFailed).toBe(true);
        expect(prevCh.status).not.toBe('material-updated');
        expect(prevCh.materialManagerOutput).toContain('未归档');
    });

    test('emptyMaterials：currentContent 空且 initialContent 长时回填', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-2', chapterNumber: 2, projectId: 'p1' });
        const m = { id: 'm1', name: 'M1', archived: false, currentContent: '', initialContent: 'long initial content' };
        store.queryItems.mockImplementation(async (table) => {
            if (table === 'chapters') return [];
            if (table === 'materials') return [m];
            return [];
        });

        await runPreflightChecks('p1', 'ch-2', [], jest.fn(), jest.fn());

        expect(m.currentContent).toBe('long initial content');
        expect(store.setItem).toHaveBeenCalledWith('materials', 'm1', m);
    });
});

describe('orchestratorPreflight.handleChapterIntent', () => {
    beforeEach(() => jest.clearAllMocks());

    test('已存在 intent 且 chapter 已有 intentPlannerOutput 时直接返回', async () => {
        const planner = { getIntent: jest.fn().mockResolvedValue({ id: 'i1' }), formatIntentForPrompt: jest.fn().mockResolvedValue('T'), generateIntent: jest.fn() };
        getChapterIntentPlanner.mockReturnValue(planner);
        store.getItem.mockResolvedValue({ id: 'ch-1', intentPlannerOutput: 'EXISTING' });
        const onStep = jest.fn();

        const result = await handleChapterIntent('p1', 'ch-1', 5, 'outline', { apiConfig: {} }, [], onStep);

        expect(result).toEqual({ id: 'i1' });
        expect(store.setItem).not.toHaveBeenCalled();
        expect(onStep).toHaveBeenCalled();
    });

    test('已存在 intent 但 chapter 无 intentPlannerOutput 时格式化并保存', async () => {
        const planner = { getIntent: jest.fn().mockResolvedValue({ id: 'i1' }), formatIntentForPrompt: jest.fn().mockResolvedValue('TEXT') };
        getChapterIntentPlanner.mockReturnValue(planner);
        const ch = { id: 'ch-1' };
        store.getItem.mockResolvedValue(ch);

        const result = await handleChapterIntent('p1', 'ch-1', 5, 'outline', { apiConfig: {} }, [], null);

        expect(result).toEqual({ id: 'i1' });
        expect(ch.intentPlannerOutput).toBe('TEXT');
        expect(store.setItem).toHaveBeenCalled();
    });

    test('formatIntentForPrompt 返回对象时 JSON.stringify', async () => {
        const obj = { a: 1 };
        const planner = { getIntent: jest.fn().mockResolvedValue({ id: 'i1' }), formatIntentForPrompt: jest.fn().mockResolvedValue(obj) };
        getChapterIntentPlanner.mockReturnValue(planner);
        const ch = { id: 'ch-1' };
        store.getItem.mockResolvedValue(ch);

        await handleChapterIntent('p1', 'ch-1', 5, 'outline', {}, [], null);

        expect(ch.intentPlannerOutput).toBe(JSON.stringify(obj));
    });

    test('intent 不存在时调用 generateIntent', async () => {
        const planner = {
            getIntent: jest.fn().mockResolvedValue(null),
            formatIntentForPrompt: jest.fn().mockResolvedValue('T'),
            generateIntent: jest.fn().mockResolvedValue({ id: 'gen' })
        };
        getChapterIntentPlanner.mockReturnValue(planner);
        const ch = { id: 'ch-1', scene: 'S' };
        store.getItem.mockResolvedValue(ch);

        const result = await handleChapterIntent('p1', 'ch-1', 5, 'outline', { apiConfig: { m: 'x' } }, [], null);

        expect(planner.generateIntent).toHaveBeenCalledWith(5, 'outline', { apiConfig: { m: 'x' }, scene: 'S' });
        expect(result).toEqual({ id: 'gen' });
    });

    test('异常时返回 null 并写 pipelineLog', async () => {
        const planner = { getIntent: jest.fn().mockRejectedValue(new Error('boom')), formatIntentForPrompt: jest.fn(), generateIntent: jest.fn() };
        getChapterIntentPlanner.mockReturnValue(planner);
        const pipelineLog = [];

        const result = await handleChapterIntent('p1', 'ch-1', 5, 'outline', {}, pipelineLog, null);

        expect(result).toBeNull();
        expect(pipelineLog.length).toBeGreaterThan(0);
    });
});

describe('orchestratorPreflight.syncHooksAndRules', () => {
    beforeEach(() => jest.clearAllMocks());

    test('正常调用 hookBudget.syncFromForeshadowingMaterials 和 ruleStack.extractRulesFromMaterials', async () => {
        const hookBudget = { syncFromForeshadowingMaterials: jest.fn().mockResolvedValue() };
        const ruleStack = { extractRulesFromMaterials: jest.fn().mockResolvedValue() };
        getHookBudgetForProject.mockReturnValue(hookBudget);
        getRuleStackForProject.mockReturnValue(ruleStack);

        await syncHooksAndRules('p1');

        expect(hookBudget.syncFromForeshadowingMaterials).toHaveBeenCalled();
        expect(ruleStack.extractRulesFromMaterials).toHaveBeenCalled();
    });

    test('hookBudget 异常时不抛出', async () => {
        const hookBudget = { syncFromForeshadowingMaterials: jest.fn().mockRejectedValue(new Error('hb err')) };
        const ruleStack = { extractRulesFromMaterials: jest.fn().mockResolvedValue() };
        getHookBudgetForProject.mockReturnValue(hookBudget);
        getRuleStackForProject.mockReturnValue(ruleStack);

        await expect(syncHooksAndRules('p1')).resolves.toBeUndefined();
    });

    test('ruleStack 异常时不抛出', async () => {
        const hookBudget = { syncFromForeshadowingMaterials: jest.fn().mockResolvedValue() };
        const ruleStack = { extractRulesFromMaterials: jest.fn().mockRejectedValue(new Error('rs err')) };
        getHookBudgetForProject.mockReturnValue(hookBudget);
        getRuleStackForProject.mockReturnValue(ruleStack);

        await expect(syncHooksAndRules('p1')).resolves.toBeUndefined();
    });
});
