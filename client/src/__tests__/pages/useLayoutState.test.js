import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';

vi.mock('../../pages/dashboard/constants', () => ({
    DEFAULT_LAYOUT: { left: ['a', 'b'], right: ['c'] },
    loadLayout: vi.fn(() => ({ left: ['a', 'b'], right: ['c'] })),
    saveLayout: vi.fn(),
}));

import useLayoutState from '../../pages/dashboard/useLayoutState';

describe('useLayoutState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial layout', () => {
        const { result } = renderHook(() => useLayoutState(), { wrapper: createWrapper() });
        expect(result.current.cardLayout.left).toEqual(['a', 'b']);
        expect(result.current.cardLayout.right).toEqual(['c']);
    });

    test('resetLayout restores default', () => {
        const { result } = renderHook(() => useLayoutState(), { wrapper: createWrapper() });
        act(() => { result.current.resetLayout(); });
        expect(result.current.cardLayout.left).toEqual(['a', 'b']);
    });
});
