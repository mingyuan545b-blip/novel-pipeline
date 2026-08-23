/**
 * useForceLayout hook tests
 */
import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import useForceLayout from '../../pages/knowledge/useForceLayout';

describe('useForceLayout', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Mock requestAnimationFrame
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
            cb();
            return 1;
        });
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        window.requestAnimationFrame.mockRestore();
        window.cancelAnimationFrame.mockRestore();
    });

    test('does nothing without graph', () => {
        const setPositions = vi.fn();
        const currentPos = { current: {} };
        const animRef = { current: null };
        const draggingRef = { current: null };
        renderHook(() => useForceLayout({
            graph: null, filteredNodes: [], filteredEdges: [],
            filteredCount: 0, filteredEdgeCount: 0, viewMode: 'graph',
            currentPos, animRef, draggingRef, setPositions,
        }));
        expect(setPositions).not.toHaveBeenCalled();
    });

    test('initializes positions for nodes', () => {
        const setPositions = vi.fn();
        const currentPos = { current: {} };
        const animRef = { current: null };
        const draggingRef = { current: null };
        const nodes = [{ id: 'n1' }, { id: 'n2' }];
        const edges = [{ source: 'n1', target: 'n2' }];
        const graph = { nodes, edges };
        renderHook(() => useForceLayout({
            graph, filteredNodes: nodes, filteredEdges: edges,
            filteredCount: 2, filteredEdgeCount: 1, viewMode: 'graph',
            currentPos, animRef, draggingRef, setPositions,
        }));
        expect(setPositions).toHaveBeenCalled();
        const positions = setPositions.mock.calls[0][0];
        expect(positions.n1).toBeDefined();
        expect(positions.n2).toBeDefined();
        expect(positions.n1.x).toBeGreaterThanOrEqual(50);
        expect(positions.n1.y).toBeGreaterThanOrEqual(50);
    });

    test('skips when filteredCount is 0', () => {
        const setPositions = vi.fn();
        const currentPos = { current: {} };
        const animRef = { current: null };
        const draggingRef = { current: null };
        renderHook(() => useForceLayout({
            graph: { nodes: [], edges: [] }, filteredNodes: [], filteredEdges: [],
            filteredCount: 0, filteredEdgeCount: 0, viewMode: 'graph',
            currentPos, animRef, draggingRef, setPositions,
        }));
        expect(setPositions).not.toHaveBeenCalled();
    });

    test('cancels animation on unmount', () => {
        const setPositions = vi.fn();
        const currentPos = { current: {} };
        const animRef = { current: 1 };
        const draggingRef = { current: null };
        const nodes = [{ id: 'n1' }];
        const { unmount } = renderHook(() => useForceLayout({
            graph: { nodes, edges: [] }, filteredNodes: nodes, filteredEdges: [],
            filteredCount: 1, filteredEdgeCount: 0, viewMode: 'graph',
            currentPos, animRef, draggingRef, setPositions,
        }));
        unmount();
        expect(window.cancelAnimationFrame).toHaveBeenCalled();
    });
});
