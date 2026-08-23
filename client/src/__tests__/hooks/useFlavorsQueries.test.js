import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import {
    useDialects, useDialect, useSpeechStyles, useNamingStyles,
    useSystemPersonas, useGenreProfiles, useWorldviewTemplates,
    useInferNamingStyle, useResolveGenreProfile,
    useCombinedFlavorPreview, useReloadFlavors, FLAVOR_KEYS
} from '../../hooks/queries/useFlavors';

vi.mock('../../services/api', () => ({
    flavorsApi: {
        getDialects: vi.fn(() => Promise.resolve({ data: [{ region: '南方' }] })),
        getDialect: vi.fn(() => Promise.resolve({ data: { region: '南方', rules: [] } })),
        getSpeechStyles: vi.fn(() => Promise.resolve({ data: [{ id: 's1' }] })),
        getNamingStyles: vi.fn(() => Promise.resolve({ data: [{ id: 'n1', style: 'poetic' }] })),
        getSystemPersonas: vi.fn(() => Promise.resolve({ data: [{ id: 'sp1' }] })),
        getGenreProfiles: vi.fn(() => Promise.resolve({ data: [{ id: 'gp1' }] })),
        getWorldviewTemplates: vi.fn(() => Promise.resolve({ data: [{ id: 'wt1' }] })),
        inferNamingStyle: vi.fn(() => Promise.resolve({ data: { style: 'poetic-imagery' } })),
        resolveGenreProfile: vi.fn(() => Promise.resolve({ data: { genre: 'urban-sweet' } })),
        previewCombined: vi.fn(() => Promise.resolve({ data: { preview: 'text' } })),
        reload: vi.fn(() => Promise.resolve({ data: { ok: true } })),
    }
}));

describe('FLAVOR_KEYS', () => {
    test('has correct key structures', () => {
        expect(FLAVOR_KEYS.dialects).toEqual(['flavors', 'dialects']);
        expect(FLAVOR_KEYS.styles).toEqual(['flavors', 'styles']);
        expect(FLAVOR_KEYS.preview({ genre: 'test' })[0]).toBe('flavors');
    });
});

describe('useDialects', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches dialects list', async () => {
        const { result } = renderHook(() => useDialects(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ region: '南方' }]);
    });
});

describe('useDialect', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches specific dialect', async () => {
        const { result } = renderHook(() => useDialect('南方'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
    test('does not fetch when region is null', () => {
        const { result } = renderHook(() => useDialect(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });
});

describe('useSpeechStyles', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches speech styles', async () => {
        const { result } = renderHook(() => useSpeechStyles(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useNamingStyles', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches naming styles', async () => {
        const { result } = renderHook(() => useNamingStyles(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useSystemPersonas', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches system personas', async () => {
        const { result } = renderHook(() => useSystemPersonas(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useGenreProfiles', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches genre profiles', async () => {
        const { result } = renderHook(() => useGenreProfiles(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useWorldviewTemplates', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches worldview templates', async () => {
        const { result } = renderHook(() => useWorldviewTemplates(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useInferNamingStyle', () => {
    beforeEach(() => vi.clearAllMocks());
    test('infers naming style for genre', async () => {
        const { result } = renderHook(() => useInferNamingStyle('urban-sweet'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual({ style: 'poetic-imagery' });
    });
});

describe('useResolveGenreProfile', () => {
    beforeEach(() => vi.clearAllMocks());
    test('resolves genre profile', async () => {
        const { result } = renderHook(() => useResolveGenreProfile('urban-sweet'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useCombinedFlavorPreview', () => {
    beforeEach(() => vi.clearAllMocks());
    test('previews combined flavor', async () => {
        const { result } = renderHook(() => useCombinedFlavorPreview(), { wrapper: createWrapper() });
        await act(async () => { result.current.mutate({ genre: 'test' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useReloadFlavors', () => {
    beforeEach(() => vi.clearAllMocks());
    test('reloads flavors', async () => {
        const { result } = renderHook(() => useReloadFlavors(), { wrapper: createWrapper() });
        await act(async () => { result.current.mutate(); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});
