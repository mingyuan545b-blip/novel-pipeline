import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useInvalidateOnMutation } from '../../hooks/useStoreSync';
import useAppStore from '../../store/useAppStore';
import { act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
    projectsApi: { list: vi.fn(() => Promise.resolve({ data: [] })) },
    chaptersApi: { list: vi.fn(() => Promise.resolve({ data: [] })) },
    materialsApi: { list: vi.fn(() => Promise.resolve({ data: [] })) },
    reviewsApi: { list: vi.fn(() => Promise.resolve({ data: [] })) },
}));

describe('useInvalidateOnMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useAppStore.setState({ currentProject: { id: 'p1', name: 'Test' } });
        });
    });

    test('returns invalidate functions', () => {
        const { result } = renderHook(() => useInvalidateOnMutation(), { wrapper: createWrapper() });
        expect(typeof result.current.invalidateProjects).toBe('function');
        expect(typeof result.current.invalidateChapters).toBe('function');
        expect(typeof result.current.invalidateMaterials).toBe('function');
        expect(typeof result.current.invalidateReviews).toBe('function');
        expect(typeof result.current.invalidateAll).toBe('function');
    });

    test('invalidateProjects calls queryClient', async () => {
        const { result } = renderHook(() => useInvalidateOnMutation(), { wrapper: createWrapper() });
        await result.current.invalidateProjects();
    });

    test('invalidateChapters calls queryClient', async () => {
        const { result } = renderHook(() => useInvalidateOnMutation(), { wrapper: createWrapper() });
        await result.current.invalidateChapters();
    });

    test('invalidateMaterials calls queryClient', async () => {
        const { result } = renderHook(() => useInvalidateOnMutation(), { wrapper: createWrapper() });
        await result.current.invalidateMaterials();
    });

    test('invalidateAll calls queryClient', async () => {
        const { result } = renderHook(() => useInvalidateOnMutation(), { wrapper: createWrapper() });
        await result.current.invalidateAll();
    });
});
