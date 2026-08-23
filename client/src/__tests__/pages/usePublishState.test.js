/**
 * usePublishState hook tests
 */
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../services/api', () => ({
    publishApi: {
        getPlatforms: vi.fn().mockResolvedValue({ data: [] }),
        getAccounts: vi.fn().mockResolvedValue({ data: [] }),
        getQueue: vi.fn().mockResolvedValue({ data: [] }),
        getInteractions: vi.fn().mockResolvedValue({ data: [] }),
        getPublishStats: vi.fn().mockResolvedValue({ data: null }),
        getInteractionStats: vi.fn().mockResolvedValue({ data: null }),
        multiGetAllStatus: vi.fn().mockResolvedValue({ data: {} }),
    }
}));

vi.mock('../../hooks/queries/useChapters', () => ({
    useChapters: vi.fn().mockReturnValue({ data: [] }),
}));

vi.mock('../../store/useAppStore', () => ({
    __esModule: true,
    default: vi.fn((sel) => sel ? sel({ currentProject: { id: 'proj-1' } }) : { currentProject: { id: 'proj-1' } }),
}));

import { usePublishState } from '../../pages/publish/usePublishState';

describe('usePublishState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', () => {
        const { result } = renderHook(() => usePublishState());
        expect(result.current.platforms).toEqual([]);
        expect(result.current.accounts).toEqual([]);
        expect(result.current.queue).toEqual([]);
        expect(result.current.interactions).toEqual([]);
        expect(result.current.publishStats).toBeNull();
        expect(result.current.approvedCount).toBe(0);
    });

    test('getStatusLabel returns label for known status', () => {
        const { result } = renderHook(() => usePublishState());
        expect(result.current.getStatusLabel('published')).toBeTruthy();
    });

    test('getStatusLabel returns raw status for unknown', () => {
        const { result } = renderHook(() => usePublishState());
        expect(result.current.getStatusLabel('unknown')).toBe('unknown');
    });

    test('setShowAddAccount toggles dialog', () => {
        const { result } = renderHook(() => usePublishState());
        act(() => { result.current.setShowAddAccount(true); });
        expect(result.current.showAddAccount).toBe(true);
    });

    test('setShowAddInteraction toggles dialog', () => {
        const { result } = renderHook(() => usePublishState());
        act(() => { result.current.setShowAddInteraction(true); });
        expect(result.current.showAddInteraction).toBe(true);
    });

    test('setBatchConfig updates config', () => {
        const { result } = renderHook(() => usePublishState());
        act(() => { result.current.setBatchConfig({ platformAccountId: 'acc-1', scheduleInterval: 60 }); });
        expect(result.current.batchConfig.platformAccountId).toBe('acc-1');
    });
});
