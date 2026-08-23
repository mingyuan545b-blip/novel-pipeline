import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const STORE_OBJ = {
    currentProject: { id: 'p1', name: 'Test', mode: 'novel', genre: 'urban-fantasy', styleProfile: { genreId: 'urban-fantasy' } },
    chapters: [], pipelineState: { logs: [], running: false }, setPipelineState: vi.fn(),
    addPipelineLog: vi.fn(), clearPipelineLogs: vi.fn(),
};

vi.mock('../../store/useAppStore', () => ({
    default: vi.fn((sel) => sel ? sel(STORE_OBJ) : STORE_OBJ)
}));

vi.mock('react-router-dom', () => ({
    useSearchParams: vi.fn().mockReturnValue([new URLSearchParams()]),
}));

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn().mockReturnValue({ data: null }),
    useQueryClient: vi.fn(),
}));

vi.mock('../../hooks/queries', () => ({
    useChapters: vi.fn().mockReturnValue({ data: [], refetch: vi.fn() }),
    usePipelineStatus: vi.fn().mockReturnValue({ data: null }),
    useStartPipeline: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useStopPipeline: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useResetPipeline: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useMaterials: vi.fn().mockReturnValue({ data: [] }),
    useSupplementOutlines: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useRerunMaterialManager: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useToggleMaterialLock: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useSetVolumeSubplane: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useGenerateSubplaneMaterials: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useClearChaptersAfter: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useResetChapterContent: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useResetChaptersBulk: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useSaveProjectTargets: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useSyncHookBudget: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useExtractRuleStack: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useRegisterHook: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
}));

vi.mock('../../services/api', () => ({
    pipelineApi: { getPipelineLogs: vi.fn().mockResolvedValue({ data: { entries: [] } }) },
    genreDebugApi: { getConstraints: vi.fn().mockResolvedValue({ data: {} }) },
}));

vi.mock('../../shared/logger', () => ({
    default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../pages/pipeline/useInfinitePipeline', () => ({
    useInfinitePipeline: vi.fn().mockReturnValue({
        infiniteStatus: { running: false }, infiniteOptions: { chaptersPerBatch: 5 },
        setInfiniteOptions: vi.fn(), startInfinitePipeline: vi.fn(),
        stopInfinitePipeline: vi.fn(), forceResetPipeline: vi.fn(),
    })
}));

vi.mock('../../pages/pipeline/useAuditState', () => ({
    useAuditState: vi.fn().mockReturnValue({
        chapterAuditData: null, chapterAuditLoading: false,
        auditPage: 1, setAuditPage: vi.fn(), auditPageSize: 20,
        auditFilter: 'all', setAuditFilter: vi.fn(),
        expandedChapter: null, setExpandedChapter: vi.fn(),
        auditRun: { mutateAsync: vi.fn() },
    })
}));

vi.mock('../../pages/pipeline/useToolsState', () => ({
    useToolsState: vi.fn().mockReturnValue({
        contextBudgetInfo: null, injectionMapInfo: null,
        chapterIntentQuery: { refetch: vi.fn() }, setChapterIntentInfo: vi.fn(),
        injectionMapQuery: { refetch: vi.fn() }, setInjectionMapInfo: vi.fn(),
    })
}));

vi.mock('../../pages/pipeline/useAgentConfigState', () => ({
    useAgentConfigState: vi.fn().mockReturnValue({
        agentModelConfig: null, showAgentConfig: false, setShowAgentConfig: vi.fn(),
    })
}));

vi.mock('../../pages/pipeline/useOutputState', () => ({
    useOutputState: vi.fn().mockReturnValue({
        activeOutputTab: 'writerOutput', setActiveOutputTab: vi.fn(),
        outputPaths: {}, viewVersion: null, setViewVersion: vi.fn(), reviewLogs: [],
    })
}));

vi.mock('../../pages/pipeline/useFullPipelineHandler', () => ({
    useFullPipelineHandler: vi.fn().mockReturnValue({
        runStep: vi.fn(), runFullPipeline: vi.fn(),
        fullPipelineTaskId: null, fullPipelinePolling: false, fullPipelinePollErrors: [],
        runStepMut: { mutateAsync: vi.fn() }, runFullPipelineMut: { mutateAsync: vi.fn() },
    })
}));

describe('usePipelinePageState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state with all sections', async () => {
        const { default: usePipelinePageState } = await import('../../pages/pipeline/usePipelinePageState');
        const { result } = renderHook(() => usePipelinePageState());
        expect(result.current.currentProject).toBeDefined();
        expect(result.current.projectMode).toBe('novel');
        expect(result.current.pipelineSteps).toBeInstanceOf(Array);
        expect(result.current.outputTabs).toBeInstanceOf(Array);
        expect(result.current.selectedChapter).toBeNull();
        expect(result.current.infinite).toBeDefined();
        expect(result.current.audit).toBeDefined();
        expect(result.current.tools).toBeDefined();
        expect(result.current.output).toBeDefined();
        expect(result.current.chapterActions).toBeDefined();
    });

    test('chapterFilter defaults to all', async () => {
        const { default: usePipelinePageState } = await import('../../pages/pipeline/usePipelinePageState');
        const { result } = renderHook(() => usePipelinePageState());
        expect(result.current.chapterList.chapterFilter).toBe('all');
    });

    test('setChapterFilter updates', async () => {
        const { default: usePipelinePageState } = await import('../../pages/pipeline/usePipelinePageState');
        const { result } = renderHook(() => usePipelinePageState());
        act(() => { result.current.chapterList.setChapterFilter('written'); });
        expect(result.current.chapterList.chapterFilter).toBe('written');
    });

    test('chapterCollapsed defaults to false', async () => {
        const { default: usePipelinePageState } = await import('../../pages/pipeline/usePipelinePageState');
        const { result } = renderHook(() => usePipelinePageState());
        expect(result.current.chapterList.chapterCollapsed).toBe(false);
    });

    test('setChapterCollapsed toggles', async () => {
        const { default: usePipelinePageState } = await import('../../pages/pipeline/usePipelinePageState');
        const { result } = renderHook(() => usePipelinePageState());
        act(() => { result.current.chapterList.setChapterCollapsed(true); });
        expect(result.current.chapterList.chapterCollapsed).toBe(true);
    });

    test('projectTargets defaults to empty strings', async () => {
        const { default: usePipelinePageState } = await import('../../pages/pipeline/usePipelinePageState');
        const { result } = renderHook(() => usePipelinePageState());
        // Schema-First：统一使用标准字段名targetChapters
        expect(result.current.projectTargets.targetChapters).toBe('');
        expect(result.current.projectTargets.targetWordCount).toBe('');
    });

    test('genre section has expected shape', async () => {
        const { default: usePipelinePageState } = await import('../../pages/pipeline/usePipelinePageState');
        const { result } = renderHook(() => usePipelinePageState());
        expect(result.current.genre.genreId).toBe('urban-fantasy');
        expect(result.current.genre.genreConstraints).toEqual([]);
    });

    test('completedChapters defaults to 0', async () => {
        const { default: usePipelinePageState } = await import('../../pages/pipeline/usePipelinePageState');
        const { result } = renderHook(() => usePipelinePageState());
        expect(result.current.completedChapters).toBe(0);
    });
});
