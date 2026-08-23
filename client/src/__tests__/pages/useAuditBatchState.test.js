import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useAuditBatchState } from '../../pages/pipeline/useAuditBatchState';

vi.mock('../../hooks/queries/useChapterAudit', () => ({
    useChapterAuditBatchRepair: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
    useChapterAuditBatchRepairStatus: vi.fn(() => ({ data: null, isLoading: false })),
}));

describe('useAuditBatchState', () => {
    beforeEach(() => vi.clearAllMocks());

    test('initializes with empty state', () => {
        const { result } = renderHook(() => useAuditBatchState({ id: 'p1' }), { wrapper: createWrapper() });
        expect(result.current.selectedForBatch).toBeInstanceOf(Set);
        expect(result.current.selectedForBatch.size).toBe(0);
        expect(result.current.batchRepairing).toBe(false);
        expect(result.current.batchTaskId).toBeNull();
        expect(result.current.batchProgress).toBeNull();
    });

    test('setSelectedForBatch updates selection', () => {
        const { result } = renderHook(() => useAuditBatchState({ id: 'p1' }), { wrapper: createWrapper() });
        act(() => { result.current.setSelectedForBatch(new Set(['c1', 'c2'])); });
        expect(result.current.selectedForBatch.size).toBe(2);
    });

    test('setBatchRepairing updates state', () => {
        const { result } = renderHook(() => useAuditBatchState({ id: 'p1' }), { wrapper: createWrapper() });
        act(() => { result.current.setBatchRepairing(true); });
        expect(result.current.batchRepairing).toBe(true);
    });

    test('setBatchTaskId updates state', () => {
        const { result } = renderHook(() => useAuditBatchState({ id: 'p1' }), { wrapper: createWrapper() });
        act(() => { result.current.setBatchTaskId('task1'); });
        expect(result.current.batchTaskId).toBe('task1');
    });
});
