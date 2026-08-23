/**
 * useWorldviewProfileState hook tests
 */
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../services/api', () => ({
    worldviewProfileApi: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        saveFromProject: vi.fn().mockResolvedValue({ data: {} }),
        apply: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
    },
    projectsApi: { list: vi.fn().mockResolvedValue({ data: [] }) }
}));

import useWorldviewProfileState from '../../pages/dashboard/useWorldviewProfileState';

describe('useWorldviewProfileState', () => {
    const mockShowError = vi.fn();
    const mockSetProjects = vi.fn();

    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', () => {
        const { result } = renderHook(() => useWorldviewProfileState({
            currentProject: null, setProjects: mockSetProjects, showError: mockShowError
        }));
        expect(result.current.profiles).toEqual([]);
        expect(result.current.loading).toBe(true); // useEffect triggers loadProfiles immediately
        expect(result.current.showSaveModal).toBe(false);
        expect(result.current.saveForm).toEqual({ name: '', description: '' });
        expect(result.current.saving).toBe(false);
        expect(result.current.applyingId).toBeNull();
    });

    test('loadProfiles fetches data', async () => {
        const { worldviewProfileApi } = await import('../../services/api');
        worldviewProfileApi.list.mockResolvedValue({ data: [{ id: 'wp-1', name: 'Test' }] });
        renderHook(() => useWorldviewProfileState({
            currentProject: null, setProjects: mockSetProjects, showError: mockShowError
        }));
        // Wait for the initial useEffect to complete
        await act(async () => {
            await new Promise(r => setTimeout(r, 100));
        });
        expect(worldviewProfileApi.list).toHaveBeenCalled();
    });

    test('saveFromProject skips without project', async () => {
        const { worldviewProfileApi } = await import('../../services/api');
        const { result } = renderHook(() => useWorldviewProfileState({
            currentProject: null, setProjects: mockSetProjects, showError: mockShowError
        }));
        await act(async () => { await result.current.saveFromProject(); });
        expect(worldviewProfileApi.saveFromProject).not.toHaveBeenCalled();
    });

    test('saveFromProject saves successfully', async () => {
        const { worldviewProfileApi } = await import('../../services/api');
        worldviewProfileApi.saveFromProject.mockResolvedValueOnce({ data: {} });
        worldviewProfileApi.list.mockResolvedValue({ data: [] });
        const project = { id: 'proj-1', name: 'Test Project' };
        const { result } = renderHook(() => useWorldviewProfileState({
            currentProject: project, setProjects: mockSetProjects, showError: mockShowError
        }));
        act(() => { result.current.setSaveForm({ name: 'My Template', description: 'desc' }); });
        await act(async () => { await result.current.saveFromProject(); });
        expect(worldviewProfileApi.saveFromProject).toHaveBeenCalledWith('proj-1', {
            name: 'My Template', description: 'desc'
        });
    });

    test('applyToProject skips without project', async () => {
        const { worldviewProfileApi } = await import('../../services/api');
        const { result } = renderHook(() => useWorldviewProfileState({
            currentProject: null, setProjects: mockSetProjects, showError: mockShowError
        }));
        await act(async () => { await result.current.applyToProject('wp-1'); });
        expect(worldviewProfileApi.apply).not.toHaveBeenCalled();
    });

    test('deleteProfile deletes and reloads', async () => {
        const { worldviewProfileApi } = await import('../../services/api');
        worldviewProfileApi.delete.mockResolvedValueOnce({ data: {} });
        worldviewProfileApi.list.mockResolvedValueOnce({ data: [] });
        const { result } = renderHook(() => useWorldviewProfileState({
            currentProject: null, setProjects: mockSetProjects, showError: mockShowError
        }));
        await act(async () => { await result.current.deleteProfile('wp-1'); });
        expect(worldviewProfileApi.delete).toHaveBeenCalledWith('wp-1');
    });
});
