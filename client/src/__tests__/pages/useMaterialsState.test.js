import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';

vi.mock('../../services/api', () => ({
    materialsApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: d })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('../../hooks/queries', () => ({
    useMaterials: vi.fn(() => ({ data: [], refetch: vi.fn() })),
    useCreateMaterial: vi.fn(() => ({ mutateAsync: vi.fn(() => Promise.resolve({})) })),
    useDeleteMaterial: vi.fn(() => ({ mutateAsync: vi.fn(() => Promise.resolve({})) })),
    useDialects: vi.fn(() => ({ data: [] })),
    useSpeechStyles: vi.fn(() => ({ data: [] })),
    useNamingStyles: vi.fn(() => ({ data: [] })),
    useSystemPersonas: vi.fn(() => ({ data: [] })),
    MATERIAL_KEYS: { lists: (id) => ['materials', id] },
}));

vi.mock('../../pages/materials/useMaterialsIntegrityState', () => ({
    useMaterialsIntegrityState: vi.fn(() => ({
        integrityLoading: false,
        integrityResult: null,
        runIntegrityCheck: vi.fn(),
    })),
}));

import useMaterialsState from '../../pages/materials/useMaterialsState';

describe('useMaterialsState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('returns initial state', () => {
        const project = { id: 'p1', name: 'Test' };
        const { result } = renderHook(
            () => useMaterialsState(project, [], vi.fn()),
            { wrapper: createWrapper() }
        );
        expect(result.current.filterType).toBe('all');
        expect(result.current.searchTerm).toBe('');
        expect(result.current.activeView).toBe('active');
    });

    test('sets search term', () => {
        const project = { id: 'p1', name: 'Test' };
        const { result } = renderHook(
            () => useMaterialsState(project, [], vi.fn()),
            { wrapper: createWrapper() }
        );
        act(() => { result.current.setSearchTerm('角色'); });
        expect(result.current.searchTerm).toBe('角色');
    });

    test('sets filter type', () => {
        const project = { id: 'p1', name: 'Test' };
        const { result } = renderHook(
            () => useMaterialsState(project, [], vi.fn()),
            { wrapper: createWrapper() }
        );
        act(() => { result.current.setFilterType('character'); });
        expect(result.current.filterType).toBe('character');
    });

    test('selects material by id', () => {
        const project = { id: 'p1', name: 'Test' };
        const { result } = renderHook(
            () => useMaterialsState(project, [], vi.fn()),
            { wrapper: createWrapper() }
        );
        act(() => { result.current.selectMaterial('m1'); });
        expect(result.current.selectedMaterialId).toBe('m1');
    });
});
