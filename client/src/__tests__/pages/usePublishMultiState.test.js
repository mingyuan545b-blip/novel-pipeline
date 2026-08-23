/**
 * usePublishMultiState hook tests
 */
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../services/api', () => ({
    publishApi: {
        multiGetAllStatus: vi.fn().mockResolvedValue({ data: {} }),
    }
}));

import { usePublishMultiState } from '../../pages/publish/usePublishMultiState';

describe('usePublishMultiState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    test('returns initial state', () => {
        const { result } = renderHook(() => usePublishMultiState());
        expect(result.current.multiConfigs).toBeDefined();
        expect(result.current.multiStatuses).toEqual({});
        expect(result.current.multiLogs).toEqual({});
        expect(result.current.expandedPlatform).toBe('fanqie');
    });

    test('setExpandedPlatform updates platform', () => {
        const { result } = renderHook(() => usePublishMultiState());
        act(() => { result.current.setExpandedPlatform('qidian'); });
        expect(result.current.expandedPlatform).toBe('qidian');
    });

    test('setMultiConfigs updates configs', () => {
        const { result } = renderHook(() => usePublishMultiState());
        act(() => {
            result.current.setMultiConfigs(prev => ({
                ...prev,
                fanqie: { ...prev.fanqie, enabled: true }
            }));
        });
        expect(result.current.multiConfigs.fanqie.enabled).toBe(true);
    });

    test('getLoginStatusBadge returns default badge for unknown', () => {
        const { result } = renderHook(() => usePublishMultiState());
        const badge = result.current.getLoginStatusBadge('unknown');
        expect(badge).toBeDefined();
        expect(badge.text).toBe('未检测');
    });

    test('persists configs to localStorage', () => {
        const { result } = renderHook(() => usePublishMultiState());
        act(() => {
            result.current.setMultiConfigs(prev => ({
                ...prev,
                fanqie: { ...prev.fanqie, enabled: true }
            }));
        });
        // Wait for useEffect
        const stored = localStorage.getItem('publish_config_fanqie');
        expect(stored).toBeTruthy();
        expect(JSON.parse(stored).enabled).toBe(true);
    });
});
