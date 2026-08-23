import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const STORE_OBJ = {
    projects: [{ id: 'p1', name: 'Test', franchiseId: null }, { id: 'p2', name: 'Franchise', franchiseId: 'f1' }],
    currentProject: { id: 'p1', name: 'Test' },
    chapters: [{ id: 'ch1', status: 'material-updated' }, { id: 'ch2', status: 'draft' }],
    materials: [{ id: 'm1' }, { id: 'm2' }],
    activeModule: 'novel',
    setProjects: vi.fn(), setCurrentProject: vi.fn(),
    setChapters: vi.fn(), setMaterials: vi.fn(),
    setActiveModule: vi.fn(),
};

vi.mock('../../store/useAppStore', () => ({
    default: vi.fn((sel) => sel ? sel(STORE_OBJ) : STORE_OBJ),
    getState: vi.fn().mockReturnValue({ currentProject: { id: 'p1' } }),
}));

vi.mock('../../services/api', () => ({
    projectsApi: {
        list: vi.fn().mockResolvedValue({ data: [{ id: 'p1', name: 'Test' }] }),
        get: vi.fn().mockResolvedValue({ data: { id: 'p1', name: 'Test' } }),
        delete: vi.fn().mockResolvedValue({}),
    },
    chaptersApi: { list: vi.fn().mockResolvedValue({ data: [] }) },
    materialsApi: { list: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('../../shared/logger', () => ({
    default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

describe('useProjectState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns projects and currentProject', async () => {
        const { default: useProjectState } = await import('../../pages/dashboard/useProjectState');
        const { result } = renderHook(() => useProjectState());
        expect(result.current.projects).toHaveLength(2);
        expect(result.current.currentProject.id).toBe('p1');
    });

    test('computes totalChapters and approvedChapters', async () => {
        const { default: useProjectState } = await import('../../pages/dashboard/useProjectState');
        const { result } = renderHook(() => useProjectState());
        expect(result.current.totalChapters).toBe(2);
        expect(result.current.approvedChapters).toBe(1);
    });

    test('computes totalMaterials', async () => {
        const { default: useProjectState } = await import('../../pages/dashboard/useProjectState');
        const { result } = renderHook(() => useProjectState());
        expect(result.current.totalMaterials).toBe(2);
    });

    test('splits standalone and franchise projects', async () => {
        const { default: useProjectState } = await import('../../pages/dashboard/useProjectState');
        const { result } = renderHook(() => useProjectState());
        expect(result.current.standaloneProjects).toHaveLength(1);
        expect(result.current.franchiseProjects).toHaveLength(1);
    });

    test('errorMsg defaults to null', async () => {
        const { default: useProjectState } = await import('../../pages/dashboard/useProjectState');
        const { result } = renderHook(() => useProjectState());
        expect(result.current.errorMsg).toBeNull();
    });

    test('selectProject calls API', async () => {
        const { default: useProjectState } = await import('../../pages/dashboard/useProjectState');
        const { result } = renderHook(() => useProjectState());
        await act(async () => { await result.current.selectProject({ id: 'p1' }); });
        const { projectsApi } = await import('../../services/api');
        expect(projectsApi.get).toHaveBeenCalledWith('p1');
    });

    test('loadProjects calls API', async () => {
        const { default: useProjectState } = await import('../../pages/dashboard/useProjectState');
        const { result } = renderHook(() => useProjectState());
        await act(async () => { await result.current.loadProjects(); });
        const { projectsApi } = await import('../../services/api');
        expect(projectsApi.list).toHaveBeenCalled();
    });

    test('deleteProject confirms and calls API', async () => {
        const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
        const { default: useProjectState } = await import('../../pages/dashboard/useProjectState');
        const { result } = renderHook(() => useProjectState());
        const fakeEvent = { stopPropagation: vi.fn() };
        await act(async () => { await result.current.deleteProject(fakeEvent, 'p1'); });
        const { projectsApi } = await import('../../services/api');
        expect(projectsApi.delete).toHaveBeenCalledWith('p1');
        confirmSpy.mockRestore();
    });

    test('deleteProject cancels if not confirmed', async () => {
        const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
        const { default: useProjectState } = await import('../../pages/dashboard/useProjectState');
        const { result } = renderHook(() => useProjectState());
        const fakeEvent = { stopPropagation: vi.fn() };
        await act(async () => { await result.current.deleteProject(fakeEvent, 'p1'); });
        const { projectsApi } = await import('../../services/api');
        expect(projectsApi.delete).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    test('showError sets errorMsg', async () => {
        const { default: useProjectState } = await import('../../pages/dashboard/useProjectState');
        const { result } = renderHook(() => useProjectState());
        act(() => { result.current.showError('Test error'); });
        expect(result.current.errorMsg).toBe('Test error');
    });
});
