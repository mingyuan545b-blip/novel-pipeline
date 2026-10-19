import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
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

    test('loads flavor options（5 类选项都真的拉到并写进 state）', async () => {
        const api = await import('../../services/api');
        api.flavorsApi.getDialects.mockResolvedValue({ data: [{ id: 'd1' }] });
        api.flavorsApi.getNamingStyles.mockResolvedValue({ data: [{ id: 'n1' }] });
        api.flavorsApi.getStyles.mockResolvedValue({ data: [{ id: 's1' }] });
        api.flavorsApi.getWorldviewTemplates.mockResolvedValue({ data: [{ id: 'w1' }] });
        api.flavorsApi.getSystemPersonas.mockResolvedValue({ data: [{ id: 'p1' }] });

        const { result } = renderHook(
            () => useFlavorState({ currentProject: { id: 'p1' }, setProjects: vi.fn(), showError: vi.fn() }),
            { wrapper: createWrapper() }
        );
        await act(async () => { await result.current.loadFlavorOptions(); });

        await waitFor(() => expect(result.current.flavorDialects).toEqual([{ id: 'd1' }]));
        expect(result.current.flavorNamingStyles).toEqual([{ id: 'n1' }]);
        expect(result.current.flavorSpeechStyles).toEqual([{ id: 's1' }]);
        expect(result.current.worldviewTemplates).toEqual([{ id: 'w1' }]);
        expect(result.current.systemPersonas).toEqual([{ id: 'p1' }]);
        expect(api.flavorsApi.getDialects).toHaveBeenCalled();
        expect(api.flavorsApi.getNamingStyles).toHaveBeenCalled();
        expect(api.flavorsApi.getStyles).toHaveBeenCalled();
        expect(api.flavorsApi.getWorldviewTemplates).toHaveBeenCalled();
        expect(api.flavorsApi.getSystemPersonas).toHaveBeenCalled();
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
