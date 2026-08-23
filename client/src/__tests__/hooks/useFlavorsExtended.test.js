import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useReloadFlavors, useCombinedFlavorPreview, useInferNamingStyle } from '../../hooks/queries/useFlavors';

vi.mock('../../services/api', () => ({
    flavorsApi: {
        getDialects: vi.fn(() => Promise.resolve({ data: [] })),
        getDialect: vi.fn(() => Promise.resolve({ data: {} })),
        getSpeechStyles: vi.fn(() => Promise.resolve({ data: [] })),
        getNamingStyles: vi.fn(() => Promise.resolve({ data: [] })),
        getSystemPersonas: vi.fn(() => Promise.resolve({ data: [] })),
        getGenreProfiles: vi.fn(() => Promise.resolve({ data: [] })),
        getWorldviewTemplates: vi.fn(() => Promise.resolve({ data: [] })),
        inferNamingStyle: vi.fn((g) => Promise.resolve({ data: { genre: g, style: 'poetic' } })),
        resolveGenreProfile: vi.fn(() => Promise.resolve({ data: {} })),
        previewCombined: vi.fn((_c) => Promise.resolve({ data: { preview: 'ok' } })),
        reload: vi.fn(() => Promise.resolve({ data: { reloaded: true } })),
    }
}));

describe('useInferNamingStyle', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when genre is falsy', () => {
        const { result } = renderHook(() => useInferNamingStyle(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('infers naming style for genre', async () => {
        const { result } = renderHook(() => useInferNamingStyle('urban-fantasy'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.style).toBe('poetic');
    });
});

describe('useCombinedFlavorPreview', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('previews combined flavor', async () => {
        const { result } = renderHook(() => useCombinedFlavorPreview(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ dialect: 'northeast' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.preview).toBe('ok');
    });
});

describe('useReloadFlavors', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('reloads flavors', async () => {
        const { result } = renderHook(() => useReloadFlavors(), { wrapper: createWrapper() });
        act(() => { result.current.mutate(); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});
