import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import useAppStore from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
    agentsApi: {
        get: vi.fn(() => Promise.resolve({ data: { type: 'writer', systemPrompt: 'test' } })),
    },
    promptConfigApi: {
        listAgentTemplates: vi.fn(() => Promise.resolve({ data: [] })),
        listConstraintPresets: vi.fn(() => Promise.resolve({ data: [] })),
        listStyleProfiles: vi.fn(() => Promise.resolve({ data: [] })),
        getResolvedPrompt: vi.fn(() => Promise.resolve({ data: null })),
    },
}));

vi.mock('../../hooks/queries', () => ({
    useAgentsList: vi.fn(() => ({ data: [] })),
    useUpdateAgentPrompt: vi.fn(() => ({ mutateAsync: vi.fn(() => Promise.resolve({})) })),
    useAgentConstraints: vi.fn(() => ({ data: [] })),
    useAgentProfiles: vi.fn(() => ({ data: [] })),
    useProject: vi.fn(() => ({ data: null })),
    useUpdateProject: vi.fn(() => ({ mutateAsync: vi.fn(() => Promise.resolve({})) })),
}));

vi.mock('../../pages/agents/useAgentTemplateState', () => ({
    useAgentTemplateState: vi.fn(() => ({
        templateMode: false,
        setTemplateMode: vi.fn(),
    })),
}));

import useAgentsState from '../../pages/agents/useAgentsState';

describe('useAgentsState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useAppStore.setState({
                currentProject: { id: 'p1', name: 'Test' },
            });
        });
    });

    test('returns initial state', () => {
        const { result } = renderHook(() => useAgentsState(), { wrapper: createWrapper() });
        expect(result.current.selectedAgent).toBe(null);
        expect(result.current.saving).toBe(false);
    });

    test('sets active tab', () => {
        const { result } = renderHook(() => useAgentsState(), { wrapper: createWrapper() });
        act(() => { result.current.setActiveTab('constraints'); });
        expect(result.current.activeTab).toBe('constraints');
    });

    test('sets edit prompt', () => {
        const { result } = renderHook(() => useAgentsState(), { wrapper: createWrapper() });
        act(() => { result.current.setEditPrompt('new prompt'); });
        expect(result.current.editPrompt).toBe('new prompt');
    });
});
