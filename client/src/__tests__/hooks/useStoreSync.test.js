import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { createWrapper } from '../helpers/testUtils';
import { useInvalidateOnMutation } from '../../hooks/useStoreSync';
import { PROJECT_KEYS } from '../../hooks/queries/useProjects';
import { CHAPTER_KEYS } from '../../hooks/queries/useChapters';
import { MATERIAL_KEYS } from '../../hooks/queries/useMaterials';
import { REVIEW_KEYS } from '../../hooks/queries/useReviews';
import useAppStore from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
    projectsApi: { list: vi.fn(() => Promise.resolve({ data: [] })) },
    chaptersApi: { list: vi.fn(() => Promise.resolve({ data: [] })) },
    materialsApi: { list: vi.fn(() => Promise.resolve({ data: [] })) },
    reviewsApi: { list: vi.fn(() => Promise.resolve({ data: [] })) },
}));

describe('useInvalidateOnMutation', () => {
    let invalidateSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useAppStore.setState({ currentProject: { id: 'p1', name: 'Test' } });
        });
        // 断言"真的失效了正确的 queryKey"——而不是只把函数调用一遍（原测试零断言）
        invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries').mockResolvedValue(undefined);
    });

    afterEach(() => {
        invalidateSpy.mockRestore();
    });

    test('returns invalidate functions', () => {
        const { result } = renderHook(() => useInvalidateOnMutation(), { wrapper: createWrapper() });
        expect(typeof result.current.invalidateProjects).toBe('function');
        expect(typeof result.current.invalidateChapters).toBe('function');
        expect(typeof result.current.invalidateMaterials).toBe('function');
        expect(typeof result.current.invalidateReviews).toBe('function');
        expect(typeof result.current.invalidateAll).toBe('function');
    });

    test('invalidateProjects 失效 projects 列表 key', async () => {
        const { result } = renderHook(() => useInvalidateOnMutation(), { wrapper: createWrapper() });
        await result.current.invalidateProjects();
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: PROJECT_KEYS.lists() });
    });

    test('invalidateChapters 带上当前项目 id', async () => {
        const { result } = renderHook(() => useInvalidateOnMutation(), { wrapper: createWrapper() });
        await result.current.invalidateChapters();
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CHAPTER_KEYS.lists('p1') });
    });

    test('invalidateMaterials 带上当前项目 id', async () => {
        const { result } = renderHook(() => useInvalidateOnMutation(), { wrapper: createWrapper() });
        await result.current.invalidateMaterials();
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: MATERIAL_KEYS.lists('p1') });
    });

    test('invalidateReviews 失效 reviews 列表 key', async () => {
        const { result } = renderHook(() => useInvalidateOnMutation(), { wrapper: createWrapper() });
        await result.current.invalidateReviews({ projectId: 'p1', status: 'pending', page: 2, pageSize: 20 });
        // 如实断言：REVIEW_KEYS.lists 目前只吃 projectId，status/page 不进 key
        // （即"按筛选条件精准失效"并不存在——传参被忽略，属待改进项，见测试名不夸大）
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: REVIEW_KEYS.lists('p1') });
    });

    test('invalidateAll 不带 key（全量失效）', async () => {
        const { result } = renderHook(() => useInvalidateOnMutation(), { wrapper: createWrapper() });
        await result.current.invalidateAll();
        expect(invalidateSpy).toHaveBeenCalledWith();
    });
});
