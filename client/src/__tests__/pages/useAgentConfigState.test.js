import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useAgentConfigState } from '../../pages/pipeline/useAgentConfigState';

vi.mock('../../hooks/queries/useAgents', () => ({
    useTestAgentConnection: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
    useGetAgentModelConfig: vi.fn(() => ({ data: null, isLoading: false })),
    useSaveAgentModelConfigFromProjects: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
}));

describe('useAgentConfigState', () => {
    beforeEach(() => vi.clearAllMocks());

    test('initializes with default state', () => {
        const { result } = renderHook(() => useAgentConfigState({ id: 'p1' }), { wrapper: createWrapper() });
        expect(result.current.agentModelConfig).toBeNull();
        expect(result.current.testResults).toEqual({});
        expect(result.current.showAgentConfig).toBe(false);
    });

    test('setShowAgentConfig toggles visibility', () => {
        const { result } = renderHook(() => useAgentConfigState({ id: 'p1' }), { wrapper: createWrapper() });
        act(() => { result.current.setShowAgentConfig(true); });
        expect(result.current.showAgentConfig).toBe(true);
    });

    test('setAgentModelConfig updates config', () => {
        const { result } = renderHook(() => useAgentConfigState({ id: 'p1' }), { wrapper: createWrapper() });
        const config = { writer: { provider: 'aliyun', model: 'qwen3' } };
        act(() => { result.current.setAgentModelConfig(config); });
        expect(result.current.agentModelConfig).toEqual(config);
    });

    test('setTestResults updates results', () => {
        const { result } = renderHook(() => useAgentConfigState({ id: 'p1' }), { wrapper: createWrapper() });
        act(() => { result.current.setTestResults({ writer: { ok: true } }); });
        expect(result.current.testResults).toEqual({ writer: { ok: true } });
    });
});
