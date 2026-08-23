import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useChapterAuditModels } from '../../hooks/queries/useChapterAudit';

vi.mock('../../services/api', () => ({
    chapterAuditApi: {
        getModels: vi.fn(() => Promise.resolve({ data: [{ id: 'spelling', name: '拼写检查' }] })),
        audit: vi.fn(() => Promise.resolve({ data: {} })),
        repair: vi.fn(() => Promise.resolve({ data: {} })),
        repairRetry: vi.fn(() => Promise.resolve({ data: {} })),
        repairRetryStatus: vi.fn(() => Promise.resolve({ data: {} })),
        repairRetryCancel: vi.fn(() => Promise.resolve({ data: {} })),
        batchRepair: vi.fn(() => Promise.resolve({ data: {} })),
        batchRepairStatus: vi.fn(() => Promise.resolve({ data: {} })),
        review: vi.fn(() => Promise.resolve({ data: {} })),
        rollback: vi.fn(() => Promise.resolve({ data: {} })),
    }
}));

describe('useChapterAuditModels', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('fetches audit models', async () => {
        const { result } = renderHook(() => useChapterAuditModels(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ id: 'spelling', name: '拼写检查' }]);
    });
});
