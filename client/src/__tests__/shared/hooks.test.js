import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFetchData, useMutateData } from '../../shared/hooks';

describe('useFetchData', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('auto-fetches on mount', async () => {
        const fetchFn = vi.fn(() => Promise.resolve({ data: { name: 'test' } }));
        const { result } = renderHook(() => useFetchData(fetchFn));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.data).toEqual({ name: 'test' });
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    test('does not auto-fetch when autoFetch=false', () => {
        const fetchFn = vi.fn(() => Promise.resolve({ data: {} }));
        renderHook(() => useFetchData(fetchFn, { autoFetch: false }));
        expect(fetchFn).not.toHaveBeenCalled();
    });

    test('handles fetch error', async () => {
        const fetchFn = vi.fn(() => Promise.reject(new Error('fail')));
        const onError = vi.fn();
        const { result } = renderHook(() => useFetchData(fetchFn, { onError }));
        await waitFor(() => expect(result.current.error).toBeTruthy());
        expect(result.current.error.message).toBe('fail');
        expect(onError).toHaveBeenCalled();
    });

    test('calls onSuccess callback', async () => {
        const fetchFn = vi.fn(() => Promise.resolve({ data: { ok: true } }));
        const onSuccess = vi.fn();
        renderHook(() => useFetchData(fetchFn, { onSuccess }));
        await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ ok: true }));
    });

    test('refetch function works', async () => {
        const fetchFn = vi.fn(() => Promise.resolve({ data: { v: 1 } }));
        const { result } = renderHook(() => useFetchData(fetchFn));
        await waitFor(() => expect(result.current.data).toEqual({ v: 1 }));
        await act(async () => { await result.current.refetch(); });
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });
});

describe('useMutateData', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('mutate function calls mutationFn', async () => {
        const mutationFn = vi.fn((p) => Promise.resolve({ data: { saved: true, ...p } }));
        const { result } = renderHook(() => useMutateData(mutationFn));
        let res;
        await act(async () => {
            res = await result.current.mutate({ name: 'test' });
        });
        expect(res).toEqual({ saved: true, name: 'test' });
        expect(mutationFn).toHaveBeenCalledWith({ name: 'test' });
    });

    test('handles mutation error', async () => {
        const mutationFn = vi.fn(() => Promise.reject(new Error('mutate fail')));
        const onError = vi.fn();
        const { result } = renderHook(() => useMutateData(mutationFn, { onError }));
        await act(async () => {
            await expect(result.current.mutate()).rejects.toThrow('mutate fail');
        });
        expect(onError).toHaveBeenCalled();
    });

    test('calls onSuccess callback', async () => {
        const mutationFn = vi.fn(() => Promise.resolve({ data: { ok: true } }));
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useMutateData(mutationFn, { onSuccess }));
        await act(async () => { await result.current.mutate(); });
        expect(onSuccess).toHaveBeenCalledWith({ ok: true });
    });
});
