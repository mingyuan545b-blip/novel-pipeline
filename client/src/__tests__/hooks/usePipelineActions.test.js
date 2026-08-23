import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useRunPipeline, useRunSingleChapter, useRetryChapter } from '../../hooks/queries/usePipelineActions';

vi.mock('../../services/api', () => ({
    pipelineApi: {
        runFull: vi.fn((d) => Promise.resolve({ data: { ...d, projectId: 'p1' } })),
        runStep: vi.fn((d) => Promise.resolve({ data: { ...d, projectId: 'p1' } })),
        startInfinite: vi.fn(() => Promise.resolve({ data: {} })),
        stopInfinite: vi.fn(() => Promise.resolve({ data: {} })),
        resetInfinite: vi.fn(() => Promise.resolve({ data: {} })),
        supplementOutlines: vi.fn(() => Promise.resolve({ data: {} })),
        rerunMaterialManager: vi.fn(() => Promise.resolve({ data: {} })),
        toggleMaterialLock: vi.fn(() => Promise.resolve({ data: {} })),
        setVolumeSubplane: vi.fn(() => Promise.resolve({ data: {} })),
        generateSubplaneMaterials: vi.fn(() => Promise.resolve({ data: {} })),
        clearChaptersAfter: vi.fn(() => Promise.resolve({ data: {} })),
        generateImages: vi.fn(() => Promise.resolve({ data: {} })),
        resetChapterContent: vi.fn(() => Promise.resolve({ data: {} })),
        resetChaptersBulk: vi.fn(() => Promise.resolve({ data: {} })),
        getTaskStatus: vi.fn(() => Promise.resolve({ data: {} })),
        syncHookBudget: vi.fn(() => Promise.resolve({ data: {} })),
        extractRuleStack: vi.fn(() => Promise.resolve({ data: {} })),
        registerHook: vi.fn(() => Promise.resolve({ data: {} })),
        testAgentModel: vi.fn(() => Promise.resolve({ data: {} })),
    },
    chapterAuditApi: {
        repair: vi.fn(() => Promise.resolve({ data: {} })),
        batchRepair: vi.fn(() => Promise.resolve({ data: {} })),
    },
    projectsApi: {
        saveTargets: vi.fn(() => Promise.resolve({ data: {} })),
        testConnection: vi.fn(() => Promise.resolve({ data: {} })),
    }
}));

describe('useRunPipeline', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('runs full pipeline', async () => {
        const { result } = renderHook(() => useRunPipeline(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ projectId: 'p1' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useRunSingleChapter', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('runs single chapter', async () => {
        const { result } = renderHook(() => useRunSingleChapter(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ chapterId: 'c1', projectId: 'p1' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useRetryChapter', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('retries a chapter', async () => {
        const { result } = renderHook(() => useRetryChapter(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ chapterId: 'c1', projectId: 'p1' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});
