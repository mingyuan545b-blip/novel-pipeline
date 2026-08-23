import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../hooks/queries/useChapterAudit', () => ({
    useChapterAuditBatchRepair: vi.fn(() => ({ mutateAsync: vi.fn() })),
    useChapterAuditBatchRepairStatus: vi.fn(() => ({ data: null })),
}));

import { useAuditBatchState } from '../../pages/pipeline/useAuditBatchState';

describe('useAuditBatchState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('should initialize with empty state', () => {
        const { result } = renderHook(() => useAuditBatchState({ id: 'p1' }));
        expect(result.current.selectedForBatch).toBeInstanceOf(Set);
        expect(result.current.selectedForBatch.size).toBe(0);
        expect(result.current.batchRepairing).toBe(false);
        expect(result.current.batchTaskId).toBeNull();
        expect(result.current.batchProgress).toBeNull();
    });

    it('should set selected for batch', () => {
        const { result } = renderHook(() => useAuditBatchState({ id: 'p1' }));
        act(() => { result.current.setSelectedForBatch(new Set(['ch1', 'ch2'])); });
        expect(result.current.selectedForBatch.size).toBe(2);
        expect(result.current.selectedForBatch.has('ch1')).toBe(true);
    });

    it('should set batch task id', () => {
        const { result } = renderHook(() => useAuditBatchState({ id: 'p1' }));
        act(() => { result.current.setBatchTaskId('task-1'); });
        expect(result.current.batchTaskId).toBe('task-1');
    });

    it('should set batch repairing', () => {
        const { result } = renderHook(() => useAuditBatchState({ id: 'p1' }));
        act(() => { result.current.setBatchRepairing(true); });
        expect(result.current.batchRepairing).toBe(true);
    });
});
