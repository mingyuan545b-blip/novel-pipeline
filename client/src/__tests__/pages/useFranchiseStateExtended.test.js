import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
    franchiseApi: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({ data: { data: { id: 'f1' } } }),
        get: vi.fn().mockResolvedValue({ data: { data: { projects: [] } } }),
        delete: vi.fn().mockResolvedValue({}),
        createProduct: vi.fn().mockResolvedValue({ data: { data: { id: 'p1' } } }),
    },
}));

vi.mock('../../pages/dashboard/useFranchiseImportState', () => ({
    useFranchiseImportState: vi.fn().mockReturnValue({
        importSourceProjectId: null, importCategories: [],
        fileParsedData: null, fileCategories: [],
        setImportSourceProjectId: vi.fn(), setImportCategories: vi.fn(),
        setFileParsedData: vi.fn(), setFileCategories: vi.fn(),
        resetImportState: vi.fn(),
    })
}));

vi.mock('../../pages/dashboard/useFranchiseProductState', () => ({
    useFranchiseProductState: vi.fn().mockReturnValue({
        products: [], addProduct: vi.fn(), deleteProduct: vi.fn(),
    })
}));

vi.mock('../../shared/logger', () => ({
    default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

describe('useFranchiseState', () => {
    const props = { loadProjects: vi.fn(), selectProject: vi.fn(), showError: vi.fn() };

    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', async () => {
        const { default: useFranchiseState } = await import('../../pages/dashboard/useFranchiseState');
        const { result } = renderHook(() => useFranchiseState(props));
        expect(result.current.franchises).toEqual([]);
        expect(result.current.showCreateFranchise).toBe(false);
        expect(result.current.franchiseForm).toEqual({ name: '', description: '', genre: '' });
    });

    test('setShowCreateFranchise toggles', async () => {
        const { default: useFranchiseState } = await import('../../pages/dashboard/useFranchiseState');
        const { result } = renderHook(() => useFranchiseState(props));
        act(() => { result.current.setShowCreateFranchise(true); });
        expect(result.current.showCreateFranchise).toBe(true);
    });

    test('setFranchiseForm updates', async () => {
        const { default: useFranchiseState } = await import('../../pages/dashboard/useFranchiseState');
        const { result } = renderHook(() => useFranchiseState(props));
        act(() => { result.current.setFranchiseForm({ name: 'Test World', description: 'desc', genre: 'urban-fantasy' }); });
        expect(result.current.franchiseForm.name).toBe('Test World');
    });

    test('toggleFranchise toggles expanded', async () => {
        const { default: useFranchiseState } = await import('../../pages/dashboard/useFranchiseState');
        const { result } = renderHook(() => useFranchiseState(props));
        act(() => { result.current.toggleFranchise('f1'); });
        expect(result.current.expandedFranchises.f1).toBe(true);
        act(() => { result.current.toggleFranchise('f1'); });
        expect(result.current.expandedFranchises.f1).toBe(false);
    });

    test('deleteFranchise cancels if not confirmed', async () => {
        const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
        const { franchiseApi } = await import('../../services/api');
        const { default: useFranchiseState } = await import('../../pages/dashboard/useFranchiseState');
        const { result } = renderHook(() => useFranchiseState(props));
        await act(async () => { await result.current.deleteFranchise({ stopPropagation: vi.fn() }, 'f1'); });
        expect(franchiseApi.delete).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    test('createFranchise returns without name', async () => {
        const { franchiseApi } = await import('../../services/api');
        const { default: useFranchiseState } = await import('../../pages/dashboard/useFranchiseState');
        const { result } = renderHook(() => useFranchiseState(props));
        await act(async () => { await result.current.createFranchise(); });
        expect(franchiseApi.create).not.toHaveBeenCalled();
    });

    test('loadFranchises calls API', async () => {
        const { franchiseApi } = await import('../../services/api');
        const { default: useFranchiseState } = await import('../../pages/dashboard/useFranchiseState');
        const { result } = renderHook(() => useFranchiseState(props));
        await act(async () => { await result.current.loadFranchises(); });
        expect(franchiseApi.list).toHaveBeenCalled();
    });
});
