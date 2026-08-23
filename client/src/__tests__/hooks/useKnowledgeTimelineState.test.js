import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
    knowledgeApi: {
        getTimelineEvents: vi.fn(), getTimelineStats: vi.fn(),
        getCharacterTimeline: vi.fn(), getSnapshotDiff: vi.fn(),
    },
}));

vi.mock('../../shared/logger', () => ({
    default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { useKnowledgeTimelineState } from '../../pages/knowledge/useKnowledgeTimelineState';
import { knowledgeApi } from '../../services/api';

describe('useKnowledgeTimelineState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('should initialize with empty state', () => {
        const { result } = renderHook(() => useKnowledgeTimelineState('proj-1'));
        expect(result.current.timelineEvents).toEqual([]);
        expect(result.current.timelineStats).toBeNull();
        expect(result.current.timelineFilter).toBe('all');
        expect(result.current.selectedCharId).toBeNull();
        expect(result.current.charTimeline).toEqual([]);
        expect(result.current.snapshotDiff).toBeNull();
    });

    it('should set timeline filter', () => {
        const { result } = renderHook(() => useKnowledgeTimelineState('proj-1'));
        act(() => { result.current.setTimelineFilter('character'); });
        expect(result.current.timelineFilter).toBe('character');
    });

    it('should load timeline events and stats', async () => {
        knowledgeApi.getTimelineEvents.mockResolvedValue({ data: [{ id: 'e1' }] });
        knowledgeApi.getTimelineStats.mockResolvedValue({ data: { total: 5 } });
        const { result } = renderHook(() => useKnowledgeTimelineState('proj-1'));
        await act(async () => { await result.current.loadTimeline(); });
        expect(knowledgeApi.getTimelineEvents).toHaveBeenCalledWith('proj-1');
        expect(knowledgeApi.getTimelineStats).toHaveBeenCalledWith('proj-1');
        expect(result.current.timelineEvents).toEqual([{ id: 'e1' }]);
        expect(result.current.timelineStats).toEqual({ total: 5 });
    });

    it('should not load timeline when projectId is null', async () => {
        const { result } = renderHook(() => useKnowledgeTimelineState(null));
        await act(async () => { await result.current.loadTimeline(); });
        expect(knowledgeApi.getTimelineEvents).not.toHaveBeenCalled();
    });

    it('should handle load timeline error', async () => {
        knowledgeApi.getTimelineEvents.mockRejectedValue(new Error('fail'));
        knowledgeApi.getTimelineStats.mockRejectedValue(new Error('fail'));
        const { result } = renderHook(() => useKnowledgeTimelineState('proj-1'));
        await act(async () => { await result.current.loadTimeline(); });
        expect(result.current.timelineEvents).toEqual([]);
    });

    it('should load character timeline', async () => {
        knowledgeApi.getCharacterTimeline.mockResolvedValue({ data: [{ chapter: 1 }] });
        const { result } = renderHook(() => useKnowledgeTimelineState('proj-1'));
        await act(async () => { await result.current.handleCharTimeline('char-1'); });
        expect(result.current.selectedCharId).toBe('char-1');
        expect(result.current.charTimeline).toEqual([{ chapter: 1 }]);
    });

    it('should load snapshot diff', async () => {
        knowledgeApi.getSnapshotDiff.mockResolvedValue({ data: { added: 3, removed: 1 } });
        const { result } = renderHook(() => useKnowledgeTimelineState('proj-1'));
        await act(async () => { await result.current.handleSnapshotDiff(1, 5); });
        expect(knowledgeApi.getSnapshotDiff).toHaveBeenCalledWith('proj-1', { chapterA: 1, chapterB: 5 });
        expect(result.current.snapshotDiff).toEqual({ added: 3, removed: 1 });
    });
});
