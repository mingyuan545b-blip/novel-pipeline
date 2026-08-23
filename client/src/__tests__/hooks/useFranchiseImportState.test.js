import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
    franchiseApi: {
        list: vi.fn(), create: vi.fn(), delete: vi.fn(), get: vi.fn(),
        getProjectOverview: vi.fn(), createProduct: vi.fn(), getCharacters: vi.fn(),
        parseFile: vi.fn(), importParsed: vi.fn(),
    },
    projectsApi: { list: vi.fn() },
}));

vi.mock('../../shared/logger', () => ({
    default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { useFranchiseImportState } from '../../pages/dashboard/useFranchiseImportState';
import { franchiseApi } from '../../services/api';

describe('useFranchiseImportState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('should initialize with empty state', () => {
        const { result } = renderHook(() => useFranchiseImportState());
        expect(result.current.importSourceProjectId).toBe('');
        expect(result.current.importOverview).toBeNull();
        expect(result.current.importCategories).toEqual([]);
        expect(result.current.loadingOverview).toBe(false);
        expect(result.current.fileParsedData).toBeNull();
        expect(result.current.uploadingFile).toBe(false);
    });

    it('should toggle import category', () => {
        const { result } = renderHook(() => useFranchiseImportState());
        act(() => { result.current.toggleImportCategory('worldview'); });
        expect(result.current.importCategories).toContain('worldview');
        act(() => { result.current.toggleImportCategory('worldview'); });
        expect(result.current.importCategories).not.toContain('worldview');
    });

    it('should toggle file category', () => {
        const { result } = renderHook(() => useFranchiseImportState());
        act(() => { result.current.toggleFileCategory('character'); });
        expect(result.current.fileCategories).toContain('character');
        act(() => { result.current.toggleFileCategory('character'); });
        expect(result.current.fileCategories).not.toContain('character');
    });

    it('should reset import state', () => {
        const { result } = renderHook(() => useFranchiseImportState());
        act(() => {
            result.current.toggleImportCategory('worldview');
            result.current.toggleFileCategory('character');
        });
        act(() => { result.current.resetImportState(); });
        expect(result.current.importSourceProjectId).toBe('');
        expect(result.current.importOverview).toBeNull();
        expect(result.current.importCategories).toEqual([]);
        expect(result.current.fileParsedData).toBeNull();
        expect(result.current.fileCategories).toEqual([]);
    });

    it('should load project overview', async () => {
        franchiseApi.getProjectOverview.mockResolvedValue({
            data: { data: { categories: [{ key: 'worldview' }, { key: 'character' }] } }
        });
        const { result } = renderHook(() => useFranchiseImportState());
        await act(async () => { await result.current.loadProjectOverview('proj-1'); });
        expect(franchiseApi.getProjectOverview).toHaveBeenCalledWith('proj-1');
        expect(result.current.importCategories).toEqual(['worldview', 'character']);
    });

    it('should handle load overview error', async () => {
        franchiseApi.getProjectOverview.mockRejectedValue(new Error('Network error'));
        const { result } = renderHook(() => useFranchiseImportState());
        await act(async () => { await result.current.loadProjectOverview('proj-1'); });
        expect(result.current.importOverview).toBeNull();
    });

    it('should clear overview when projectId is empty', async () => {
        const { result } = renderHook(() => useFranchiseImportState());
        await act(async () => { await result.current.loadProjectOverview(''); });
        expect(result.current.importOverview).toBeNull();
    });
});
