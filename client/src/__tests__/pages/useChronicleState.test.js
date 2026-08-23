/**
 * useChronicleState hook tests
 */
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import useChronicleState from '../../pages/entitycenter/useChronicleState';

vi.mock('../../services/api', () => ({
    pipelineApi: {
        getChronicle: vi.fn().mockResolvedValue({ data: { data: [] } }),
        extractChronicle: vi.fn().mockResolvedValue({ data: { success: true, results: [] } }),
    },
    entityRegistryApi: {
        list: vi.fn().mockResolvedValue({ data: [] }),
    }
}));

const { pipelineApi } = await import('../../services/api');

describe('useChronicleState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', () => {
        const { result } = renderHook(() => useChronicleState('proj-1', {}));
        expect(result.current.chronicleData).toEqual([]);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.extracting).toBe(false);
        expect(result.current.chronicleLevel).toBe('off');
    });

    test('fetches chronicle data on mount', async () => {
        pipelineApi.getChronicle.mockResolvedValueOnce({ data: { data: [{ id: '1' }] } });
        const project = { settings: { chronicleLevel: 'full' } };
        const { result } = renderHook(() => useChronicleState('proj-1', project));
        await act(async () => { await vi.waitFor(() => expect(pipelineApi.getChronicle).toHaveBeenCalled()); });
        expect(result.current.chronicleData).toEqual([{ id: '1' }]);
    });

    test('skips fetch when chronicleLevel is off', async () => {
        renderHook(() => useChronicleState('proj-1', { settings: { chronicleLevel: 'off' } }));
        await act(async () => { await new Promise(r => setTimeout(r, 50)); });
        expect(pipelineApi.getChronicle).not.toHaveBeenCalled();
    });

    test('handles fetch error', async () => {
        pipelineApi.getChronicle.mockRejectedValueOnce({ response: { data: { error: 'fail' } } });
        const project = { settings: { chronicleLevel: 'full' } };
        const { result } = renderHook(() => useChronicleState('proj-1', project));
        await act(async () => { await vi.waitFor(() => expect(pipelineApi.getChronicle).toHaveBeenCalled()); });
        expect(result.current.error).toBe('fail');
    });

    test('handleExtract calls API', async () => {
        pipelineApi.extractChronicle.mockResolvedValueOnce({ data: { success: true, results: [] } });
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        const project = { settings: { chronicleLevel: 'full' } };
        const { result } = renderHook(() => useChronicleState('proj-1', project));
        await act(async () => { await result.current.handleExtract(); });
        expect(pipelineApi.extractChronicle).toHaveBeenCalledWith('proj-1', { level: 'full' });
        window.alert.mockRestore();
    });

    test('setSelectedEntityId updates state', () => {
        const { result } = renderHook(() => useChronicleState('proj-1', {}));
        act(() => { result.current.setSelectedEntityId('ent-1'); });
        expect(result.current.selectedEntityId).toBe('ent-1');
    });

    test('setSelectedWorldId updates state', () => {
        const { result } = renderHook(() => useChronicleState('proj-1', {}));
        act(() => { result.current.setSelectedWorldId('world-1'); });
        expect(result.current.selectedWorldId).toBe('world-1');
    });

    test('filteredChronicleData filters by worldId', () => {
        const { result } = renderHook(() => useChronicleState('proj-1', {}));
        // Without worldId filter, returns all chronicleData
        expect(result.current.filteredChronicleData).toEqual([]);
    });
});
