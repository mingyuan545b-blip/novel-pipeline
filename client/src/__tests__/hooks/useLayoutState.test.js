import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../pages/dashboard/constants', () => ({
    DEFAULT_LAYOUT: { left: ['a', 'b'], right: ['c'] },
    loadLayout: vi.fn(() => ({ left: ['a', 'b'], right: ['c'] })),
    saveLayout: vi.fn(),
}));

import useLayoutState from '../../pages/dashboard/useLayoutState';

describe('useLayoutState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('should initialize with loaded layout', () => {
        const { result } = renderHook(() => useLayoutState());
        expect(result.current.cardLayout).toEqual({ left: ['a', 'b'], right: ['c'] });
    });

    it('should handle drag end with no destination', () => {
        const { result } = renderHook(() => useLayoutState());
        const prevLayout = result.current.cardLayout;
        act(() => { result.current.onDragEnd({ source: { droppableId: 'left', index: 0 }, destination: null }); });
        expect(result.current.cardLayout).toEqual(prevLayout);
    });

    it('should handle drag end to same position', () => {
        const { result } = renderHook(() => useLayoutState());
        const prevLayout = result.current.cardLayout;
        act(() => {
            result.current.onDragEnd({ source: { droppableId: 'left', index: 0 }, destination: { droppableId: 'left', index: 0 } });
        });
        expect(result.current.cardLayout).toEqual(prevLayout);
    });

    it('should reorder on drag end', () => {
        const { result } = renderHook(() => useLayoutState());
        act(() => {
            result.current.onDragEnd({ source: { droppableId: 'left', index: 0 }, destination: { droppableId: 'right', index: 0 } });
        });
        expect(result.current.cardLayout.left).toEqual(['b']);
        expect(result.current.cardLayout.right).toEqual(['a', 'c']);
    });

    it('should reset layout', () => {
        const { result } = renderHook(() => useLayoutState());
        act(() => {
            result.current.onDragEnd({ source: { droppableId: 'left', index: 0 }, destination: { droppableId: 'right', index: 0 } });
        });
        act(() => { result.current.resetLayout(); });
        expect(result.current.cardLayout).toEqual({ left: ['a', 'b'], right: ['c'] });
    });
});
