import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { usePipelineStatus, useStartPipeline, useStopPipeline, PIPELINE_KEYS } from '../../hooks/queries/usePipelineStatus';

vi.mock('../../services/api', () => ({
    pipelineApi: {
        getInfiniteStatus: vi.fn(() => Promise.resolve({ data: { running: false, chapters: [] } })),
        startInfinite: vi.fn((d) => Promise.resolve({ data: { ...d, started: true } })),
        stopInfinite: vi.fn(() => Promise.resolve({ data: { stopped: true } })),
        resetInfinite: vi.fn(() => Promise.resolve({ data: {} })),
        getTaskStatus: vi.fn(() => Promise.resolve({ data: { status: 'done' } })),
    }
}));

describe('PIPELINE_KEYS', () => {
    test('generates correct key structures', () => {
        expect(PIPELINE_KEYS.all).toEqual(['pipeline']);
        expect(PIPELINE_KEYS.status('p1')).toEqual(['pipeline', 'status', 'p1']);
        expect(PIPELINE_KEYS.agents()).toEqual(['pipeline', 'agents']);
    });
});

describe('usePipelineStatus', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when projectId is falsy', () => {
        const { result } = renderHook(() => usePipelineStatus(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches pipeline status', async () => {
        const { result } = renderHook(() => usePipelineStatus('p1', { refetchInterval: false }), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.running).toBe(false);
    });
});

describe('useStartPipeline', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('starts pipeline', async () => {
        const { result } = renderHook(() => useStartPipeline(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ projectId: 'p1' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.started).toBe(true);
    });
});

describe('useStopPipeline', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('stops pipeline', async () => {
        const { result } = renderHook(() => useStopPipeline(), { wrapper: createWrapper() });
        act(() => { result.current.mutate('p1'); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.stopped).toBe(true);
    });
});
