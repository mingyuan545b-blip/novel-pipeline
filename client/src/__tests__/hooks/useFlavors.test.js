import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useDialects, useSpeechStyles, useNamingStyles, FLAVOR_KEYS } from '../../hooks/queries/useFlavors';

vi.mock('../../services/api', () => ({
    flavorsApi: {
        getDialects: vi.fn(() => Promise.resolve({ data: [{ id: 'northeast' }] })),
        getDialect: vi.fn((r) => Promise.resolve({ data: { id: r } })),
        getSpeechStyles: vi.fn(() => Promise.resolve({ data: [{ id: 'formal' }] })),
        getNamingStyles: vi.fn(() => Promise.resolve({ data: [{ id: 'poetic' }] })),
        getSystemPersonas: vi.fn(() => Promise.resolve({ data: [] })),
        getGenreProfiles: vi.fn(() => Promise.resolve({ data: [] })),
        getWorldviewTemplates: vi.fn(() => Promise.resolve({ data: [] })),
        inferNamingStyle: vi.fn(() => Promise.resolve({ data: {} })),
        resolveGenreProfile: vi.fn(() => Promise.resolve({ data: {} })),
        previewCombined: vi.fn(() => Promise.resolve({ data: {} })),
        reload: vi.fn(() => Promise.resolve({ data: {} })),
    }
}));

describe('FLAVOR_KEYS', () => {
    test('generates correct key structures', () => {
        expect(FLAVOR_KEYS.dialects).toEqual(['flavors', 'dialects']);
        expect(FLAVOR_KEYS.styles).toEqual(['flavors', 'styles']);
        expect(FLAVOR_KEYS.naming).toEqual(['flavors', 'naming']);
    });
});

describe('useDialects', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('fetches dialects', async () => {
        const { result } = renderHook(() => useDialects(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ id: 'northeast' }]);
    });
});

describe('useSpeechStyles', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('fetches speech styles', async () => {
        const { result } = renderHook(() => useSpeechStyles(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ id: 'formal' }]);
    });
});

describe('useNamingStyles', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('fetches naming styles', async () => {
        const { result } = renderHook(() => useNamingStyles(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ id: 'poetic' }]);
    });
});
