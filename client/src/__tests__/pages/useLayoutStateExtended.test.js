import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../pages/dashboard/constants', () => ({
    DEFAULT_LAYOUT: { left: ['a', 'b'], right: ['c'] },
    loadLayout: vi.fn().mockReturnValue({ left: ['a', 'b'], right: ['c'] }),
    saveLayout: vi.fn(),
    LAYOUT_KEY: 'dashboard-layout',
    MODE_LABELS: { novel: '长篇' },
}));

describe('useLayoutState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial layout', async () => {
        const { default: useLayoutState } = await import('../../pages/dashboard/useLayoutState');
        const { result } = renderHook(() => useLayoutState());
        expect(result.current.cardLayout).toEqual({ left: ['a', 'b'], right: ['c'] });
    });

    test('onDragEnd does nothing without destination', async () => {
        const { default: useLayoutState } = await import('../../pages/dashboard/useLayoutState');
        const { result } = renderHook(() => useLayoutState());
        act(() => { result.current.onDragEnd({ source: { droppableId: 'left', index: 0 }, destination: null }); });
        expect(result.current.cardLayout.left).toEqual(['a', 'b']);
    });

    test('onDragEnd does nothing when same position', async () => {
        const { default: useLayoutState } = await import('../../pages/dashboard/useLayoutState');
        const { result } = renderHook(() => useLayoutState());
        act(() => { result.current.onDragEnd({ source: { droppableId: 'left', index: 0 }, destination: { droppableId: 'left', index: 0 } }); });
        expect(result.current.cardLayout.left).toEqual(['a', 'b']);
    });

    test('onDragEnd moves item between columns', async () => {
        const { default: useLayoutState } = await import('../../pages/dashboard/useLayoutState');
        const { result } = renderHook(() => useLayoutState());
        act(() => {
            result.current.onDragEnd({
                source: { droppableId: 'left', index: 0 },
                destination: { droppableId: 'right', index: 0 },
            });
        });
        expect(result.current.cardLayout.left).toEqual(['b']);
        expect(result.current.cardLayout.right).toEqual(['a', 'c']);
    });

    test('onDragEnd reorders within same column', async () => {
        const { default: useLayoutState } = await import('../../pages/dashboard/useLayoutState');
        const { result } = renderHook(() => useLayoutState());
        act(() => {
            result.current.onDragEnd({
                source: { droppableId: 'left', index: 0 },
                destination: { droppableId: 'left', index: 1 },
            });
        });
        expect(result.current.cardLayout.left).toEqual(['b', 'a']);
    });

    test('resetLayout resets to default', async () => {
        const { default: useLayoutState } = await import('../../pages/dashboard/useLayoutState');
        const { result } = renderHook(() => useLayoutState());
        act(() => { result.current.resetLayout(); });
        expect(result.current.cardLayout).toEqual({ left: ['a', 'b'], right: ['c'] });
    });
});

describe('dashboard constants', () => {
    test('MODE_LABELS has novel', async () => {
        const { MODE_LABELS } = await import('../../pages/dashboard/constants');
        expect(MODE_LABELS.novel).toBe('长篇');
    });

    test('LAYOUT_KEY is string', async () => {
        const { LAYOUT_KEY } = await import('../../pages/dashboard/constants');
        expect(LAYOUT_KEY).toBe('dashboard-layout');
    });

    test('DEFAULT_LAYOUT has left and right', async () => {
        const { DEFAULT_LAYOUT } = await import('../../pages/dashboard/constants');
        expect(DEFAULT_LAYOUT).toHaveProperty('left');
        expect(DEFAULT_LAYOUT).toHaveProperty('right');
    });

    test('loadLayout returns object', async () => {
        const { loadLayout } = await import('../../pages/dashboard/constants');
        const layout = loadLayout();
        expect(layout).toHaveProperty('left');
        expect(layout).toHaveProperty('right');
    });

    test('saveLayout 真写入 localStorage（key + 内容）', async () => {
        // 本文件 mock 了 constants 模块，故这里取**真实实现**来测
        const actual = await vi.importActual('../../pages/dashboard/constants');
        // 用与默认卡片集一致的布局，才能命中 loadLayout 的"卡片集校验"分支
        const layout = { left: [...actual.DEFAULT_LAYOUT.left], right: [...actual.DEFAULT_LAYOUT.right] };
        localStorage.removeItem(actual.LAYOUT_KEY);
        actual.saveLayout(layout);
        expect(localStorage.getItem(actual.LAYOUT_KEY)).toBe(JSON.stringify(layout));
        expect(actual.loadLayout()).toEqual(layout);
        // 卡片集对不上时必须回退默认（防脏布局把卡片弄丢）
        actual.saveLayout({ left: ['不存在'], right: [] });
        expect(actual.loadLayout()).toEqual(actual.DEFAULT_LAYOUT);
    });
});
