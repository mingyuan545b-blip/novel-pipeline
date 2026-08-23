/**
 * useInfinitePipeline hook tests
 * Simplified — tests basic state and function exports
 */
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../services/api', () => ({
    pipelineApi: {
        getInfiniteStatus: vi.fn().mockResolvedValue({ data: { running: false } }),
        startInfinite: vi.fn().mockResolvedValue({ data: { success: true } }),
        stopInfinite: vi.fn().mockResolvedValue({ data: {} }),
        resetInfinite: vi.fn().mockResolvedValue({ data: {} }),
    },
    chaptersApi: {
        list: vi.fn().mockResolvedValue({ data: [] }),
    }
}));

vi.mock('../../hooks/useWebSocket', () => ({
    useWebSocketStatus: vi.fn().mockReturnValue('connected'),
    useProjectEvents: vi.fn().mockReturnValue(null),
}));

vi.mock('./useInfinitePipelineWs', () => ({
    useInfinitePipelineWs: vi.fn(),
    mapInfiniteLogs: vi.fn(logs => logs),
}));

import { useInfinitePipeline } from '../../pages/pipeline/useInfinitePipeline';

describe('useInfinitePipeline', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', () => {
        const { result } = renderHook(() => useInfinitePipeline(null, null, vi.fn(), vi.fn(), vi.fn()));
        expect(result.current.infiniteStatus).toEqual({ running: false });
        expect(result.current.infiniteOptions.chaptersPerBatch).toBe(30);
        expect(result.current.fallbackPollActive).toBe(false);
    });

    test('startInfinitePipeline alerts without project', async () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const { result } = renderHook(() => useInfinitePipeline(null, null, vi.fn(), vi.fn(), vi.fn()));
        await act(async () => { await result.current.startInfinitePipeline(); });
        expect(alertSpy).toHaveBeenCalledWith('请先选择一个项目');
        alertSpy.mockRestore();
    });

    test('stopInfinitePipeline skips without project', async () => {
        const { pipelineApi } = await import('../../services/api');
        const { result } = renderHook(() => useInfinitePipeline(null, null, vi.fn(), vi.fn(), vi.fn()));
        await act(async () => { await result.current.stopInfinitePipeline(); });
        expect(pipelineApi.stopInfinite).not.toHaveBeenCalled();
    });

    test('forceResetPipeline skips without project', async () => {
        const { pipelineApi } = await import('../../services/api');
        const { result } = renderHook(() => useInfinitePipeline(null, null, vi.fn(), vi.fn(), vi.fn()));
        await act(async () => { await result.current.forceResetPipeline(); });
        expect(pipelineApi.resetInfinite).not.toHaveBeenCalled();
    });

    test('setInfiniteOptions updates options', () => {
        const { result } = renderHook(() => useInfinitePipeline(null, null, vi.fn(), vi.fn(), vi.fn()));
        act(() => { result.current.setInfiniteOptions(prev => ({ ...prev, chaptersPerBatch: 50 })); });
        expect(result.current.infiniteOptions.chaptersPerBatch).toBe(50);
    });

    test('startInfinitePipeline starts when not running', async () => {
        const { pipelineApi } = await import('../../services/api');
        pipelineApi.getInfiniteStatus.mockResolvedValueOnce({ data: { running: false } });
        pipelineApi.startInfinite.mockResolvedValueOnce({ data: { success: true } });
        const project = { id: 'proj-1' };
        const { result } = renderHook(() => useInfinitePipeline(project, null, vi.fn(), vi.fn(), vi.fn()));
        await act(async () => { await result.current.startInfinitePipeline(); });
        expect(pipelineApi.startInfinite).toHaveBeenCalledWith(
            expect.objectContaining({ projectId: 'proj-1', chaptersPerBatch: 30 })
        );
    });

    test('stopInfinitePipeline stops with project', async () => {
        const { pipelineApi } = await import('../../services/api');
        const project = { id: 'proj-1' };
        const { result } = renderHook(() => useInfinitePipeline(project, null, vi.fn(), vi.fn(), vi.fn()));
        await act(async () => { await result.current.stopInfinitePipeline(); });
        expect(pipelineApi.stopInfinite).toHaveBeenCalledWith({ projectId: 'proj-1' });
    });

    test('forceResetPipeline resets when confirmed', async () => {
        const { pipelineApi } = await import('../../services/api');
        vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        const project = { id: 'proj-1' };
        const { result } = renderHook(() => useInfinitePipeline(project, null, vi.fn(), vi.fn(), vi.fn()));
        await act(async () => { await result.current.forceResetPipeline(); });
        expect(pipelineApi.resetInfinite).toHaveBeenCalledWith({ projectId: 'proj-1' });
        window.confirm.mockRestore();
        window.alert.mockRestore();
    });

    test('forceResetPipeline cancels when not confirmed', async () => {
        const { pipelineApi } = await import('../../services/api');
        vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
        const project = { id: 'proj-1' };
        const { result } = renderHook(() => useInfinitePipeline(project, null, vi.fn(), vi.fn(), vi.fn()));
        await act(async () => { await result.current.forceResetPipeline(); });
        expect(pipelineApi.resetInfinite).not.toHaveBeenCalled();
        window.confirm.mockRestore();
    });
});
