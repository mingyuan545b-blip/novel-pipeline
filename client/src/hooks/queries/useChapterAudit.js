import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chapterAuditApi } from '../../services/api';

export const CHAPTER_AUDIT_KEYS = {
    all: ['chapter-audit'],
    models: () => [...CHAPTER_AUDIT_KEYS.all, 'models'],
    audit: (projectId) => [...CHAPTER_AUDIT_KEYS.all, 'audit', projectId],
    repair: (projectId, chapterId) => [...CHAPTER_AUDIT_KEYS.all, 'repair', projectId, chapterId],
    repairRetryStatus: (taskId) => [...CHAPTER_AUDIT_KEYS.all, 'repair-retry', taskId],
    batchRepairStatus: (taskId) => [...CHAPTER_AUDIT_KEYS.all, 'batch-repair', taskId],
    review: (projectId, chapterId) => [...CHAPTER_AUDIT_KEYS.all, 'review', projectId, chapterId],
};

export function useChapterAuditModels() {
    return useQuery({
        queryKey: CHAPTER_AUDIT_KEYS.models(),
        queryFn: () => chapterAuditApi.getModels().then(r => r.data),
        staleTime: 5 * 60 * 1000,
    });
}

export function useChapterAuditRun(projectId) {
    return useMutation({
        mutationFn: () => chapterAuditApi.audit(projectId).then(r => r.data),
    });
}

export function useChapterAuditRepair(projectId, chapterId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => chapterAuditApi.repair(projectId, chapterId, data).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: CHAPTER_AUDIT_KEYS.audit(projectId) });
            qc.invalidateQueries({ queryKey: ['chapters', 'list', projectId] });
        },
    });
}

export function useChapterAuditRepairRetry(projectId, chapterId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => chapterAuditApi.repairRetry(projectId, chapterId, data).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['chapters', 'list', projectId] });
        },
    });
}

export function useChapterAuditRepairRetryStatus(taskId, { refetchInterval = 3000, refetchIntervalInBackground = true, enabled = true } = {}) {
    return useQuery({
        queryKey: CHAPTER_AUDIT_KEYS.repairRetryStatus(taskId),
        queryFn: () => chapterAuditApi.repairRetryStatus(taskId).then(r => r.data),
        enabled: enabled && !!taskId,
        refetchInterval,
        refetchIntervalInBackground,
    });
}

export function useChapterAuditRepairRetryCancel() {
    return useMutation({
        mutationFn: (taskId) => chapterAuditApi.repairRetryCancel(taskId).then(r => r.data),
    });
}

export function useChapterAuditBatchRepair(projectId) {
    return useMutation({
        mutationFn: (data) => chapterAuditApi.batchRepair(projectId, data).then(r => r.data),
    });
}

export function useChapterAuditBatchRepairStatus(taskId, { refetchInterval = 5000, refetchIntervalInBackground = true, enabled = true } = {}) {
    return useQuery({
        queryKey: CHAPTER_AUDIT_KEYS.batchRepairStatus(taskId),
        queryFn: () => chapterAuditApi.batchRepairStatus(taskId).then(r => r.data),
        enabled: enabled && !!taskId,
        refetchInterval,
        refetchIntervalInBackground,
    });
}

export function useChapterAuditReview(projectId, chapterId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => chapterAuditApi.review(projectId, chapterId, data).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: CHAPTER_AUDIT_KEYS.audit(projectId) });
        },
    });
}

export function useChapterAuditRollback(projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (snapshotId) => chapterAuditApi.rollback(projectId, snapshotId).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: CHAPTER_AUDIT_KEYS.audit(projectId) });
            qc.invalidateQueries({ queryKey: ['chapters', 'list', projectId] });
        },
    });
}
