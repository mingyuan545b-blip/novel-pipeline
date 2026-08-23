import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useChapters, useChapter, CHAPTER_KEYS } from '../../hooks/queries/useChapters';

vi.mock('../../services/api', () => ({
    chaptersApi: {
        list: vi.fn(() => Promise.resolve({ data: [{ id: 'c1', title: 'Ch1' }] })),
        get: vi.fn((id) => Promise.resolve({ data: { id, title: 'Ch1' } })),
        update: vi.fn(({ id, data }) => Promise.resolve({ data: { id, ...data, projectId: 'p1' } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
        reset: vi.fn((id) => Promise.resolve({ data: { id, projectId: 'p1' } })),
    }
}));

describe('CHAPTER_KEYS', () => {
    test('generates correct key structures', () => {
        expect(CHAPTER_KEYS.all).toEqual(['chapters']);
        expect(CHAPTER_KEYS.lists('p1')).toEqual(['chapters', 'list', 'p1']);
        expect(CHAPTER_KEYS.detail('c1')).toEqual(['chapters', 'detail', 'c1']);
    });
});

describe('useChapters', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when projectId is falsy', () => {
        const { result } = renderHook(() => useChapters(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches chapters for a project', async () => {
        const { result } = renderHook(() => useChapters('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ id: 'c1', title: 'Ch1' }]);
    });
});

describe('useChapter', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when id is falsy', () => {
        const { result } = renderHook(() => useChapter(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches chapter by id', async () => {
        const { result } = renderHook(() => useChapter('c1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.id).toBe('c1');
    });
});
