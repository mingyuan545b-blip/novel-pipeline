import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
    knowledgeApi: {
        getFacts: vi.fn(), getLayers: vi.fn(), getAccessRules: vi.fn(),
        getTimelineEvents: vi.fn(), getTimelineStats: vi.fn(),
        getCharacterTimeline: vi.fn(), getSnapshotDiff: vi.fn(),
        updateAccessRule: vi.fn(), createFact: vi.fn(), deleteFact: vi.fn(),
        getOverview: vi.fn(), getMemoryLayers: vi.fn(), getGraph: vi.fn(),
        getPowerData: vi.fn(), getForeshadowings: vi.fn(), getConsistencyReports: vi.fn(),
        getSnapshots: vi.fn(),
    },
    projectsApi: { get: vi.fn() },
    materialsApi: { list: vi.fn() },
}));

vi.mock('../../shared/logger', () => ({
    default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../../store/useAppStore', () => ({
    __esModule: true,
    default: vi.fn(() => ({ currentProject: { id: 'proj-1' } })),
}));

vi.mock('../../pages/knowledge/useKnowledgeTimelineState', () => ({
    useKnowledgeTimelineState: vi.fn(() => ({
        timelineEvents: [], timelineStats: null, timelineFilter: 'all',
        setTimelineFilter: vi.fn(), selectedCharId: null, charTimeline: [],
        snapshotDiff: null, loadTimeline: vi.fn(), handleCharTimeline: vi.fn(),
        handleSnapshotDiff: vi.fn(),
    })),
}));

import useKnowledgeState from '../../pages/knowledge/useKnowledgeState';

describe('useKnowledgeState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('should initialize with default state', () => {
        const { result } = renderHook(() => useKnowledgeState());
        expect(result.current.activeTab).toBe('overview');
        expect(result.current.loading).toBe(false);
    });

    it('should set active tab', () => {
        const { result } = renderHook(() => useKnowledgeState());
        act(() => { result.current.setActiveTab('facts'); });
        expect(result.current.activeTab).toBe('facts');
    });
});
