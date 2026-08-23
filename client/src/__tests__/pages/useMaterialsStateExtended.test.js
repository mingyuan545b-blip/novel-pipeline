import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../hooks/queries', () => ({
    useMaterials: vi.fn().mockReturnValue({ data: [] }),
    useCreateMaterial: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useDeleteMaterial: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useDialects: vi.fn().mockReturnValue({ data: [] }),
    useSpeechStyles: vi.fn().mockReturnValue({ data: [] }),
    useNamingStyles: vi.fn().mockReturnValue({ data: [] }),
    useSystemPersonas: vi.fn().mockReturnValue({ data: [] }),
    MATERIAL_KEYS: { lists: vi.fn().mockReturnValue(['materials']) },
}));

vi.mock('../../services/api', () => ({
    materialsApi: { update: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../../shared/logger', () => ({
    default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../pages/materials/useMaterialsIntegrityState', () => ({
    useMaterialsIntegrityState: vi.fn().mockReturnValue({
        integrityData: null, integrityLoading: false,
        runIntegrityCheck: vi.fn(), repairAll: vi.fn(),
    })
}));

describe('useMaterialsState', () => {
    const mockMaterials = [
        { id: 'm1', name: 'World', type: 'worldview', currentContent: 'content1', archived: false },
        { id: 'm2', name: 'Character', type: 'character', currentContent: 'content2', archived: true },
        { id: 'm3', name: 'Item', type: 'item', currentContent: 'content3', archived: false },
    ];

    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', async () => {
        const { default: useMaterialsState } = await import('../../pages/materials/useMaterialsState');
        const setMaterials = vi.fn();
        const { result } = renderHook(() => useMaterialsState({ id: 'p1' }, mockMaterials, setMaterials));
        expect(result.current.filterType).toBe('all');
        expect(result.current.searchTerm).toBe('');
        expect(result.current.showCreate).toBe(false);
        expect(result.current.isEditing).toBe(false);
        expect(result.current.activeView).toBe('active');
    });

    test('setFilterType updates', async () => {
        const { default: useMaterialsState } = await import('../../pages/materials/useMaterialsState');
        const { result } = renderHook(() => useMaterialsState({ id: 'p1' }, mockMaterials, vi.fn()));
        act(() => { result.current.setFilterType('character'); });
        expect(result.current.filterType).toBe('character');
    });

    test('setSearchTerm updates', async () => {
        const { default: useMaterialsState } = await import('../../pages/materials/useMaterialsState');
        const { result } = renderHook(() => useMaterialsState({ id: 'p1' }, mockMaterials, vi.fn()));
        act(() => { result.current.setSearchTerm('World'); });
        expect(result.current.searchTerm).toBe('World');
    });

    test('setActiveView toggles', async () => {
        const { default: useMaterialsState } = await import('../../pages/materials/useMaterialsState');
        const { result } = renderHook(() => useMaterialsState({ id: 'p1' }, mockMaterials, vi.fn()));
        act(() => { result.current.setActiveView('archived'); });
        expect(result.current.activeView).toBe('archived');
    });

    test('selectMaterial updates selectedMaterialId', async () => {
        const { default: useMaterialsState } = await import('../../pages/materials/useMaterialsState');
        const { result } = renderHook(() => useMaterialsState({ id: 'p1' }, mockMaterials, vi.fn()));
        act(() => { result.current.selectMaterial('m1'); });
        expect(result.current.selectedMaterialId).toBe('m1');
        expect(result.current.isEditing).toBe(false);
    });

    test('startEdit sets editing state', async () => {
        const { default: useMaterialsState } = await import('../../pages/materials/useMaterialsState');
        const { result } = renderHook(() => useMaterialsState({ id: 'p1' }, mockMaterials, vi.fn()));
        act(() => { result.current.startEdit(mockMaterials[0]); });
        expect(result.current.editingMaterial).toBe('m1');
        expect(result.current.isEditing).toBe(true);
        expect(result.current.editForm.name).toBe('World');
    });

    test('activeMaterials filters non-archived', async () => {
        const { default: useMaterialsState } = await import('../../pages/materials/useMaterialsState');
        const { result } = renderHook(() => useMaterialsState({ id: 'p1' }, mockMaterials, vi.fn()));
        expect(result.current.activeMaterials).toHaveLength(2);
        expect(result.current.archivedMaterials).toHaveLength(1);
    });

    test('filteredMaterials filters by type', async () => {
        const { default: useMaterialsState } = await import('../../pages/materials/useMaterialsState');
        const { result } = renderHook(() => useMaterialsState({ id: 'p1' }, mockMaterials, vi.fn()));
        act(() => { result.current.setFilterType('worldview'); });
        expect(result.current.filteredMaterials).toHaveLength(1);
        expect(result.current.filteredMaterials[0].name).toBe('World');
    });

    test('filteredMaterials filters by search term', async () => {
        const { default: useMaterialsState } = await import('../../pages/materials/useMaterialsState');
        const { result } = renderHook(() => useMaterialsState({ id: 'p1' }, mockMaterials, vi.fn()));
        act(() => { result.current.setSearchTerm('World'); });
        expect(result.current.filteredMaterials).toHaveLength(1);
    });

    test('setShowCreate toggles', async () => {
        const { default: useMaterialsState } = await import('../../pages/materials/useMaterialsState');
        const { result } = renderHook(() => useMaterialsState({ id: 'p1' }, mockMaterials, vi.fn()));
        act(() => { result.current.setShowCreate(true); });
        expect(result.current.showCreate).toBe(true);
    });
});
