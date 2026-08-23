import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import useAppStore from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
    projectsApi: {
        list: vi.fn(() => Promise.resolve({ data: [{ id: '1', name: 'P1' }] })),
        get: vi.fn((id) => Promise.resolve({ data: { id, name: 'P1' } })),
        create: vi.fn((d) => Promise.resolve({ data: d })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
    chaptersApi: {
        list: vi.fn(() => Promise.resolve({ data: [{ id: 'c1', title: 'Ch1', status: 'written' }] })),
    },
    materialsApi: {
        list: vi.fn(() => Promise.resolve({ data: [{ id: 'm1', name: 'Mat1' }] })),
    },
}));

import useProjectState from '../../pages/dashboard/useProjectState';

describe('useProjectState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useAppStore.setState({
                projects: [],
                currentProject: null,
                chapters: [],
                materials: [],
                activeModule: 'novel',
            });
        });
    });

    test('returns initial state', () => {
        const { result } = renderHook(() => useProjectState(), { wrapper: createWrapper() });
        expect(result.current.projects).toEqual([]);
        expect(result.current.currentProject).toBe(null);
        expect(result.current.totalChapters).toBe(0);
        expect(result.current.totalMaterials).toBe(0);
    });

    test('loads projects', async () => {
        const { result } = renderHook(() => useProjectState(), { wrapper: createWrapper() });
        await act(async () => { await result.current.loadProjects(); });
        expect(result.current.projects).toEqual([{ id: '1', name: 'P1' }]);
    });

    test('selects project and loads chapters/materials', async () => {
        act(() => {
            useAppStore.setState({ projects: [{ id: '1', name: 'P1' }] });
        });
        const { result } = renderHook(() => useProjectState(), { wrapper: createWrapper() });
        await act(async () => { await result.current.selectProject({ id: '1', name: 'P1' }); });
        expect(result.current.currentProject).toBeTruthy();
    });

    test('shows error message with auto-dismiss', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useProjectState(), { wrapper: createWrapper() });
        act(() => { result.current.showError('Test error', 3000); });
        expect(result.current.errorMsg).toBe('Test error');
        act(() => { vi.advanceTimersByTime(3000); });
        expect(result.current.errorMsg).toBe(null);
        vi.useRealTimers();
    });

    test('computes standalone and franchise projects', () => {
        act(() => {
            useAppStore.setState({
                projects: [
                    { id: '1', name: 'P1', franchiseId: null },
                    { id: '2', name: 'P2', franchiseId: 'f1' },
                ],
            });
        });
        const { result } = renderHook(() => useProjectState(), { wrapper: createWrapper() });
        expect(result.current.standaloneProjects).toHaveLength(1);
        expect(result.current.franchiseProjects).toHaveLength(1);
    });

    test('counts approved chapters', () => {
        act(() => {
            useAppStore.setState({
                chapters: [
                    { id: 'c1', status: 'material-updated' },
                    { id: 'c2', status: 'written' },
                    { id: 'c3', status: 'material-updated' },
                ],
            });
        });
        const { result } = renderHook(() => useProjectState(), { wrapper: createWrapper() });
        expect(result.current.approvedChapters).toBe(2);
        expect(result.current.totalChapters).toBe(3);
    });
});
