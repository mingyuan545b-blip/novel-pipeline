import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useUpdateChapter, useDeleteChapter, useResetChapter } from '../../hooks/queries/useChapters';

vi.mock('../../services/api', () => ({
    chaptersApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        get: vi.fn(() => Promise.resolve({ data: {} })),
        update: vi.fn((id, data) => Promise.resolve({ data: { id, ...data, projectId: 'p1' } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
        reset: vi.fn((id) => Promise.resolve({ data: { id, projectId: 'p1' } })),
    }
}));

describe('useUpdateChapter', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('updates a chapter', async () => {
        const { result } = renderHook(() => useUpdateChapter(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ id: 'c1', data: { title: 'Updated' } }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.id).toBe('c1');
    });
});

describe('useDeleteChapter', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('deletes a chapter', async () => {
        const { result } = renderHook(() => useDeleteChapter(), { wrapper: createWrapper() });
        act(() => { result.current.mutate('c1'); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useResetChapter', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('resets a chapter', async () => {
        const { result } = renderHook(() => useResetChapter(), { wrapper: createWrapper() });
        act(() => { result.current.mutate('c1'); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.id).toBe('c1');
    });
});
