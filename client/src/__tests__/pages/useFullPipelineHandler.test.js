/**
 * useFullPipelineHandler hook tests
 */
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../store/useAppStore', () => ({
    __esModule: true,
    default: vi.fn((sel) => sel ? sel({
        addPipelineLog: vi.fn(),
        clearPipelineLogs: vi.fn(),
        setPipelineState: vi.fn(),
        pipelineState: { currentRound: 1 },
    }) : {
        addPipelineLog: vi.fn(),
        clearPipelineLogs: vi.fn(),
        setPipelineState: vi.fn(),
        pipelineState: { currentRound: 1 },
    }),
}));

vi.mock('../../hooks/queries', () => ({
    useRunStep: vi.fn().mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}) }),
    useRunFullPipeline: vi.fn().mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ taskId: 'task-123' }) }),
    useTaskStatusPoll: vi.fn().mockReturnValue({ data: null }),
    PIPELINE_KEYS: { outputPaths: vi.fn().mockReturnValue(['pipeline', 'output']) },
}));

import { useFullPipelineHandler } from '../../pages/pipeline/useFullPipelineHandler';

describe('useFullPipelineHandler', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', () => {
        const { result } = renderHook(() => useFullPipelineHandler(null, null));
        expect(result.current.fullPipelineTaskId).toBeNull();
        expect(result.current.fullPipelinePolling).toBe(false);
        expect(result.current.fullPipelinePollErrors).toBe(0);
        expect(result.current.runStep).toBeInstanceOf(Function);
        expect(result.current.runFullPipeline).toBeInstanceOf(Function);
    });

    test('runStep skips without project', async () => {
        const { useRunStep } = await import('../../hooks/queries');
        const { result } = renderHook(() => useFullPipelineHandler(null, null));
        await act(async () => { await result.current.runStep('writer'); });
        expect(useRunStep().mutateAsync).not.toHaveBeenCalled();
    });

    test('runStep skips without selectedChapter', async () => {
        const { useRunStep } = await import('../../hooks/queries');
        const { result } = renderHook(() => useFullPipelineHandler({ id: 'p1' }, null));
        await act(async () => { await result.current.runStep('writer'); });
        expect(useRunStep().mutateAsync).not.toHaveBeenCalled();
    });

    test('runFullPipeline alerts without project', async () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const { result } = renderHook(() => useFullPipelineHandler(null, null));
        await act(async () => { await result.current.runFullPipeline(3); });
        expect(alertSpy).toHaveBeenCalledWith('请先选择一个项目');
        alertSpy.mockRestore();
    });

    test('runFullPipeline alerts without chapter', async () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const { result } = renderHook(() => useFullPipelineHandler({ id: 'p1' }, null));
        await act(async () => { await result.current.runFullPipeline(3); });
        expect(alertSpy).toHaveBeenCalledWith('请先选择一个章节');
        alertSpy.mockRestore();
    });

    test('runFullPipeline starts pipeline with project and chapter', async () => {
        const project = { id: 'p1' };
        const chapter = { id: 'ch1' };
        const { result } = renderHook(() => useFullPipelineHandler(project, chapter));
        await act(async () => { await result.current.runFullPipeline(3); });
        expect(result.current.fullPipelinePolling).toBe(true);
        expect(result.current.fullPipelineTaskId).toBe('task-123');
    });
});
