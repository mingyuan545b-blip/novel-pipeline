import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import {
    useChapterAuditModels, useChapterAuditRun, useChapterAuditRepair,
    useChapterAuditRepairRetryStatus,
    useChapterAuditBatchRepairStatus,
    useChapterAuditRollback,
    CHAPTER_AUDIT_KEYS
} from '../../hooks/queries/useChapterAudit';

vi.mock('../../services/api', () => ({
    chapterAuditApi: {
        getModels: vi.fn(() => Promise.resolve({ data: [{ id: 'm1', name: 'gpt-4' }] })),
        audit: vi.fn(() => Promise.resolve({ data: { taskId: 't1' } })),
        repair: vi.fn(() => Promise.resolve({ data: { success: true } })),
        repairRetry: vi.fn(() => Promise.resolve({ data: { taskId: 'rt1' } })),
        repairRetryStatus: vi.fn(() => Promise.resolve({ data: { status: 'completed' } })),
        repairRetryCancel: vi.fn(() => Promise.resolve({ data: { cancelled: true } })),
        batchRepair: vi.fn(() => Promise.resolve({ data: { taskId: 'bt1' } })),
        batchRepairStatus: vi.fn(() => Promise.resolve({ data: { status: 'completed' } })),
        review: vi.fn(() => Promise.resolve({ data: { review: 'ok' } })),
        rollback: vi.fn(() => Promise.resolve({ data: { rolled: true } })),
    }
}));

describe('CHAPTER_AUDIT_KEYS', () => {
    test('generates correct key structures', () => {
        expect(CHAPTER_AUDIT_KEYS.all).toEqual(['chapter-audit']);
        expect(CHAPTER_AUDIT_KEYS.models()).toEqual(['chapter-audit', 'models']);
        expect(CHAPTER_AUDIT_KEYS.audit('p1')).toEqual(['chapter-audit', 'audit', 'p1']);
        expect(CHAPTER_AUDIT_KEYS.repair('p1', 'c1')).toEqual(['chapter-audit', 'repair', 'p1', 'c1']);
        expect(CHAPTER_AUDIT_KEYS.repairRetryStatus('t1')).toEqual(['chapter-audit', 'repair-retry', 't1']);
    });
});

describe('useChapterAuditModels', () => {
    beforeEach(() => vi.clearAllMocks());
    test('fetches audit models', async () => {
        const { result } = renderHook(() => useChapterAuditModels(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ id: 'm1', name: 'gpt-4' }]);
    });
});

describe('useChapterAuditRun', () => {
    beforeEach(() => vi.clearAllMocks());
    test('runs audit mutation', async () => {
        const { result } = renderHook(() => useChapterAuditRun('p1'), { wrapper: createWrapper() });
        await act(async () => { result.current.mutate(); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual({ taskId: 't1' });
    });
});

describe('useChapterAuditRepair', () => {
    beforeEach(() => vi.clearAllMocks());
    test('repairs chapter', async () => {
        const { result } = renderHook(() => useChapterAuditRepair('p1', 'c1'), { wrapper: createWrapper() });
        await act(async () => { result.current.mutate({ model: 'gpt-4' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useChapterAuditRepairRetryStatus', () => {
    beforeEach(() => vi.clearAllMocks());
    test('does not fetch when taskId is null', async () => {
        const { result } = renderHook(() => useChapterAuditRepairRetryStatus(null, { enabled: false }), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });
});

describe('useChapterAuditBatchRepairStatus', () => {
    beforeEach(() => vi.clearAllMocks());
    test('does not fetch when taskId is null', async () => {
        const { result } = renderHook(() => useChapterAuditBatchRepairStatus(null, { enabled: false }), { wrapper: createWrapper() });
        expect(result.current.fetchStatus).toBe('idle');
    });
});

describe('useChapterAuditRollback', () => {
    beforeEach(() => vi.clearAllMocks());
    test('rolls back to snapshot', async () => {
        const { result } = renderHook(() => useChapterAuditRollback('p1'), { wrapper: createWrapper() });
        await act(async () => { result.current.mutate('snap1'); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});
