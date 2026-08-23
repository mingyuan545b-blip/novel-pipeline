import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';

vi.mock('../../services/api', () => ({
    guideApi: {
        getAll: vi.fn(() => Promise.resolve({ data: { quickStart: { title: 'Quick' } } })),
    },
}));

import useGuideState, { TABS } from '../../pages/guide/useGuideState';

describe('TABS', () => {
    test('has expected tab keys', () => {
        expect(TABS.length).toBeGreaterThan(0);
        expect(TABS[0].key).toBe('quickStart');
    });
});

describe('useGuideState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', () => {
        const { result } = renderHook(() => useGuideState(), { wrapper: createWrapper() });
        expect(result.current.activeTab).toBe('quickStart');
        expect(result.current.guideData).toBe(null);
    });

    test('sets active tab', () => {
        const { result } = renderHook(() => useGuideState(), { wrapper: createWrapper() });
        act(() => { result.current.setActiveTab('pipelineFlow'); });
        expect(result.current.activeTab).toBe('pipelineFlow');
    });
});
