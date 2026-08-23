import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useProjects, useProject, PROJECT_KEYS } from '../../hooks/queries/useProjects';

vi.mock('../../services/api', () => ({
    projectsApi: {
        list: vi.fn(() => Promise.resolve({ data: [{ id: '1', name: 'P1' }] })),
        get: vi.fn((id) => Promise.resolve({ data: { id, name: 'P1' } })),
        create: vi.fn((d) => Promise.resolve({ data: d })),
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

describe('PROJECT_KEYS', () => {
    test('generates correct key structures', () => {
        expect(PROJECT_KEYS.all).toEqual(['projects']);
        expect(PROJECT_KEYS.lists()).toEqual(['projects', 'list']);
        expect(PROJECT_KEYS.detail('abc')).toEqual(['projects', 'detail', 'abc']);
        expect(PROJECT_KEYS.constraints()).toEqual(['projects', 'constraints']);
    });
});

describe('useProjects', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('fetches project list', async () => {
        const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ id: '1', name: 'P1' }]);
    });
});

describe('useProject', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when id is falsy', () => {
        const { result } = renderHook(() => useProject(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches project by id', async () => {
        const { result } = renderHook(() => useProject('1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.id).toBe('1');
    });
});
