import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';

vi.mock('../../hooks/queries', () => ({
    usePipelineOutputPaths: vi.fn(() => ({ data: null })),
    useReviewsByChapter: vi.fn(() => ({ data: null })),
}));

import { useOutputState } from '../../pages/pipeline/useOutputState';

describe('useOutputState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', () => {
        const { result } = renderHook(
            () => useOutputState({ id: 'p1' }, null),
            { wrapper: createWrapper() }
        );
        expect(result.current.activeOutputTab).toBe('writerOutput');
        expect(result.current.viewVersion).toBe(null);
    });

    test('sets active output tab', () => {
        const { result } = renderHook(
            () => useOutputState({ id: 'p1' }, null),
            { wrapper: createWrapper() }
        );
        act(() => { result.current.setActiveOutputTab('reviewOutput'); });
        expect(result.current.activeOutputTab).toBe('reviewOutput');
    });

    test('sets view version', () => {
        const { result } = renderHook(
            () => useOutputState({ id: 'p1' }, null),
            { wrapper: createWrapper() }
        );
        act(() => { result.current.setViewVersion(2); });
        expect(result.current.viewVersion).toBe(2);
    });
});
