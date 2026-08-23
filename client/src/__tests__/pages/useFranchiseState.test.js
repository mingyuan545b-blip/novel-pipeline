/**
 * useFranchiseState hook tests
 */
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../services/api', () => ({
    franchiseApi: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({ data: { data: { id: 'fr-1' } } }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        get: vi.fn().mockResolvedValue({ data: { data: { projects: [] } } }),
        createProduct: vi.fn().mockResolvedValue({ data: { data: { id: 'prod-1' } } }),
        importParsed: vi.fn().mockResolvedValue({ data: {} }),
    }
}));

import useFranchiseState from '../../pages/dashboard/useFranchiseState';

describe('useFranchiseState', () => {
    const mockLoadProjects = vi.fn();
    const mockSelectProject = vi.fn();
    const mockShowError = vi.fn();

    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', () => {
        const { result } = renderHook(() => useFranchiseState({
            loadProjects: mockLoadProjects, selectProject: mockSelectProject, showError: mockShowError
        }));
        expect(result.current.franchises).toEqual([]);
        expect(result.current.showCreateFranchise).toBe(false);
        expect(result.current.franchiseForm).toEqual({ name: '', description: '', genre: '' });
        expect(result.current.expandedFranchises).toEqual({});
    });

    test('loadFranchises fetches data', async () => {
        const { franchiseApi } = await import('../../services/api');
        franchiseApi.list.mockResolvedValueOnce({ data: [{ id: 'fr-1', name: 'Test' }] });
        const { result } = renderHook(() => useFranchiseState({
            loadProjects: mockLoadProjects, selectProject: mockSelectProject, showError: mockShowError
        }));
        await act(async () => { await result.current.loadFranchises(); });
        expect(result.current.franchises).toEqual([{ id: 'fr-1', name: 'Test' }]);
    });

    test('toggleFranchise toggles expanded state', () => {
        const { result } = renderHook(() => useFranchiseState({
            loadProjects: mockLoadProjects, selectProject: mockSelectProject, showError: mockShowError
        }));
        act(() => { result.current.toggleFranchise('fr-1'); });
        expect(result.current.expandedFranchises['fr-1']).toBe(true);
        act(() => { result.current.toggleFranchise('fr-1'); });
        expect(result.current.expandedFranchises['fr-1']).toBe(false);
    });

    test('setShowCreateFranchise toggles dialog', () => {
        const { result } = renderHook(() => useFranchiseState({
            loadProjects: mockLoadProjects, selectProject: mockSelectProject, showError: mockShowError
        }));
        act(() => { result.current.setShowCreateFranchise(true); });
        expect(result.current.showCreateFranchise).toBe(true);
    });

    test('setFranchiseForm updates form', () => {
        const { result } = renderHook(() => useFranchiseState({
            loadProjects: mockLoadProjects, selectProject: mockSelectProject, showError: mockShowError
        }));
        act(() => { result.current.setFranchiseForm(prev => ({ ...prev, name: 'Test' })); });
        expect(result.current.franchiseForm.name).toBe('Test');
    });

    test('deleteFranchise cancels when user declines', async () => {
        vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
        const { result } = renderHook(() => useFranchiseState({
            loadProjects: mockLoadProjects, selectProject: mockSelectProject, showError: mockShowError
        }));
        const fakeEvent = { stopPropagation: vi.fn() };
        await act(async () => { await result.current.deleteFranchise(fakeEvent, 'fr-1'); });
        expect(fakeEvent.stopPropagation).toHaveBeenCalled();
        window.confirm.mockRestore();
    });

    test('createFranchise skips without name', async () => {
        const { franchiseApi } = await import('../../services/api');
        const { result } = renderHook(() => useFranchiseState({
            loadProjects: mockLoadProjects, selectProject: mockSelectProject, showError: mockShowError
        }));
        await act(async () => { await result.current.createFranchise(); });
        expect(franchiseApi.create).not.toHaveBeenCalled();
    });
});
