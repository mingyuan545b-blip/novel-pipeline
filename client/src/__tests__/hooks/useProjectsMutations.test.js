import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useCreateProject, useUpdateProject, useDeleteProject } from '../../hooks/queries/useProjects';

vi.mock('../../services/api', () => ({
    projectsApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        get: vi.fn(() => Promise.resolve({ data: {} })),
        create: vi.fn((d) => Promise.resolve({ data: { id: 'new', ...d } })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
        getConstraints: vi.fn(() => Promise.resolve({ data: {} })),
        getRemediationStatus: vi.fn(() => Promise.resolve({ data: {} })),
        getCleanupStats: vi.fn(() => Promise.resolve({ data: {} })),
        getAgentModelConfig: vi.fn(() => Promise.resolve({ data: {} })),
        saveAgentModelConfig: vi.fn(() => Promise.resolve({ data: {} })),
        cleanup: vi.fn(() => Promise.resolve({ data: {} })),
        updateStyleGuidance: vi.fn(() => Promise.resolve({ data: {} })),
        remediate: vi.fn(() => Promise.resolve({ data: {} })),
        deleteRemediation: vi.fn(() => Promise.resolve({ data: {} })),
        analyzeStyle: vi.fn(() => Promise.resolve({ data: {} })),
        saveTargets: vi.fn(() => Promise.resolve({ data: {} })),
        testConnection: vi.fn(() => Promise.resolve({ data: {} })),
    }
}));

describe('useCreateProject', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('creates a project', async () => {
        const { result } = renderHook(() => useCreateProject(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ name: 'New Project', genre: 'urban-fantasy' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.name).toBe('New Project');
    });
});

describe('useUpdateProject', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('updates a project', async () => {
        const { result } = renderHook(() => useUpdateProject('p1'), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ name: 'Updated' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.id).toBe('p1');
    });
});

describe('useDeleteProject', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('deletes a project', async () => {
        const { result } = renderHook(() => useDeleteProject(), { wrapper: createWrapper() });
        act(() => { result.current.mutate('p1'); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});
