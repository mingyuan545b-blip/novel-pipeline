import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useReviews, useReviewsByChapter, REVIEW_KEYS } from '../../hooks/queries/useReviews';

vi.mock('../../services/api', () => ({
    reviewsApi: {
        list: vi.fn(() => Promise.resolve({ data: [{ id: 'r1', score: 8 }] })),
        get: vi.fn((id) => Promise.resolve({ data: { id, score: 8 } })),
    }
}));

describe('REVIEW_KEYS', () => {
    test('generates correct key structures', () => {
        expect(REVIEW_KEYS.all).toEqual(['reviews']);
        expect(REVIEW_KEYS.lists('p1')).toEqual(['reviews', 'list', 'p1']);
        expect(REVIEW_KEYS.byChapter('c1')).toEqual(['reviews', 'chapter', 'c1']);
    });
});

describe('useReviews', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when projectId is falsy', () => {
        const { result } = renderHook(() => useReviews(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches reviews for a project', async () => {
        const { result } = renderHook(() => useReviews('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ id: 'r1', score: 8 }]);
    });
});

describe('useReviewsByChapter', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when chapterId is falsy', () => {
        const { result } = renderHook(() => useReviewsByChapter(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches reviews by chapter', async () => {
        const { result } = renderHook(() => useReviewsByChapter('c1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ id: 'r1', score: 8 }]);
    });
});
