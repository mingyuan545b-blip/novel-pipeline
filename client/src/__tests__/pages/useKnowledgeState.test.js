import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import useAppStore from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
    knowledgeApi: {
        getOverview: vi.fn(() => Promise.resolve({ data: { totalChapters: 5 } })),
        getMemoryLayers: vi.fn(() => Promise.resolve({ data: {} })),
        getRelationshipGraph: vi.fn(() => Promise.resolve({ data: {} })),
        getPowerTracker: vi.fn(() => Promise.resolve({ data: {} })),
        getForeshadowingTracker: vi.fn(() => Promise.resolve({ data: [] })),
        getConsistencyReports: vi.fn(() => Promise.resolve({ data: [] })),
        getSnapshots: vi.fn(() => Promise.resolve({ data: [] })),
        buildMemoryLayer: vi.fn(() => Promise.resolve({ data: {} })),
        runQuickCheck: vi.fn(() => Promise.resolve({ data: {} })),
        runAiCheck: vi.fn(() => Promise.resolve({ data: {} })),
    },
    projectsApi: {
        getRelationshipGraph: vi.fn(() => Promise.resolve({ data: {} })),
    },
    materialsApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
    },
}));

vi.mock('../../pages/knowledge/useKnowledgeTimelineState', () => ({
    useKnowledgeTimelineState: vi.fn(() => ({
        timelineData: [],
        loadTimeline: vi.fn(),
    })),
}));

import useKnowledgeState from '../../pages/knowledge/useKnowledgeState';

describe('useKnowledgeState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useAppStore.setState({
                currentProject: { id: 'p1', name: 'Test' },
            });
        });
    });

    test('returns initial state', () => {
        const { result } = renderHook(() => useKnowledgeState(), { wrapper: createWrapper() });
        expect(result.current.activeTab).toBe('overview');
        expect(result.current.loading).toBe(false);
    });

    test('sets active tab', () => {
        const { result } = renderHook(() => useKnowledgeState(), { wrapper: createWrapper() });
        act(() => { result.current.setActiveTab('memory'); });
        expect(result.current.activeTab).toBe('memory');
    });

    test('sets check chapter', () => {
        const { result } = renderHook(() => useKnowledgeState(), { wrapper: createWrapper() });
        act(() => { result.current.setCheckChapter('5'); });
        expect(result.current.checkChapter).toBe('5');
    });
});
