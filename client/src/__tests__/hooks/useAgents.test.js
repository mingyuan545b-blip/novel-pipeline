import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useAgentsList, useAgentDetail, AGENT_KEYS } from '../../hooks/queries/useAgents';

vi.mock('../../services/api', () => ({
    agentsApi: {
        updatePrompt: vi.fn((type, d) => Promise.resolve({ data: d })),
    },
    pipelineApi: {
        getAgents: vi.fn(() => Promise.resolve({ data: [{ type: 'writer' }] })),
        getAgent: vi.fn((type) => Promise.resolve({ data: { type, prompt: 'test' } })),
    },
    promptConfigApi: {
        listAgentTemplates: vi.fn(() => Promise.resolve({ data: [] })),
        listConstraintPresets: vi.fn(() => Promise.resolve({ data: [] })),
        listStyleProfiles: vi.fn(() => Promise.resolve({ data: [] })),
        updateAgentTemplate: vi.fn((id, d) => Promise.resolve({ data: d })),
    }
}));

describe('AGENT_KEYS', () => {
    test('generates correct key structures', () => {
        expect(AGENT_KEYS.all).toEqual(['agents']);
        expect(AGENT_KEYS.lists('novel')).toEqual(['agents', 'list', 'novel']);
        expect(AGENT_KEYS.detail('writer', 'novel', 'p1')).toEqual(['agents', 'detail', 'writer', 'novel', 'p1']);
    });
});

describe('useAgentsList', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('fetches agents list', async () => {
        const { result } = renderHook(() => useAgentsList(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ type: 'writer' }]);
    });
});

describe('useAgentDetail', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when type is falsy', () => {
        const { result } = renderHook(() => useAgentDetail(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches agent detail', async () => {
        const { result } = renderHook(() => useAgentDetail('writer'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.type).toBe('writer');
    });
});
