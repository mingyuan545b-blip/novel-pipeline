/**
 * materialStateAssembler（P1-4c 单点装配入口）单元测试
 * 覆盖：透传调度结果 / 附报告 / 记账一次且带报告 / blocked 缺口 ERROR 报警 / 记账失败不阻断
 */
jest.mock('../../server/services/pipeline/agentMaterialScheduler', () => ({ scheduleMaterials: jest.fn() }));
jest.mock('../../server/services/pipeline/contextAssemblyRecorder', () => ({ recordAssembly: jest.fn() }));
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { scheduleMaterials } = require('../../server/services/pipeline/agentMaterialScheduler');
const { recordAssembly } = require('../../server/services/pipeline/contextAssemblyRecorder');
const logger = require('../../server/shared/logger');
const { assembleMaterialState } = require('../../server/services/pipeline/materialStateAssembler');

const contextOf = (needs) => ({ materialNeeds: needs });
const need = (over = {}) => ({ type: 'character', detail: 'full', required: true, source: 'entity-center', ...over });

const mockScheduled = (context, materials = {}) => ({
    materials, constraints: { text: '约束' }, conflicts: [],
    stats: { agentType: 'writer', loaded: 1, actualChars: 10 },
    context, chapterNumber: 5,
});

beforeEach(() => {
    jest.clearAllMocks();
    recordAssembly.mockResolvedValue({});
});

describe('assembleMaterialState - 装配与记账', () => {
    test('透传调度器的结果并附加 report（gaps/provenance/density/summary）', async () => {
        scheduleMaterials.mockResolvedValue(mockScheduled(
            contextOf([need()]),
            { character: [{ name: '林三', content: 'x', depth: 'L3', materialId: 'm1', lastWriter: 'material-manager', lastUpdatedChapter: 4 }] }
        ));

        const res = await assembleMaterialState('writer', { projectId: 'p1', chapter: { chapterNumber: 5 } });

        expect(scheduleMaterials).toHaveBeenCalledWith('writer', { projectId: 'p1', chapter: { chapterNumber: 5 } });
        expect(res.materials.character).toHaveLength(1);
        expect(res.report.gaps).toEqual([]);
        expect(res.report.provenance[0]).toMatchObject({ materialId: 'm1', lastWriter: 'material-manager', lastUpdatedChapter: 4 });
        expect(res.report.density[0].type).toBe('character');
    });

    test('记账一次，且把 context + gaps/provenance/density 一并交给装配记录', async () => {
        scheduleMaterials.mockResolvedValue(mockScheduled(contextOf([need()]), { character: [{ name: 'a', content: 'x' }] }));

        await assembleMaterialState('writer', { projectId: 'p1', chapter: { chapterNumber: 5 } });

        expect(recordAssembly).toHaveBeenCalledTimes(1);
        const arg = recordAssembly.mock.calls[0][0];
        expect(arg).toMatchObject({ projectId: 'p1', agentType: 'writer', chapterNumber: 5 });
        expect(arg.context.materialNeeds).toHaveLength(1);
        expect(arg.report.provenance).toHaveLength(1);
        expect(arg.scheduled.report).toBe(arg.report);
    });
});

describe('assembleMaterialState - 缺口兜底报警', () => {
    test('必备类为 0 条 → ERROR 报警并点名类型（不再静默）', async () => {
        scheduleMaterials.mockResolvedValue(mockScheduled(contextOf([need(), need({ type: 'worldview' })]), {}));

        const res = await assembleMaterialState('writer', { projectId: 'p1', chapter: { chapterNumber: 5 } });

        expect(res.report.summary.gapBlocked).toBe(2);
        expect(logger.error).toHaveBeenCalled();
        const [, msg, meta] = logger.error.mock.calls[0];
        expect(msg).toContain('第5章必备素材缺失 2 类');
        expect(msg).toContain('character');
        expect(meta.gaps).toHaveLength(2);
    });

    test('声明未解析（materialNeeds 空）→ 记 context-unresolved 并报警', async () => {
        scheduleMaterials.mockResolvedValue({ ...mockScheduled(contextOf([]), {}), context: undefined });

        const res = await assembleMaterialState('writer', { projectId: 'p1', chapter: { chapterNumber: 5 } });

        expect(res.report.summary.blockedTypes).toEqual(['*']);
        expect(logger.error).toHaveBeenCalled();
    });

    test('全部齐备 → 不报 ERROR（避免告警疲劳）', async () => {
        scheduleMaterials.mockResolvedValue(mockScheduled(contextOf([need()]), { character: [{ name: 'a', content: 'x' }] }));

        await assembleMaterialState('writer', { projectId: 'p1', chapter: { chapterNumber: 5 } });

        expect(logger.error).not.toHaveBeenCalled();
    });

    test('chapterNumber 缺失时退化取 params.chapter', async () => {
        scheduleMaterials.mockResolvedValue({ ...mockScheduled(contextOf([need()]), {}), chapterNumber: undefined });

        await assembleMaterialState('reader', { projectId: 'p1', chapter: { chapterNumber: 9 } });

        expect(recordAssembly.mock.calls[0][0].chapterNumber).toBe(9);
    });
});

describe('assembleMaterialState - 记账失败不阻断', () => {
    test('recordAssembly 抛错 → 装配结果照常返回 + WARN', async () => {
        scheduleMaterials.mockResolvedValue(mockScheduled(contextOf([need()]), { character: [{ name: 'a', content: 'x' }] }));
        recordAssembly.mockRejectedValue(new Error('db down'));

        const res = await assembleMaterialState('writer', { projectId: 'p1', chapter: { chapterNumber: 5 } });

        expect(res.materials.character).toHaveLength(1);
        expect(logger.warn).toHaveBeenCalled();
    });

    test('调度器抛错 → 原样抛出（不吞错，交给上游重试/告警）', async () => {
        scheduleMaterials.mockRejectedValue(new Error('scheduler boom'));
        await expect(assembleMaterialState('writer', { projectId: 'p1', chapter: { chapterNumber: 5 } })).rejects.toThrow('scheduler boom');
        expect(recordAssembly).not.toHaveBeenCalled();
    });
});
