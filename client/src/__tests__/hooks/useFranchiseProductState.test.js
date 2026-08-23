import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
    franchiseApi: {
        getCharacters: vi.fn(), createProduct: vi.fn(),
    },
    projectsApi: { list: vi.fn() },
}));

import { useFranchiseProductState } from '../../pages/dashboard/useFranchiseProductState';
import { franchiseApi } from '../../services/api';

describe('useFranchiseProductState', () => {
    const mockLoadProjects = vi.fn();
    const mockLoadFranchises = vi.fn();
    const mockSelectProject = vi.fn();
    const mockShowError = vi.fn();

    beforeEach(() => { vi.clearAllMocks(); });

    it('should initialize with empty state', () => {
        const { result } = renderHook(() =>
            useFranchiseProductState(mockLoadProjects, mockLoadFranchises, mockSelectProject, mockShowError)
        );
        expect(result.current.showCreateProduct).toBeNull();
        expect(result.current.productForm.name).toBe('');
        expect(result.current.availableCharacters).toEqual([]);
        expect(result.current.selectedCharacters).toEqual([]);
        expect(result.current.creatingProduct).toBe(false);
    });

    it('should toggle character selection', () => {
        const { result } = renderHook(() =>
            useFranchiseProductState(mockLoadProjects, mockLoadFranchises, mockSelectProject, mockShowError)
        );
        act(() => { result.current.toggleCharacter('char-1'); });
        expect(result.current.selectedCharacters).toContain('char-1');
        act(() => { result.current.toggleCharacter('char-1'); });
        expect(result.current.selectedCharacters).not.toContain('char-1');
    });

    it('should select all characters', () => {
        const { result } = renderHook(() =>
            useFranchiseProductState(mockLoadProjects, mockLoadFranchises, mockSelectProject, mockShowError)
        );
        act(() => {
            result.current.availableCharacters = [{ id: 'c1' }, { id: 'c2' }];
        });
    });

    it('should open create product and load characters', async () => {
        franchiseApi.getCharacters.mockResolvedValue({
            data: { data: { characters: [{ id: 'c1', name: '张三' }] } }
        });
        const { result } = renderHook(() =>
            useFranchiseProductState(mockLoadProjects, mockLoadFranchises, mockSelectProject, mockShowError)
        );
        await act(async () => { await result.current.openCreateProduct('fr-1'); });
        expect(result.current.showCreateProduct).toBe('fr-1');
        expect(franchiseApi.getCharacters).toHaveBeenCalledWith('fr-1');
    });

    it('should handle getCharacters error', async () => {
        franchiseApi.getCharacters.mockRejectedValue(new Error('fail'));
        const { result } = renderHook(() =>
            useFranchiseProductState(mockLoadProjects, mockLoadFranchises, mockSelectProject, mockShowError)
        );
        await act(async () => { await result.current.openCreateProduct('fr-1'); });
        expect(result.current.availableCharacters).toEqual([]);
    });
});
