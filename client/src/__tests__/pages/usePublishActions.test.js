import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/api', () => ({
    publishApi: {
        multiCheckLogin: vi.fn(),
        multiOpenWriter: vi.fn(),
        multiOpenEditor: vi.fn(),
        multiPublish: vi.fn(),
        multiStop: vi.fn(),
        multiUpdate: vi.fn(),
        multiCloseBrowser: vi.fn(),
        addAccount: vi.fn(),
        deleteAccount: vi.fn(),
        verifyAccount: vi.fn(),
        updateAccount: vi.fn(),
        addToQueue: vi.fn(),
        batchAddToQueue: vi.fn(),
        updateQueueItem: vi.fn(),
        deleteQueueItem: vi.fn(),
        formatContent: vi.fn(),
        addInteraction: vi.fn(),
        updateInteraction: vi.fn(),
        deleteInteraction: vi.fn(),
    }
}));

vi.mock('../../shared/logger', () => ({
    default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

const mockState = {
    currentProject: { id: 'proj-1' },
    multiConfigs: {
        fanqie: { cdpUrl: 'http://cdp:9222', bookId: 'book-1' },
        qimao: { cdpUrl: 'http://cdp:9223', bookId: '' },
    },
    setLoginResults: vi.fn(fn => fn),
    setUpdatePlatform: vi.fn(),
    setUpdateChapterInput: vi.fn(),
    setUpdateRangeStart: vi.fn(),
    setUpdateRangeEnd: vi.fn(),
    setShowUpdateDialog: vi.fn(),
    updatePlatform: 'fanqie',
    updateChapterInput: '1,2,3',
    updateRangeStart: '',
    updateRangeEnd: '',
    newAccount: { platformId: 'fanqie', penName: 'test' },
    setNewAccount: vi.fn(),
    setShowAddAccount: vi.fn(),
    refreshData: vi.fn(),
    platforms: [{ id: 'fanqie', url: 'https://fanqie.com' }],
    batchConfig: { platformAccountId: 'acc-1', scheduleInterval: 30 },
    accounts: [{ id: 'acc-1', platformName: '番茄小说' }],
    chapters: [{ id: 'ch-1', chapterNumber: 1, title: 'Ch1', content: 'text' }],
    queue: [],
    newInteraction: { platformName: 'fanqie', type: 'comment' },
    setNewInteraction: vi.fn(),
    setShowAddInteraction: vi.fn(),
};

describe('usePublishActions', () => {
    let usePublishActions;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import('../../pages/publish/usePublishActions');
        usePublishActions = mod.usePublishActions;
    });

    test('returns all action categories', () => {
        const actions = usePublishActions(mockState);
        expect(actions.handleCheckLogin).toBeTypeOf('function');
        expect(actions.handleAddAccount).toBeTypeOf('function');
        expect(actions.handleAddToQueue).toBeTypeOf('function');
        expect(actions.handleAddInteraction).toBeTypeOf('function');
    });

    test('handleMultiUpdate sets platform and shows dialog', () => {
        const actions = usePublishActions(mockState);
        actions.handleMultiUpdate('fanqie');
        expect(mockState.setUpdatePlatform).toHaveBeenCalledWith('fanqie');
        expect(mockState.setShowUpdateDialog).toHaveBeenCalledWith(true);
    });

    test('handleMultiUpdate alerts without project', () => {
        const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        const actions = usePublishActions({ ...mockState, currentProject: null });
        actions.handleMultiUpdate('fanqie');
        expect(alertSpy).toHaveBeenCalled();
        alertSpy.mockRestore();
    });

    test('handleOpenPlatform opens url if found', () => {
        const openSpy = vi.spyOn(globalThis, 'open').mockImplementation(() => {});
        const actions = usePublishActions(mockState);
        actions.handleOpenPlatform({ platformId: 'fanqie' });
        expect(openSpy).toHaveBeenCalledWith('https://fanqie.com', '_blank');
        openSpy.mockRestore();
    });

    test('handleOpenPlatform does nothing if no platform', () => {
        const openSpy = vi.spyOn(globalThis, 'open').mockImplementation(() => {});
        const actions = usePublishActions(mockState);
        actions.handleOpenPlatform({ platformId: 'unknown' });
        expect(openSpy).not.toHaveBeenCalled();
        openSpy.mockRestore();
    });

    test('confirmMultiUpdate alerts when no valid chapters', async () => {
        const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        const state = { ...mockState, updateChapterInput: '', updateRangeStart: '', updateRangeEnd: '' };
        const actions = usePublishActions(state);
        await actions.confirmMultiUpdate();
        expect(alertSpy).toHaveBeenCalledWith('未输入有效章节号');
        alertSpy.mockRestore();
    });

    test('handleMultiPublish alerts without project', () => {
        const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        const actions = usePublishActions({ ...mockState, currentProject: null });
        actions.handleMultiPublish('fanqie');
        expect(alertSpy).toHaveBeenCalled();
        alertSpy.mockRestore();
    });

    test('handleAddAccount returns without project', async () => {
        const { publishApi } = await import('../../services/api');
        const actions = usePublishActions({ ...mockState, currentProject: null });
        await actions.handleAddAccount();
        expect(publishApi.addAccount).not.toHaveBeenCalled();
    });

    test('handleAddInteraction returns without project', async () => {
        const { publishApi } = await import('../../services/api');
        const actions = usePublishActions({ ...mockState, currentProject: null });
        await actions.handleAddInteraction();
        expect(publishApi.addInteraction).not.toHaveBeenCalled();
    });

    test('handleAddToQueue alerts without platform account', async () => {
        const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        const actions = usePublishActions({ ...mockState, batchConfig: { platformAccountId: null } });
        await actions.handleAddToQueue({ id: 'ch-1', chapterNumber: 1, title: 'Ch1', content: 'text' });
        expect(alertSpy).toHaveBeenCalled();
        alertSpy.mockRestore();
    });

    test('handleBatchAdd alerts without platform account', async () => {
        const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        const actions = usePublishActions({ ...mockState, batchConfig: { platformAccountId: null } });
        await actions.handleBatchAdd();
        expect(alertSpy).toHaveBeenCalled();
        alertSpy.mockRestore();
    });
});
