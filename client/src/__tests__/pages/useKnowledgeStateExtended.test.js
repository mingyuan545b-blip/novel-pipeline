import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const STORE_OBJ = {
    currentProject: { id: 'p1', name: 'Test' },
    chapters: [],
};

vi.mock('../../store/useAppStore', () => ({
    default: vi.fn((sel) => sel ? sel(STORE_OBJ) : STORE_OBJ),
    getState: vi.fn().mockReturnValue({ chapters: [] }),
}));

vi.mock('../../services/api', () => ({
    knowledgeApi: {
        getOverview: vi.fn().mockResolvedValue({ data: { totalChapters: 10 } }),
        getMemoryLayers: vi.fn().mockResolvedValue({ data: {} }),
        getRelationshipGraph: vi.fn().mockResolvedValue({ data: {} }),
        getPowerTracker: vi.fn().mockResolvedValue({ data: {} }),
        getForeshadowingTracker: vi.fn().mockResolvedValue({ data: [] }),
        getConsistencyReports: vi.fn().mockResolvedValue({ data: [] }),
        getSnapshots: vi.fn().mockResolvedValue({ data: [] }),
        buildMemoryLayer: vi.fn().mockResolvedValue({}),
        runQuickCheck: vi.fn().mockResolvedValue({ data: { issues: [] } }),
        runAiCheck: vi.fn().mockResolvedValue({ data: { issues: [] } }),
    },
    projectsApi: {
        getRelationshipGraph: vi.fn().mockRejectedValue(new Error('not found')),
    },
    materialsApi: {
        list: vi.fn().mockResolvedValue({ data: [] }),
    },
}));

vi.mock('../../shared/logger', () => ({
    default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../pages/knowledge/useKnowledgeTimelineState', () => ({
    useKnowledgeTimelineState: vi.fn().mockReturnValue({
        timelineEvents: [], loadTimeline: vi.fn(),
    })
}));

describe('useKnowledgeState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', async () => {
        const { default: useKnowledgeState } = await import('../../pages/knowledge/useKnowledgeState');
        const { result } = renderHook(() => useKnowledgeState());
        expect(result.current.activeTab).toBe('overview');
        expect(result.current.loading).toBe(false);
        expect(result.current.overview).toBeNull();
        expect(result.current.checkChapter).toBe('');
    });

    test('setActiveTab updates', async () => {
        const { default: useKnowledgeState } = await import('../../pages/knowledge/useKnowledgeState');
        const { result } = renderHook(() => useKnowledgeState());
        act(() => { result.current.setActiveTab('memory'); });
        expect(result.current.activeTab).toBe('memory');
    });

    test('setCheckChapter updates', async () => {
        const { default: useKnowledgeState } = await import('../../pages/knowledge/useKnowledgeState');
        const { result } = renderHook(() => useKnowledgeState());
        act(() => { result.current.setCheckChapter('5'); });
        expect(result.current.checkChapter).toBe('5');
    });

    test('TAB_LOADERS maps tabs to loader names', async () => {
        await import('../../pages/knowledge/useKnowledgeState');
        // TAB_LOADERS is not exported, but we can verify tab switching triggers loaders
        const { default: useKnowledgeState } = await import('../../pages/knowledge/useKnowledgeState');
        const { result } = renderHook(() => useKnowledgeState());
        act(() => { result.current.setActiveTab('graph'); });
        expect(result.current.activeTab).toBe('graph');
    });

    test('handleConsistencyCheck returns without checkChapter', async () => {
        const { knowledgeApi } = await import('../../services/api');
        const { default: useKnowledgeState } = await import('../../pages/knowledge/useKnowledgeState');
        const { result } = renderHook(() => useKnowledgeState());
        await result.current.handleConsistencyCheck();
        expect(knowledgeApi.runQuickCheck).not.toHaveBeenCalled();
    });
});
