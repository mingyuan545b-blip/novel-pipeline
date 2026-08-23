import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { usePipelineAgents, usePipelineOutputPaths, usePipelineContextBudget } from '../../hooks/queries/usePipelineTools';

vi.mock('../../services/api', () => ({
    pipelineApi: {
        getAgents: vi.fn(() => Promise.resolve({ data: [{ type: 'writer' }] })),
        getOutputPaths: vi.fn(() => Promise.resolve({ data: { paths: [] } })),
        getChapterImages: vi.fn(() => Promise.resolve({ data: [] })),
        getContextBudget: vi.fn(() => Promise.resolve({ data: { total: 8000, used: 3000 } })),
        getInjectionMap: vi.fn(() => Promise.resolve({ data: {} })),
        getHookBudget: vi.fn(() => Promise.resolve({ data: {} })),
        getRuleStack: vi.fn(() => Promise.resolve({ data: {} })),
        getChapterIntent: vi.fn(() => Promise.resolve({ data: {} })),
        getPromptAudit: vi.fn(() => Promise.resolve({ data: {} })),
        getAgentModelConfig: vi.fn(() => Promise.resolve({ data: {} })),
        saveAgentModelConfig: vi.fn(() => Promise.resolve({ data: {} })),
        getChapterAuditData: vi.fn(() => Promise.resolve({ data: {} })),
        getRepairModels: vi.fn(() => Promise.resolve({ data: {} })),
        getContextTrace: vi.fn(() => Promise.resolve({ data: {} })),
        getLatestPromptAudit: vi.fn(() => Promise.resolve({ data: {} })),
    },
    optimizerApi: {
        report: vi.fn(() => Promise.resolve({ data: {} })),
    },
    projectsApi: {
        getAgentModelConfig: vi.fn(() => Promise.resolve({ data: {} })),
    }
}));

describe('usePipelineAgents', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('fetches pipeline agents', async () => {
        const { result } = renderHook(() => usePipelineAgents(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ type: 'writer' }]);
    });
});

describe('usePipelineOutputPaths', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not auto-fetch (enabled: false, no backend route)', () => {
        const { result } = renderHook(() => usePipelineOutputPaths('p1'), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });
});

describe('usePipelineContextBudget', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('does not fetch when projectId is falsy', () => {
        const { result } = renderHook(() => usePipelineContextBudget(null), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });

    test('fetches context budget', async () => {
        const { result } = renderHook(() => usePipelineContextBudget('p1'), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.total).toBe(8000);
    });
});
