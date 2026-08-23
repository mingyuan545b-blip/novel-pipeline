import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useCreateEntity, useUpdateEntity, useDeleteEntity } from '../../hooks/queries/useEntityCenter';

vi.mock('../../services/api', () => ({
    entityRegistryApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: { id: 'new', ...d } })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
    itemDefinitionsApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: { id: 'new', ...d } })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
    characterBindsApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: { id: 'new', ...d } })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
    characterRelationsApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: { id: 'new', ...d } })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
    petEntitiesApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: { id: 'new', ...d } })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
    servantEntitiesApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: { id: 'new', ...d } })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    }
}));

describe('useCreateEntity', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('creates entity-registry entity', async () => {
        const { result } = renderHook(() => useCreateEntity(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ type: 'entity-registry', data: { name: 'Char1' } }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    test('creates item-definitions entity', async () => {
        const { result } = renderHook(() => useCreateEntity(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ type: 'item-definitions', data: { name: 'Item1' } }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useUpdateEntity', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('updates an entity', async () => {
        const { result } = renderHook(() => useUpdateEntity(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ type: 'entity-registry', id: 'e1', data: { name: 'Updated' } }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useDeleteEntity', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('deletes an entity', async () => {
        const { result } = renderHook(() => useDeleteEntity(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ type: 'entity-registry', id: 'e1' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});
