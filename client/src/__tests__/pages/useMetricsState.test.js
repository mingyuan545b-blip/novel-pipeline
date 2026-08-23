import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import useMetricsState from '../../pages/metrics/useMetricsState';

vi.mock('../../services/api', () => ({
    healthApi: {
        getMetrics: vi.fn(() => Promise.resolve({
            data: {
                pipeline: { summary: { totalSteps: 10, totalFailures: 1, totalMs: 5000 }, steps: { writer: { count: 5, failures: 0, totalMs: 3000 } } },
                llm: { summary: { totalRequests: 20, totalTokens: 50000, totalFailures: 2 }, providers: { aliyun: { requestCount: 20, totalTokens: 50000, failureCount: 2 } } }
            }
        })),
        getSnapshots: vi.fn(() => Promise.resolve({
            data: { snapshots: [{ timestamp: '2024-01-01', pipeline: { summary: { totalSteps: 5 } }, llm: { summary: { totalTokens: 10000 } } }] }
        })),
        triggerSnapshot: vi.fn(() => Promise.resolve({ data: { ok: true } })),
    }
}));

describe('useMetricsState', () => {
    beforeEach(() => vi.clearAllMocks());

    test('initializes with loading state', () => {
        const { result } = renderHook(() => useMetricsState(), { wrapper: createWrapper() });
        expect(result.current.loading).toBe(true);
        expect(result.current.metrics).toBeNull();
    });

    test('loads metrics and snapshots', async () => {
        const { result } = renderHook(() => useMetricsState(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.metrics).toBeTruthy();
        expect(result.current.metrics.pipeline.summary.totalSteps).toBe(10);
        expect(result.current.snapshots.length).toBeGreaterThan(0);
        expect(result.current.error).toBeNull();
    });

    test('handles fetch error', async () => {
        const { healthApi } = await import('../../services/api');
        healthApi.getMetrics.mockRejectedValueOnce(new Error('Network error'));
        const { result } = renderHook(() => useMetricsState(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe('Network error');
    });

    test('triggerSnapshot calls API', async () => {
        const { result } = renderHook(() => useMetricsState(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.loading).toBe(false));
        await act(async () => { await result.current.triggerSnapshot(); });
        const { healthApi } = await import('../../services/api');
        expect(healthApi.triggerSnapshot).toHaveBeenCalled();
    });

    test('autoRefresh can be toggled', async () => {
        const { result } = renderHook(() => useMetricsState(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.autoRefresh).toBe(true);
        act(() => { result.current.setAutoRefresh(false); });
        expect(result.current.autoRefresh).toBe(false);
    });
});
