import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import useAppStore from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
    flavorsApi: {
        getDialects: vi.fn(() => Promise.resolve({ data: [] })),
        getSpeechStyles: vi.fn(() => Promise.resolve({ data: [] })),
        getStyles: vi.fn(() => Promise.resolve({ data: [] })),
        getNamingStyles: vi.fn(() => Promise.resolve({ data: [] })),
        getSystemPersonas: vi.fn(() => Promise.resolve({ data: [] })),
        getWorldviewTemplates: vi.fn(() => Promise.resolve({ data: [] })),
        getGenreProfiles: vi.fn(() => Promise.resolve({ data: [] })),
    },
    projectsApi: {
        update: vi.fn(() => Promise.resolve({ data: {} })),
        list: vi.fn(() => Promise.resolve({ data: [] })),
    },
}));

import useFlavorState from '../../pages/dashboard/useFlavorState';

describe('useFlavorState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useAppStore.setState({
                currentProject: { id: 'p1', name: 'Test' },
            });
        });
    });

    test('returns initial state', () => {
        const { result } = renderHook(
            () => useFlavorState({ currentProject: null, setProjects: vi.fn(), showError: vi.fn() }),
            { wrapper: createWrapper() }
        );
        expect(result.current.flavorDialects).toEqual([]);
        expect(result.current.flavorNamingStyles).toEqual([]);
        expect(result.current.flavorSpeechStyles).toEqual([]);
        expect(result.current.editingFlavor).toBe(false);
    });

    test('loads flavor options', async () => {
        const { result } = renderHook(
            () => useFlavorState({ currentProject: { id: 'p1' }, setProjects: vi.fn(), showError: vi.fn() }),
            { wrapper: createWrapper() }
        );
        await act(async () => { await result.current.loadFlavorOptions(); });
    });

    test('starts edit flavor', () => {
        const { result } = renderHook(
            () => useFlavorState({ currentProject: { id: 'p1', styleProfile: {} }, setProjects: vi.fn(), showError: vi.fn() }),
            { wrapper: createWrapper() }
        );
        act(() => { result.current.startEditFlavor(); });
        expect(result.current.editingFlavor).toBe(true);
    });
});
