import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';

vi.mock('../../hooks/queries', () => ({
    usePipelineContextBudget: vi.fn(() => ({ data: null })),
    usePipelineInjectionMap: vi.fn(() => ({ data: null })),
    usePipelineHookBudget: vi.fn(() => ({ data: null })),
    usePipelineRuleStack: vi.fn(() => ({ data: null })),
    usePipelineChapterIntent: vi.fn(() => ({ data: null, refetch: vi.fn() })),
    usePipelinePromptAudit: vi.fn(() => ({ data: null })),
    useRunOptimizerReport: vi.fn(() => ({ mutateAsync: vi.fn() })),
    useApplyOptimizerPattern: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

import { useToolsState } from '../../pages/pipeline/useToolsState';

describe('useToolsState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', () => {
        const { result } = renderHook(
            () => useToolsState({ id: 'p1' }),
            { wrapper: createWrapper() }
        );
        expect(result.current.contextBudgetInfo).toBe(null);
        expect(result.current.promptAuditLoading).toBe(false);
    });

    test('sets context budget info', () => {
        const { result } = renderHook(
            () => useToolsState({ id: 'p1' }),
            { wrapper: createWrapper() }
        );
        act(() => { result.current.setContextBudgetInfo({ total: 100 }); });
        expect(result.current.contextBudgetInfo).toEqual({ total: 100 });
    });
});
