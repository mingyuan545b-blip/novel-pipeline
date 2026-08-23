import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
    projectsApi: { getCleanupStats: vi.fn(), cleanup: vi.fn(), list: vi.fn() },
}));

import { useStyleCleanupState } from '../../pages/dashboard/useStyleCleanupState';
import { projectsApi } from '../../services/api';

describe('useStyleCleanupState', () => {
    const mockSetProjects = vi.fn();
    const mockShowError = vi.fn();

    beforeEach(() => { vi.clearAllMocks(); });

    it('should initialize with null state', () => {
        const { result } = renderHook(() => useStyleCleanupState(mockSetProjects, mockShowError));
        expect(result.current.cleanupModal).toBeNull();
        expect(result.current.cleanupStats).toBeNull();
        expect(result.current.cleanupTargets).toEqual([]);
        expect(result.current.cleanupKeepLocked).toBe(true);
        expect(result.current.cleanupLoading).toBe(false);
        expect(result.current.cleanupResult).toBeNull();
    });

    it('should open cleanup modal and load stats', async () => {
        projectsApi.getCleanupStats.mockResolvedValue({ data: { total: 10, removable: 5 } });
        const { result } = renderHook(() => useStyleCleanupState(mockSetProjects, mockShowError));
        await act(async () => {
            await result.current.openCleanupModal({ id: 'p1', name: 'Test' });
        });
        expect(result.current.cleanupModal).toEqual({ id: 'p1', name: 'Test' });
        expect(result.current.cleanupStats).toEqual({ total: 10, removable: 5 });
        expect(result.current.cleanupLoading).toBe(false);
    });

    it('should handle getCleanupStats error', async () => {
        projectsApi.getCleanupStats.mockRejectedValue(new Error('fail'));
        const { result } = renderHook(() => useStyleCleanupState(mockSetProjects, mockShowError));
        await act(async () => {
            await result.current.openCleanupModal({ id: 'p1', name: 'Test' });
        });
        expect(result.current.cleanupStats).toBeNull();
    });

    it('should set cleanup targets', () => {
        const { result } = renderHook(() => useStyleCleanupState(mockSetProjects, mockShowError));
        act(() => { result.current.setCleanupTargets(['orphaned', 'duplicates']); });
        expect(result.current.cleanupTargets).toEqual(['orphaned', 'duplicates']);
    });

    it('should toggle cleanup keep locked', () => {
        const { result } = renderHook(() => useStyleCleanupState(mockSetProjects, mockShowError));
        expect(result.current.cleanupKeepLocked).toBe(true);
        act(() => { result.current.setCleanupKeepLocked(false); });
        expect(result.current.cleanupKeepLocked).toBe(false);
    });
});
