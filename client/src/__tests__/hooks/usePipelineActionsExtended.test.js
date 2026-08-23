import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@tanstack/react-query', () => ({
    useMutation: vi.fn((_opts) => {
        const mutateAsync = vi.fn();
        return { mutateAsync, mutate: vi.fn(), isLoading: false };
    }),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../services/api', () => ({
    pipelineApi: {
        runFull: vi.fn().mockResolvedValue({ data: { projectId: 'p1' } }),
        runStep: vi.fn().mockResolvedValue({ data: { projectId: 'p1' } }),
        supplementOutlines: vi.fn().mockResolvedValue({ data: {} }),
        rerunMaterialManager: vi.fn().mockResolvedValue({ data: {} }),
        toggleMaterialLock: vi.fn().mockResolvedValue({ data: {} }),
        setVolumeSubplane: vi.fn().mockResolvedValue({ data: {} }),
        generateSubplaneMaterials: vi.fn().mockResolvedValue({ data: {} }),
        clearChaptersAfter: vi.fn().mockResolvedValue({ data: {} }),
        generateImages: vi.fn().mockResolvedValue({ data: {} }),
        resetChapterContent: vi.fn().mockResolvedValue({ data: {} }),
        resetChaptersBulk: vi.fn().mockResolvedValue({ data: {} }),
        testAgentModel: vi.fn().mockResolvedValue({ data: {} }),
        syncHookBudget: vi.fn().mockResolvedValue({ data: {} }),
        extractRuleStack: vi.fn().mockResolvedValue({ data: {} }),
        registerHook: vi.fn().mockResolvedValue({ data: {} }),
    },
    chapterAuditApi: {
        repair: vi.fn().mockResolvedValue({ data: {} }),
        batchRepair: vi.fn().mockResolvedValue({ data: {} }),
    },
    projectsApi: {
        saveTargets: vi.fn().mockResolvedValue({ data: {} }),
        testConnection: vi.fn().mockResolvedValue({ data: {} }),
    },
}));

vi.mock('./usePipelineStatus', () => ({
    PIPELINE_KEYS: {
        injectionMap: vi.fn().mockReturnValue(['injection-map']),
        chapterImages: vi.fn().mockReturnValue(['chapter-images']),
        outputPaths: vi.fn().mockReturnValue(['output-paths']),
    },
}));

describe('usePipelineActions', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('useRunPipeline returns mutation', async () => {
        const { useRunPipeline } = await import('../../hooks/queries/usePipelineActions');
        const result = useRunPipeline();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useRunSingleChapter returns mutation', async () => {
        const { useRunSingleChapter } = await import('../../hooks/queries/usePipelineActions');
        const result = useRunSingleChapter();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useRetryChapter returns mutation', async () => {
        const { useRetryChapter } = await import('../../hooks/queries/usePipelineActions');
        const result = useRetryChapter();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useBatchRetryChapters returns mutation', async () => {
        const { useBatchRetryChapters } = await import('../../hooks/queries/usePipelineActions');
        const result = useBatchRetryChapters();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useSupplementOutlines returns mutation', async () => {
        const { useSupplementOutlines } = await import('../../hooks/queries/usePipelineActions');
        const result = useSupplementOutlines();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useRerunMaterialManager returns mutation', async () => {
        const { useRerunMaterialManager } = await import('../../hooks/queries/usePipelineActions');
        const result = useRerunMaterialManager();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useToggleMaterialLock returns mutation', async () => {
        const { useToggleMaterialLock } = await import('../../hooks/queries/usePipelineActions');
        const result = useToggleMaterialLock();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useSetVolumeSubplane returns mutation', async () => {
        const { useSetVolumeSubplane } = await import('../../hooks/queries/usePipelineActions');
        const result = useSetVolumeSubplane();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useGenerateSubplaneMaterials returns mutation', async () => {
        const { useGenerateSubplaneMaterials } = await import('../../hooks/queries/usePipelineActions');
        const result = useGenerateSubplaneMaterials();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useClearChaptersAfter returns mutation', async () => {
        const { useClearChaptersAfter } = await import('../../hooks/queries/usePipelineActions');
        const result = useClearChaptersAfter();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useResetChapterContent returns mutation', async () => {
        const { useResetChapterContent } = await import('../../hooks/queries/usePipelineActions');
        const result = useResetChapterContent();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useResetChaptersBulk returns mutation', async () => {
        const { useResetChaptersBulk } = await import('../../hooks/queries/usePipelineActions');
        const result = useResetChaptersBulk();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useRunStep returns mutation', async () => {
        const { useRunStep } = await import('../../hooks/queries/usePipelineActions');
        const result = useRunStep();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useRunFullPipeline returns mutation', async () => {
        const { useRunFullPipeline } = await import('../../hooks/queries/usePipelineActions');
        const result = useRunFullPipeline();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useRepairChapter returns mutation', async () => {
        const { useRepairChapter } = await import('../../hooks/queries/usePipelineActions');
        const result = useRepairChapter();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useBatchRepairChapters returns mutation', async () => {
        const { useBatchRepairChapters } = await import('../../hooks/queries/usePipelineActions');
        const result = useBatchRepairChapters();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useSaveProjectTargets returns mutation', async () => {
        const { useSaveProjectTargets } = await import('../../hooks/queries/usePipelineActions');
        const result = useSaveProjectTargets('p1');
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useTestAgentConnection returns mutation', async () => {
        const { useTestAgentConnection } = await import('../../hooks/queries/usePipelineActions');
        const result = useTestAgentConnection();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useTestAgentModel returns mutation', async () => {
        const { useTestAgentModel } = await import('../../hooks/queries/usePipelineActions');
        const result = useTestAgentModel();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useSyncHookBudget returns mutation', async () => {
        const { useSyncHookBudget } = await import('../../hooks/queries/usePipelineActions');
        const result = useSyncHookBudget('p1');
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useExtractRuleStack returns mutation', async () => {
        const { useExtractRuleStack } = await import('../../hooks/queries/usePipelineActions');
        const result = useExtractRuleStack('p1');
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useRegisterHook returns mutation', async () => {
        const { useRegisterHook } = await import('../../hooks/queries/usePipelineActions');
        const result = useRegisterHook('p1');
        expect(result.mutateAsync).toBeTypeOf('function');
    });
});
