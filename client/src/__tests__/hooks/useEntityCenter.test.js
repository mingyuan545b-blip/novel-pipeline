import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useEntityRegistry, useItemDefinitions, ENTITY_KEYS } from '../../hooks/queries/useEntityCenter';

vi.mock('../../services/api', () => ({
    entityRegistryApi: {
        list: vi.fn(() => Promise.resolve({ data: [{ id: 'e1', name: 'Char1' }] })),
        create: vi.fn((d) => Promise.resolve({ data: d })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
    itemDefinitionsApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: d })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
    characterBindsApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: d })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
    characterRelationsApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: d })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
    petEntitiesApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: d })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
    servantEntitiesApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: d })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    }
}));

describe('ENTITY_KEYS', () => {
    test('generates correct key structures', () => {
        expect(ENTITY_KEYS.all).toEqual(['entities']);
        expect(ENTITY_KEYS.registry('p1', {})).toEqual(['entities', 'registry', 'p1', '{}']);
    });
});

describe('useEntityRegistry', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when projectId is falsy', () => {
        const { result } = renderHook(() => useEntityRegistry(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches entity registry', async () => {
        const { result } = renderHook(() => useEntityRegistry('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ id: 'e1', name: 'Char1' }]);
    });
});

describe('useItemDefinitions', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when projectId is falsy', () => {
        const { result } = renderHook(() => useItemDefinitions(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches item definitions', async () => {
        const { result } = renderHook(() => useItemDefinitions('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([]);
    });
});
