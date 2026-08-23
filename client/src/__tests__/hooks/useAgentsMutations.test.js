import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useUpdateAgentPrompt } from '../../hooks/queries/useAgents';

vi.mock('../../services/api', () => ({
    agentsApi: {
        updatePrompt: vi.fn((type, d) => Promise.resolve({ data: { type, ...d } })),
    },
    pipelineApi: {
        getAgents: vi.fn(() => Promise.resolve({ data: [] })),
        getAgent: vi.fn(() => Promise.resolve({ data: {} })),
    },
    promptConfigApi: {
        listAgentTemplates: vi.fn(() => Promise.resolve({ data: [] })),
        listConstraintPresets: vi.fn(() => Promise.resolve({ data: [] })),
        listStyleProfiles: vi.fn(() => Promise.resolve({ data: [] })),
        updateAgentTemplate: vi.fn((id, d) => Promise.resolve({ data: d })),
    }
}));

describe('useUpdateAgentPrompt', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('updates agent prompt', async () => {
        const { result } = renderHook(() => useUpdateAgentPrompt(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ type: 'writer', data: { prompt: 'new prompt', mode: 'novel' } }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});
