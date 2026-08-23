import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import useAppStore from '../../store/useAppStore';

vi.mock('../../hooks/queries', () => ({
    useChapterAuditRun: vi.fn(() => ({ mutateAsync: vi.fn(() => Promise.resolve({})) })),
}));

vi.mock('../../pages/pipeline/useAuditRepairState', () => ({
    useAuditRepairState: vi.fn(() => ({
        selectedRepairModel: null,
        setSelectedRepairModel: vi.fn(),
        repairLoading: false,
    })),
}));

vi.mock('../../pages/pipeline/useAuditBatchState', () => ({
    useAuditBatchState: vi.fn(() => ({
        batchLoading: false,
    })),
}));

import { useAuditState } from '../../pages/pipeline/useAuditState';

describe('useAuditState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useAppStore.setState({
                currentProject: { id: 'p1', name: 'Test' },
            });
        });
    });

    test('returns initial state', () => {
        const { result } = renderHook(() => useAuditState({ id: 'p1' }), { wrapper: createWrapper() });
        expect(result.current.chapterAuditLoading).toBe(false);
        expect(result.current.chapterAuditData).toBe(null);
    });

    test('sets audit filter', () => {
        const { result } = renderHook(() => useAuditState({ id: 'p1' }), { wrapper: createWrapper() });
        act(() => { result.current.setAuditFilter('error'); });
        expect(result.current.auditFilter).toBe('error');
    });

    test('sets audit page', () => {
        const { result } = renderHook(() => useAuditState({ id: 'p1' }), { wrapper: createWrapper() });
        act(() => { result.current.setAuditPage(2); });
        expect(result.current.auditPage).toBe(2);
    });
});
