import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import {
    useAgentsList, useAgentDetail, useUpdateAgentPrompt,
    useAgentTemplates, useUpdateAgentTemplate,
    useAgentConstraints, useAgentProfiles, AGENT_KEYS
} from '../../hooks/queries/useAgents';

vi.mock('../../services/api', () => ({
    agentsApi: { updatePrompt: vi.fn(() => Promise.resolve({ data: { updated: true } })) },
    pipelineApi: {
        getAgents: vi.fn(() => Promise.resolve({ data: [{ type: 'writer' }] })),
        getAgent: vi.fn(() => Promise.resolve({ data: { type: 'writer', system: 'prompt' } })),
    },
    promptConfigApi: {
        listAgentTemplates: vi.fn(() => Promise.resolve({ data: [{ id: 't1' }] })),
        updateAgentTemplate: vi.fn(() => Promise.resolve({ data: { id: 't1', updated: true } })),
        listConstraintPresets: vi.fn(() => Promise.resolve({ data: [{ id: 'cp1' }] })),
        listStyleProfiles: vi.fn(() => Promise.resolve({ data: [{ id: 'sp1' }] })),
    }
}));

describe('AGENT_KEYS', () => {
    test('generates correct key structures', () => {
        expect(AGENT_KEYS.all).toEqual(['agents']);
        expect(AGENT_KEYS.lists('novel')).toContain('novel');
        expect(AGENT_KEYS.detail('writer', 'novel', 'p1')).toContain('writer');
    });
});

describe('useAgentsList', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches agents list', async () => {
        const { result } = renderHook(() => useAgentsList('novel'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ type: 'writer' }]);
    });
});

describe('useAgentDetail', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches agent detail', async () => {
        const { result } = renderHook(() => useAgentDetail('writer', 'novel', 'p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.type).toBe('writer');
    });
    test('does not fetch when type is null', () => {
        const { result } = renderHook(() => useAgentDetail(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });
});

describe('useUpdateAgentPrompt', () => {
    beforeEach(() => vi.clearAllMocks());
    test('updates agent prompt', async () => {
        const { result } = renderHook(() => useUpdateAgentPrompt(), { wrapper: createWrapper() });
        await act(async () => { result.current.mutate({ type: 'writer', data: { mode: 'novel', system: 'new prompt' } }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useAgentTemplates', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches agent templates', async () => {
        const { result } = renderHook(() => useAgentTemplates(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ id: 't1' }]);
    });
});

describe('useUpdateAgentTemplate', () => {
    beforeEach(() => vi.clearAllMocks());
    test('updates agent template', async () => {
        const { result } = renderHook(() => useUpdateAgentTemplate('t1'), { wrapper: createWrapper() });
        await act(async () => { result.current.mutate({ system: 'updated' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useAgentConstraints', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches constraint presets', async () => {
        const { result } = renderHook(() => useAgentConstraints(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useAgentProfiles', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches style profiles', async () => {
        const { result } = renderHook(() => useAgentProfiles(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});
