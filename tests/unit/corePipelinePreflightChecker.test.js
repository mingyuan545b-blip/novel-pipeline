/**
 * preflightChecker 单元测试
 * 覆盖：runPreflightChecks + _verifyConstraintAlignment
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    queryItems: jest.fn()
}));

jest.mock('../../server/services/pipeline/materialManagerCatchup', () => ({
    catchupMaterialManager: jest.fn()
}));

jest.mock('../../server/services/prompts/constraintInjector', () => ({
    buildConstraintInjection: jest.fn()
}));

jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const store = require('../../server/store');
const { catchupMaterialManager } = require('../../server/services/pipeline/materialManagerCatchup');
const { buildConstraintInjection } = require('../../server/services/prompts/constraintInjector');
const { runPreflightChecks } = require('../../server/core/pipeline/preflightChecker');

describe('preflightChecker.runPreflightChecks', () => {
    beforeEach(() => jest.clearAllMocks());

    test('chapter 不存在时直接返回', async () => {
        store.getItem.mockResolvedValue(null);
        await runPreflightChecks('p1', 'ch-1', jest.fn(), [], jest.fn());
        expect(catchupMaterialManager).not.toHaveBeenCalled();
    });

    test('chapter.chapterNumber <= 1 时直接返回', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-1', chapterNumber: 1 });
        await runPreflightChecks('p1', 'ch-1', jest.fn(), [], jest.fn());
        expect(catchupMaterialManager).not.toHaveBeenCalled();
    });

    test('正常流程：调用 catchupMaterialManager 并处理空素材', async () => {
        store.getItem.mockImplementation(async (table, id) => {
            if (table === 'chapters' && id === 'ch-2') return { id: 'ch-2', chapterNumber: 2, projectId: 'p1' };
            if (table === 'projects') return { id: 'p1' };
            return null;
        });
        store.queryItems.mockImplementation(async (table) => {
            if (table === 'chapters') return [{ id: 'ch-1', chapterNumber: 1 }];
            if (table === 'materials') return [
                { id: 'm1', name: 'M1', archived: false, currentContent: '   ', initialContent: 'initial content long enough' }
            ];
            return [];
        });
        buildConstraintInjection.mockResolvedValue('');

        const onStep = jest.fn();
        await runPreflightChecks('p1', 'ch-2', jest.fn(), [], onStep);

        expect(catchupMaterialManager).toHaveBeenCalled();
        expect(store.setItem).toHaveBeenCalledWith('materials', 'm1', expect.objectContaining({ currentContent: 'initial content long enough' }));
    });

    test('emptyMaterials：archived=true 时不回填', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-2', chapterNumber: 2, projectId: 'p1' });
        store.queryItems.mockImplementation(async (table) => {
            if (table === 'chapters') return [];
            if (table === 'materials') return [{ id: 'm1', archived: true, currentContent: '', initialContent: 'init' }];
            return [];
        });
        buildConstraintInjection.mockResolvedValue('');

        await runPreflightChecks('p1', 'ch-2', jest.fn(), [], jest.fn());

        expect(store.setItem).not.toHaveBeenCalledWith('materials', 'm1', expect.anything());
    });

    test('emptyMaterials：currentContent 有内容时不回填', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-2', chapterNumber: 2, projectId: 'p1' });
        store.queryItems.mockImplementation(async (table) => {
            if (table === 'chapters') return [];
            if (table === 'materials') return [{ id: 'm1', archived: false, currentContent: 'has content', initialContent: 'init' }];
            return [];
        });
        buildConstraintInjection.mockResolvedValue('');

        await runPreflightChecks('p1', 'ch-2', jest.fn(), [], jest.fn());

        expect(store.setItem).not.toHaveBeenCalledWith('materials', 'm1', expect.anything());
    });

    test('emptyMaterials：initialContent 短时不回填', async () => {
        store.getItem.mockResolvedValue({ id: 'ch-2', chapterNumber: 2, projectId: 'p1' });
        store.queryItems.mockImplementation(async (table) => {
            if (table === 'chapters') return [];
            if (table === 'materials') return [{ id: 'm1', archived: false, currentContent: '', initialContent: 'short' }];
            return [];
        });
        buildConstraintInjection.mockResolvedValue('');

        await runPreflightChecks('p1', 'ch-2', jest.fn(), [], jest.fn());

        expect(store.setItem).not.toHaveBeenCalledWith('materials', 'm1', expect.anything());
    });
});

describe('preflightChecker._verifyConstraintAlignment (通过 runPreflightChecks 间接测试)', () => {
    beforeEach(() => jest.clearAllMocks());

    test('project 无 povRule 时仍调用 buildConstraintInjection 但不进入 pov-lock 校验逻辑', async () => {
        store.getItem.mockImplementation(async (table, id) => {
            if (table === 'chapters' && id === 'ch-2') return { id: 'ch-2', chapterNumber: 2, projectId: 'p1' };
            if (table === 'projects') return { id: 'p1', styleProfile: {} };
            return null;
        });
        store.queryItems.mockResolvedValue([]);
        buildConstraintInjection.mockResolvedValue('');

        await expect(runPreflightChecks('p1', 'ch-2', jest.fn(), [], jest.fn())).resolves.toBeUndefined();

        // 源码先调用 buildConstraintInjection 两次再判断 hasPovRule，所以会调用
        expect(buildConstraintInjection).toHaveBeenCalledTimes(2);
    });

    test('project 有 povRule 且 writer/reviewer 都包含 pov-lock 时通过', async () => {
        store.getItem.mockImplementation(async (table, id) => {
            if (table === 'chapters' && id === 'ch-2') return { id: 'ch-2', chapterNumber: 2, projectId: 'p1' };
            if (table === 'projects') return { id: 'p1', styleProfile: { povRule: 'third-limited' } };
            return null;
        });
        store.queryItems.mockResolvedValue([]);
        buildConstraintInjection.mockResolvedValue('视角锁定: 第三人称');

        await runPreflightChecks('p1', 'ch-2', jest.fn(), [], jest.fn());

        expect(buildConstraintInjection).toHaveBeenCalledWith('p1', 'writer');
        expect(buildConstraintInjection).toHaveBeenCalledWith('p1', 'first-review');
    });

    test('writer 缺 pov-lock 时记录 error 但不抛出', async () => {
        store.getItem.mockImplementation(async (table, id) => {
            if (table === 'chapters' && id === 'ch-2') return { id: 'ch-2', chapterNumber: 2, projectId: 'p1' };
            if (table === 'projects') return { id: 'p1', styleProfile: { povRule: 'third-limited' } };
            return null;
        });
        store.queryItems.mockResolvedValue([]);
        buildConstraintSequence(['no-pov-here', '视角锁定: ok']);

        await expect(runPreflightChecks('p1', 'ch-2', jest.fn(), [], jest.fn())).resolves.toBeUndefined();
    });

    test('reviewer 缺 pov-lock 时记录 error 但不抛出', async () => {
        store.getItem.mockImplementation(async (table, id) => {
            if (table === 'chapters' && id === 'ch-2') return { id: 'ch-2', chapterNumber: 2, projectId: 'p1' };
            if (table === 'projects') return { id: 'p1', styleProfile: { povRule: 'third-limited' } };
            return null;
        });
        store.queryItems.mockResolvedValue([]);
        buildConstraintSequence(['视角锁定: ok', 'no-pov-here']);

        await expect(runPreflightChecks('p1', 'ch-2', jest.fn(), [], jest.fn())).resolves.toBeUndefined();
    });

    test('buildConstraintInjection 抛错时不传播', async () => {
        store.getItem.mockImplementation(async (table, id) => {
            if (table === 'chapters' && id === 'ch-2') return { id: 'ch-2', chapterNumber: 2, projectId: 'p1' };
            if (table === 'projects') return { id: 'p1', styleProfile: { povRule: 'third-limited' } };
            return null;
        });
        store.queryItems.mockResolvedValue([]);
        buildConstraintInjection.mockRejectedValue(new Error('constraint build failed'));

        await expect(runPreflightChecks('p1', 'ch-2', jest.fn(), [], jest.fn())).resolves.toBeUndefined();
    });

    test('pov-lock 通过 "pov-lock" 关键字识别（非"视角锁定"）', async () => {
        store.getItem.mockImplementation(async (table, id) => {
            if (table === 'chapters' && id === 'ch-2') return { id: 'ch-2', chapterNumber: 2, projectId: 'p1' };
            if (table === 'projects') return { id: 'p1', styleProfile: { povRule: 'first' } };
            return null;
        });
        store.queryItems.mockResolvedValue([]);
        buildConstraintInjection.mockResolvedValue('pov-lock: enabled');

        await expect(runPreflightChecks('p1', 'ch-2', jest.fn(), [], jest.fn())).resolves.toBeUndefined();
    });
});

function buildConstraintSequence(values) {
    buildConstraintInjection.mockImplementation(async (_proj, role) => {
        if (role === 'writer') return values[0];
        if (role === 'first-review') return values[1];
        return '';
    });
}
