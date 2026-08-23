import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useCharacterStates, useCharacterList, STATE_KEYS } from '../../hooks/queries/useCharacterStates';

vi.mock('../../services/api', () => ({
    characterStateApi: {
        getStates: vi.fn(() => Promise.resolve({ data: { characters: [] } })),
        getCharacters: vi.fn(() => Promise.resolve({ data: [] })),
        getKV: vi.fn(() => Promise.resolve({ data: {} })),
        getSummary: vi.fn(() => Promise.resolve({ data: {} })),
        getHistory: vi.fn(() => Promise.resolve({ data: [] })),
        getMeta: vi.fn(() => Promise.resolve({ data: {} })),
        sync: vi.fn(() => Promise.resolve({ data: {} })),
    }
}));

describe('STATE_KEYS', () => {
    test('generates correct key structures', () => {
        expect(STATE_KEYS.all).toEqual(['character-states']);
        expect(STATE_KEYS.states('p1')).toEqual(['character-states', 'states', 'p1', 'all']);
        expect(STATE_KEYS.characters('p1', 5)).toEqual(['character-states', 'characters', 'p1', 5]);
    });
});

describe('useCharacterStates', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when projectId is falsy', () => {
        const { result } = renderHook(() => useCharacterStates(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches character states', async () => {
        const { result } = renderHook(() => useCharacterStates('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual({ characters: [] });
    });
});

describe('useCharacterList', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when projectId is falsy', () => {
        const { result } = renderHook(() => useCharacterList(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches character list', async () => {
        const { result } = renderHook(() => useCharacterList('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([]);
    });
});
