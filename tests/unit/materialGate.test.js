/**
 * materialGate 单元测试（P1-4a 章节因果门槛）
 * 覆盖：evaluateGate 纯判定、债务出口、等待计算、assertChapterReady 补跑/标记/债务落盘。
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    queryItems: jest.fn()
}));
jest.mock('../../server/services/pipeline/materialManagerCatchup', () => ({
    catchupMaterialManager: jest.fn()
}));
jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const store = require('../../server/store');
const { catchupMaterialManager } = require('../../server/services/pipeline/materialManagerCatchup');
const {
    findGaps, evaluateGate, buildGateError, isGateError, computeWaitMs,
    assertChapterReady, DEBT_AFTER_MS, DEBT_MIN_RETRIES, GATE_WAIT_MAX_MS
} = require('../../server/services/pipeline/materialGate');

const ch = (n, status, extra = {}) => ({ id: `ch-${n}`, chapterNumber: n, status, ...extra });
const MU = 'material-updated';

describe('materialGate.evaluateGate（纯判定）', () => {
    test('第1章 / 章号缺失 → 直接放行', () => {
        expect(evaluateGate([], 1).ready).toBe(true);
        expect(evaluateGate([], 0).ready).toBe(true);
        expect(evaluateGate([], undefined).ready).toBe(true);
    });

    test('前序章节全部 material-updated → 放行', () => {
        const chapters = [ch(1, MU), ch(2, MU), ch(3, MU)];
        const r = evaluateGate(chapters, 4);
        expect(r.ready).toBe(true);
        expect(r.blockedBy).toEqual([]);
        expect(r.report).toContain('已全部归档');
    });

    test('前序有 failed-skipped → 拦截，blockedBy 准确、report 指名', () => {
        const chapters = [ch(1, MU), ch(2, 'failed-skipped'), ch(3, 'outlined')];
        const r = evaluateGate(chapters, 4);
        expect(r.ready).toBe(false);
        expect(r.blockedBy.map(g => g.chapterNumber)).toEqual([2, 3]);
        expect(r.report).toContain('第4章等待');
        expect(r.report).toContain('第2章素材未归档');
        expect(r.report).toContain('共2章缺口');
    });

    test('只检查前序，不误伤自身与后续章节', () => {
        const chapters = [ch(1, MU), ch(2, MU), ch(3, 'outlined'), ch(4, 'outlined')];
        expect(evaluateGate(chapters, 3).ready).toBe(true);
        expect(findGaps(chapters, 3)).toEqual([]);
    });

    test('缺口章冷却中 → earliestResumeAt 取最小 skipUntil', () => {
        const now = 1_000_000;
        const chapters = [ch(1, 'cooldown-waiting', { skipUntil: now + 60000 })];
        const r = evaluateGate(chapters, 2, now);
        expect(r.ready).toBe(false);
        expect(r.earliestResumeAt).toBe(now + 60000);
    });

    test('债务出口①：approved 且素材补跑连续失败 → 带债放行', () => {
        const chapters = [ch(1, 'approved', { materialManagerFailed: true, _matManagerRetries: DEBT_MIN_RETRIES })];
        const r = evaluateGate(chapters, 2);
        expect(r.ready).toBe(true);
        expect(r.debt.blockedChapters).toEqual([1]);
        expect(r.debt.reason).toContain('补跑连续失败');
    });

    test('债务出口②：缺口持续超阈值 → 带债放行', () => {
        const now = 10_000_000;
        const chapters = [ch(1, 'failed-skipped', { _gateBlockedSince: now - DEBT_AFTER_MS - 1 })];
        const r = evaluateGate(chapters, 2, now);
        expect(r.ready).toBe(true);
        expect(r.debt.reason).toContain('持续超');
    });

    test('缺口刚出现（未超时、补跑未耗尽）→ 不放行、无债务', () => {
        const now = 10_000_000;
        const chapters = [ch(1, 'failed-skipped', { _gateBlockedSince: now - 1000, _matManagerRetries: 1 })];
        const r = evaluateGate(chapters, 2, now);
        expect(r.ready).toBe(false);
        expect(r.debt).toBeNull();
    });
});

describe('materialGate 工具函数', () => {
    test('buildGateError / isGateError 可识别门槛错误', () => {
        const err = buildGateError('第2章等待');
        expect(isGateError(err)).toBe(true);
        expect(isGateError(new Error('other'))).toBe(false);
        expect(isGateError(null)).toBe(false);
        expect(err.message).toContain('门槛未通过');
    });

    test('computeWaitMs 夹在 [5s, 120s]', () => {
        const now = 1000;
        expect(computeWaitMs({ earliestResumeAt: now + 1000 }, now)).toBe(5000);
        expect(computeWaitMs({ earliestResumeAt: now + GATE_WAIT_MAX_MS * 10 }, now)).toBe(GATE_WAIT_MAX_MS);
        expect(computeWaitMs(null, now)).toBe(15000);
    });
});

describe('materialGate.assertChapterReady（补跑 / 标记 / 债务）', () => {
    beforeEach(() => jest.clearAllMocks());

    test('缺口章为 approved → 先补跑，归档后放行并记 repaired', async () => {
        const chapters = [ch(1, 'approved', { materialManagerFailed: true })];
        store.queryItems
            .mockResolvedValueOnce([...chapters])
            .mockResolvedValueOnce([ch(1, MU)]);
        catchupMaterialManager.mockResolvedValue(undefined);

        const r = await assertChapterReady({ projectId: 'p1', chapterNumber: 2, runPipelineStep: jest.fn() });

        expect(catchupMaterialManager).toHaveBeenCalledTimes(1);
        expect(r.ready).toBe(true);
        expect(r.repaired).toEqual([{ chapterNumber: 1, ok: true, error: null }]);
    });

    test('补跑后仍缺 → 拦截 + 落 _gateBlockedSince（不静默）', async () => {
        const c1 = ch(1, 'approved', { materialManagerFailed: true });
        store.queryItems.mockResolvedValue([c1]);
        catchupMaterialManager.mockResolvedValue(undefined);

        const r = await assertChapterReady({ projectId: 'p1', chapterNumber: 2, runPipelineStep: jest.fn() });

        expect(r.ready).toBe(false);
        expect(r.repaired).toEqual([{ chapterNumber: 1, ok: false, error: '素材仍未归档' }]);
        expect(c1._gateBlockedSince).toBeGreaterThan(0);
        expect(c1._gateBlocks).toBe(1);
        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', c1);
    });

    test('冷却中的缺口章不触发补跑（非 approved）', async () => {
        store.queryItems.mockResolvedValue([ch(1, 'cooldown-waiting', { skipUntil: Date.now() + 60000 })]);

        const r = await assertChapterReady({ projectId: 'p1', chapterNumber: 2, runPipelineStep: jest.fn() });

        expect(catchupMaterialManager).not.toHaveBeenCalled();
        expect(r.ready).toBe(false);
    });

    test('债务出口 → 写 chapter.materialDebt 并放行', async () => {
        const c1 = ch(1, 'approved', { materialManagerFailed: true, _matManagerRetries: DEBT_MIN_RETRIES });
        const c2 = ch(2, 'outlined');
        store.queryItems.mockResolvedValue([c1, c2]);

        const r = await assertChapterReady({ projectId: 'p1', chapterNumber: 2, runPipelineStep: jest.fn() });

        expect(r.ready).toBe(true);
        expect(c2.materialDebt.blockedChapters).toEqual([1]);
        expect(c2.materialDebt.reason).toContain('补跑连续失败');
        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-2', c2);
    });

    test('persist=false（兜底网用）→ 不写任何数据', async () => {
        store.queryItems.mockResolvedValue([ch(1, 'failed-skipped')]);

        const r = await assertChapterReady({ projectId: 'p1', chapterNumber: 2, repair: false, persist: false });

        expect(r.ready).toBe(false);
        expect(store.setItem).not.toHaveBeenCalled();
        expect(catchupMaterialManager).not.toHaveBeenCalled();
    });

    test('缺口消解 → 清理历史 _gateBlockedSince', async () => {
        const c1 = ch(1, MU, { _gateBlockedSince: 123 });
        store.queryItems.mockResolvedValue([c1]);

        const r = await assertChapterReady({ projectId: 'p1', chapterNumber: 2, repair: false });

        expect(r.ready).toBe(true);
        expect(c1._gateBlockedSince).toBeUndefined();
        expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', c1);
    });
});
