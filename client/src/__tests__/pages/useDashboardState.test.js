import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../store/useAppStore', () => ({
    default: vi.fn((sel) => sel ? sel({
        currentProject: { id: 'p1', name: 'Test', genre: 'urban-fantasy', description: 'desc', targetChapters: 25 },
        projects: [], chapters: [], materials: [],
        setProjects: vi.fn(), setCurrentProject: vi.fn(),
        setChapters: vi.fn(), setMaterials: vi.fn(),
        activeModule: 'novel', setActiveModule: vi.fn(),
    }) : {
        currentProject: { id: 'p1', name: 'Test', genre: 'urban-fantasy', description: 'desc', targetChapters: 25 },
        projects: [], chapters: [], materials: [],
        setProjects: vi.fn(), setCurrentProject: vi.fn(),
        setChapters: vi.fn(), setMaterials: vi.fn(),
        activeModule: 'novel', setActiveModule: vi.fn(),
    })
}));

vi.mock('../../services/api', () => ({
    pipelineApi: {
        generateMaterials: vi.fn().mockResolvedValue({ data: { success: true } }),
        generateOutlines: vi.fn().mockResolvedValue({ data: { count: 5 } }),
    },
    chaptersApi: { list: vi.fn().mockResolvedValue({ data: [] }) },
    materialsApi: { list: vi.fn().mockResolvedValue({ data: [] }) },
    projectsApi: { list: vi.fn().mockResolvedValue({ data: [] }), get: vi.fn().mockResolvedValue({ data: {} }) },
}));

vi.mock('../../pages/dashboard/useProjectState', () => ({
    default: () => ({
        currentProject: { id: 'p1', name: 'Test', genre: 'urban-fantasy', description: 'desc', targetChapters: 25 },
        projects: [], chapters: [], materials: [],
        loadProjects: vi.fn(), selectProject: vi.fn(), showError: vi.fn(),
        setProjects: vi.fn(), setChapters: vi.fn(), setMaterials: vi.fn(),
        setErrorMsg: vi.fn(), errorMsg: null,
    })
}));

vi.mock('../../pages/dashboard/useFranchiseState', () => ({
    default: () => ({ franchises: [], loadFranchises: vi.fn() })
}));

vi.mock('../../pages/dashboard/useFlavorState', () => ({
    default: () => ({ flavorOptions: {}, loadFlavorOptions: vi.fn() })
}));

vi.mock('../../pages/dashboard/useLayoutState', () => ({
    default: () => ({ layout: {}, saveLayout: vi.fn(), loadLayout: vi.fn() })
}));

vi.mock('../../pages/dashboard/useStyleAndConstraintsState', () => ({
    default: () => ({ loadConstraintPresets: vi.fn(), loadStyleTemplate: vi.fn(), constraintPresets: [], styleTemplate: null })
}));

vi.mock('../../pages/dashboard/useWorldviewProfileState', () => ({
    default: () => ({ worldviewProfile: null, loadWorldviewProfile: vi.fn() })
}));

describe('useDashboardState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state with all sub-hooks', async () => {
        const { default: useDashboardState } = await import('../../pages/dashboard/useDashboardState');
        const { result } = renderHook(() => useDashboardState());
        expect(result.current.showCreate).toBe(false);
        expect(result.current.genLoading).toEqual({ materials: false, outlines: false });
        expect(result.current.prompt).toBe('');
        expect(result.current.generateMaterials).toBeTypeOf('function');
        expect(result.current.generateOutlines).toBeTypeOf('function');
    });

    test('setShowCreate toggles', async () => {
        const { default: useDashboardState } = await import('../../pages/dashboard/useDashboardState');
        const { result } = renderHook(() => useDashboardState());
        act(() => { result.current.setShowCreate(true); });
        expect(result.current.showCreate).toBe(true);
    });

    test('setPrompt updates', async () => {
        const { default: useDashboardState } = await import('../../pages/dashboard/useDashboardState');
        const { result } = renderHook(() => useDashboardState());
        act(() => { result.current.setPrompt('test prompt'); });
        expect(result.current.prompt).toBe('test prompt');
    });

    test('genLoading defaults to false', async () => {
        const { default: useDashboardState } = await import('../../pages/dashboard/useDashboardState');
        const { result } = renderHook(() => useDashboardState());
        expect(result.current.genLoading.materials).toBe(false);
        expect(result.current.genLoading.outlines).toBe(false);
    });
});
