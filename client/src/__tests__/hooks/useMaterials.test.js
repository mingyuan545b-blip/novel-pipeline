import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useMaterials, useMaterial, MATERIAL_KEYS } from '../../hooks/queries/useMaterials';
import { materialsApi } from '../../services/api';

vi.mock('../../services/api', () => ({
    materialsApi: {
        list: vi.fn(() => Promise.resolve({ data: [{ id: 'm1', name: 'Mat1' }] })),
        get: vi.fn((id) => Promise.resolve({ data: { id, name: 'Mat1' } })),
        create: vi.fn((d) => Promise.resolve({ data: { id: 'new', ...d, projectId: 'p1' } })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    }
}));

describe('MATERIAL_KEYS', () => {
    test('generates correct key structures', () => {
        expect(MATERIAL_KEYS.all).toEqual(['materials']);
        expect(MATERIAL_KEYS.lists('p1')).toEqual(['materials', 'list', 'p1']);
        expect(MATERIAL_KEYS.detail('m1')).toEqual(['materials', 'detail', 'm1']);
        expect(MATERIAL_KEYS.byType('p1', 'character')).toEqual(['materials', 'type', 'p1', 'character']);
    });
});

describe('useMaterials', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when projectId is falsy', () => {
        const { result } = renderHook(() => useMaterials(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches materials for a project', async () => {
        const { result } = renderHook(() => useMaterials('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ id: 'm1', name: 'Mat1' }]);
    });

    test('passes filters to query', async () => {
        const { result } = renderHook(() => useMaterials('p1', { type: 'character' }), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(materialsApi.list).toHaveBeenCalledWith(
            expect.objectContaining({ projectId: 'p1', type: 'character' })
        );
    });
});

describe('useMaterial', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when id is falsy', () => {
        const { result } = renderHook(() => useMaterial(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches material by id', async () => {
        const { result } = renderHook(() => useMaterial('m1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.id).toBe('m1');
    });
});
