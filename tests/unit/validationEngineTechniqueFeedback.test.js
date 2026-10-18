/**
 * 技法结果回写单测（A4）
 * F4：recordTechniqueResult 全仓 0 调用点 → 209/224 技法 attempts=0、"自动禁用"名存实亡。
 * 新增 recordTechniqueResults 批量回写，由 pipeline 审核反馈路径调用。
 * 见 docs/worklog/2026-10-17-假成果审查-问题统计.md
 */
jest.mock('../../server/services/techIndex', () => ({
    getTechnique: jest.fn(),
    reload: jest.fn(async () => {}),
}));
jest.mock('../../server/services/libraryStore', () => ({
    updateMeta: jest.fn(async () => ({ id: 't1' })),
}));

const techIndex = require('../../server/services/techIndex');
const libraryStore = require('../../server/services/libraryStore');
const { ValidationEngine } = require('../../server/services/validationEngine');

describe('ValidationEngine.recordTechniqueResults（F4 修复）', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        libraryStore.updateMeta.mockResolvedValue({ id: 'ok' });
        techIndex.reload.mockResolvedValue();
    });

    test('成功：attempts+1、成功率上滑、回写并 reload 一次', async () => {
        techIndex.getTechnique.mockReturnValue({ id: 't1', attempts: 0, success_rate: 50 });
        const updated = await new ValidationEngine().recordTechniqueResults(['t1'], true);
        expect(updated).toBe(1);
        expect(libraryStore.updateMeta).toHaveBeenCalledWith('t1', expect.objectContaining({ attempts: 1, success_rate: 100 }));
        expect(techIndex.reload).toHaveBeenCalledTimes(1);
    });

    test('未知技法跳过，不写库', async () => {
        techIndex.getTechnique.mockReturnValue(undefined);
        const updated = await new ValidationEngine().recordTechniqueResults(['nope'], true);
        expect(updated).toBe(0);
        expect(libraryStore.updateMeta).not.toHaveBeenCalled();
        expect(techIndex.reload).not.toHaveBeenCalled();
    });

    test('连续低效达阈值 → auto_disabled 置位', async () => {
        techIndex.getTechnique.mockReturnValue({ id: 't1', attempts: 4, success_rate: 10 });
        await new ValidationEngine().recordTechniqueResults(['t1'], false);
        const patch = libraryStore.updateMeta.mock.calls[0][1];
        expect(patch.attempts).toBe(5);
        expect(patch.auto_disabled).toBe(true);
    });

    test('空列表短路', async () => {
        expect(await new ValidationEngine().recordTechniqueResults([], true)).toBe(0);
        expect(libraryStore.updateMeta).not.toHaveBeenCalled();
    });
});
