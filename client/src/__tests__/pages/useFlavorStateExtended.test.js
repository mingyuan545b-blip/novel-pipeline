import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
    flavorsApi: {
        getNamingStyles: vi.fn().mockResolvedValue({ data: [] }),
        getDialects: vi.fn().mockResolvedValue({ data: [] }),
        getStyles: vi.fn().mockResolvedValue({ data: [] }),
        getWorldviewTemplates: vi.fn().mockResolvedValue({ data: [] }),
        getSystemPersonas: vi.fn().mockResolvedValue({ data: [] }),
        previewDialect: vi.fn().mockResolvedValue({ data: {} }),
        previewStyle: vi.fn().mockResolvedValue({ data: {} }),
        previewNamingStyle: vi.fn().mockResolvedValue({ data: {} }),
        previewSystemPersona: vi.fn().mockResolvedValue({ data: {} }),
        getWorldviewTemplate: vi.fn().mockResolvedValue({ data: {} }),
    },
    projectsApi: {
        update: vi.fn().mockResolvedValue({ data: {} }),
        list: vi.fn().mockResolvedValue({ data: [] }),
    },
}));

vi.mock('../../shared/logger', () => ({
    default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

describe('useFlavorState', () => {
    const props = {
        currentProject: { id: 'p1', styleProfile: { namingStyle: 'poetic-imagery' } },
        setProjects: vi.fn(),
        showError: vi.fn(),
    };

    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', async () => {
        const { default: useFlavorState } = await import('../../pages/dashboard/useFlavorState');
        const { result } = renderHook(() => useFlavorState(props));
        expect(result.current.editingFlavor).toBe(false);
        expect(result.current.flavorNamingStyles).toEqual([]);
        expect(result.current.expandedFlavorDetail).toBeNull();
    });

    test('setEditingFlavor toggles', async () => {
        const { default: useFlavorState } = await import('../../pages/dashboard/useFlavorState');
        const { result } = renderHook(() => useFlavorState(props));
        act(() => { result.current.setEditingFlavor(true); });
        expect(result.current.editingFlavor).toBe(true);
    });

    test('startEditFlavor sets form from project', async () => {
        const { default: useFlavorState } = await import('../../pages/dashboard/useFlavorState');
        const { result } = renderHook(() => useFlavorState(props));
        act(() => { result.current.startEditFlavor(); });
        expect(result.current.editingFlavor).toBe(true);
        expect(result.current.flavorForm.namingStyle).toBe('poetic-imagery');
    });

    test('setFlavorForm updates', async () => {
        const { default: useFlavorState } = await import('../../pages/dashboard/useFlavorState');
        const { result } = renderHook(() => useFlavorState(props));
        act(() => { result.current.setFlavorForm(prev => ({ ...prev, defaultDialect: 'beijing' })); });
        expect(result.current.flavorForm.defaultDialect).toBe('beijing');
    });

    test('closeFlavorDetail clears', async () => {
        const { default: useFlavorState } = await import('../../pages/dashboard/useFlavorState');
        const { result } = renderHook(() => useFlavorState(props));
        act(() => { result.current.closeFlavorDetail(); });
        expect(result.current.expandedFlavorDetail).toBeNull();
        expect(result.current.flavorDetailData).toBeNull();
    });

    test('handleFlavorTagClick toggles same tag off', async () => {
        const { default: useFlavorState } = await import('../../pages/dashboard/useFlavorState');
        const { result } = renderHook(() => useFlavorState(props));
        // First click to expand
        await act(async () => { await result.current.handleFlavorTagClick('dialect', 'd1'); });
        expect(result.current.expandedFlavorDetail).toBe('dialect');
        // Second click to collapse
        await act(async () => { await result.current.handleFlavorTagClick('dialect', 'd1'); });
        expect(result.current.expandedFlavorDetail).toBeNull();
    });

    test('INITIAL_FLAVOR_FORM has expected defaults', async () => {
        const { default: useFlavorState } = await import('../../pages/dashboard/useFlavorState');
        const { result } = renderHook(() => useFlavorState({
            currentProject: { id: 'p1', styleProfile: {} },
            setProjects: vi.fn(),
            showError: vi.fn(),
        }));
        expect(result.current.flavorForm.namingStyleIntensity).toBe('medium');
        expect(result.current.flavorForm.defaultDialectIntensity).toBe('medium');
    });
});
