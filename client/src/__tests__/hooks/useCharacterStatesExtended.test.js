import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useStateSync, useCharacterHistory, useStateMeta } from '../../hooks/queries/useCharacterStates';

vi.mock('../../services/api', () => ({
    characterStateApi: {
        getStates: vi.fn(() => Promise.resolve({ data: {} })),
        getCharacters: vi.fn(() => Promise.resolve({ data: [] })),
        getKV: vi.fn(() => Promise.resolve({ data: {} })),
        getSummary: vi.fn(() => Promise.resolve({ data: {} })),
        getHistory: vi.fn(() => Promise.resolve({ data: [{ chapter: 1, state: {} }] })),
        getMeta: vi.fn(() => Promise.resolve({ data: { currentChapter: 5 } })),
        sync: vi.fn(() => Promise.resolve({ data: { synced: true } })),
    }
}));

describe('useStateSync', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('syncs character states', async () => {
        const { result } = renderHook(() => useStateSync(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ projectId: 'p1', fromChapter: 1, toChapter: 5 }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useCharacterHistory', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when projectId is falsy', () => {
        const { result } = renderHook(() => useCharacterHistory(null, 'c1'), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches character history', async () => {
        const { result } = renderHook(() => useCharacterHistory('p1', 'c1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ chapter: 1, state: {} }]);
    });
});

describe('useStateMeta', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('fetches state meta', async () => {
        const { result } = renderHook(() => useStateMeta('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.currentChapter).toBe(5);
    });
});
