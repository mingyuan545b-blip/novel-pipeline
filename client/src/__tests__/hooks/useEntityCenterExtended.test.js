import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import {
    useEntityRegistry, useItemDefinitions, useCharacterBinds,
    useCharacterRelations, usePetEntities, useServantEntities,
    useCreateEntity, useUpdateEntity, useDeleteEntity, ENTITY_KEYS
} from '../../hooks/queries/useEntityCenter';

vi.mock('../../services/api', () => ({
    entityRegistryApi: { list: vi.fn(() => Promise.resolve({ data: [{ id: 'e1', name: 'test' }] })), create: vi.fn(() => Promise.resolve({ data: { id: 'new1' } })), update: vi.fn(() => Promise.resolve({ data: { id: 'e1', updated: true } })), delete: vi.fn(() => Promise.resolve({ data: { deleted: true } })) },
    itemDefinitionsApi: { list: vi.fn(() => Promise.resolve({ data: [{ id: 'd1' }] })), create: vi.fn(() => Promise.resolve({ data: { id: 'new1' } })), update: vi.fn(() => Promise.resolve({ data: { id: 'd1' } })), delete: vi.fn(() => Promise.resolve({ data: {} })) },
    characterBindsApi: { list: vi.fn(() => Promise.resolve({ data: [] })), create: vi.fn(() => Promise.resolve({ data: {} })), update: vi.fn(() => Promise.resolve({ data: {} })), delete: vi.fn(() => Promise.resolve({ data: {} })) },
    characterRelationsApi: { list: vi.fn(() => Promise.resolve({ data: [] })), create: vi.fn(() => Promise.resolve({ data: {} })), update: vi.fn(() => Promise.resolve({ data: {} })), delete: vi.fn(() => Promise.resolve({ data: {} })) },
    petEntitiesApi: { list: vi.fn(() => Promise.resolve({ data: [] })), create: vi.fn(() => Promise.resolve({ data: {} })), update: vi.fn(() => Promise.resolve({ data: {} })), delete: vi.fn(() => Promise.resolve({ data: {} })) },
    servantEntitiesApi: { list: vi.fn(() => Promise.resolve({ data: [] })), create: vi.fn(() => Promise.resolve({ data: {} })), update: vi.fn(() => Promise.resolve({ data: {} })), delete: vi.fn(() => Promise.resolve({ data: {} })) },
}));

describe('ENTITY_KEYS', () => {
    test('generates correct key structures', () => {
        expect(ENTITY_KEYS.all).toEqual(['entities']);
        expect(ENTITY_KEYS.registry('p1', {})).toContain('p1');
    });
});

describe('useEntityRegistry', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches entity registry for project', async () => {
        const { result } = renderHook(() => useEntityRegistry('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ id: 'e1', name: 'test' }]);
    });
    test('does not fetch when projectId is null', () => {
        const { result } = renderHook(() => useEntityRegistry(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });
});

describe('useItemDefinitions', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches item definitions', async () => {
        const { result } = renderHook(() => useItemDefinitions('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useCharacterBinds', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches character binds', async () => {
        const { result } = renderHook(() => useCharacterBinds('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useCharacterRelations', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches character relations', async () => {
        const { result } = renderHook(() => useCharacterRelations('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('usePetEntities', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches pet entities', async () => {
        const { result } = renderHook(() => usePetEntities('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useServantEntities', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches servant entities', async () => {
        const { result } = renderHook(() => useServantEntities('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useCreateEntity', () => {
    beforeEach(() => vi.clearAllMocks());
    test('creates entity of specified type', async () => {
        const { result } = renderHook(() => useCreateEntity(), { wrapper: createWrapper() });
        await act(async () => { result.current.mutate({ type: 'entity-registry', data: { name: 'new' } }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useUpdateEntity', () => {
    beforeEach(() => vi.clearAllMocks());
    test('updates entity of specified type', async () => {
        const { result } = renderHook(() => useUpdateEntity(), { wrapper: createWrapper() });
        await act(async () => { result.current.mutate({ type: 'entity-registry', id: 'e1', data: { name: 'updated' } }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useDeleteEntity', () => {
    beforeEach(() => vi.clearAllMocks());
    test('deletes entity of specified type', async () => {
        const { result } = renderHook(() => useDeleteEntity(), { wrapper: createWrapper() });
        await act(async () => { result.current.mutate({ type: 'entity-registry', id: 'e1' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});
