import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useCreateMaterial, useUpdateMaterial, useDeleteMaterial } from '../../hooks/queries/useMaterials';

vi.mock('../../services/api', () => ({
    materialsApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        get: vi.fn(() => Promise.resolve({ data: {} })),
        create: vi.fn((d) => Promise.resolve({ data: { id: 'new', ...d, projectId: 'p1' } })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    }
}));

describe('useCreateMaterial', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('creates a material', async () => {
        const { result } = renderHook(() => useCreateMaterial(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ name: 'New Material', type: 'character' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.name).toBe('New Material');
    });
});

describe('useUpdateMaterial', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('updates a material', async () => {
        const { result } = renderHook(() => useUpdateMaterial('m1', 'p1'), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ name: 'Updated' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.id).toBe('m1');
    });
});

describe('useDeleteMaterial', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('deletes a material', async () => {
        const { result } = renderHook(() => useDeleteMaterial(), { wrapper: createWrapper() });
        act(() => { result.current.mutate('m1'); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});
