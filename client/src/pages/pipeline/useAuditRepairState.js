import { useState, useEffect, useMemo } from 'react';
import {
    useChapterAuditModels,
    useChapterAuditRepair,
    useChapterAuditRepairRetry,
    useChapterAuditRepairRetryCancel,
    useChapterAuditReview,
    useChapterAuditRollback,
    useChapterAuditRepairRetryStatus,
} from '../../hooks/queries';

export function useAuditRepairState(currentProject, onAuditRefresh) {
    const [repairingChapter, setRepairingChapter] = useState(null);
    const [repairingChapterId, setRepairingChapterId] = useState(null);
    const [repairInstructions, setRepairInstructions] = useState('');
    const [repairResult, setRepairResult] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const [retryTaskId, setRetryTaskId] = useState(null);
    const [retryProgress, setRetryProgress] = useState(null);
    const [expandedAttempt, setExpandedAttempt] = useState(null);
    const [autoRetryUntilPass, setAutoRetryUntilPass] = useState(false);
    const [followUpPipeline, setFollowUpPipeline] = useState(true);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewResult, setReviewResult] = useState(null);

    const { data: auditModelsData } = useChapterAuditModels();
    const repairModels = useMemo(() => auditModelsData || [], [auditModelsData]);
    const selectedRepairDefault = useMemo(() => {
        const models = auditModelsData || [];
        const def = models.find(m => m.isDefault);
        return def ? `${def.provider}|${def.model}` : '';
    }, [auditModelsData]);
    const [selectedRepairModel, setSelectedRepairModel] = useState('');

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (selectedRepairDefault) setSelectedRepairModel(selectedRepairDefault);
    }, [selectedRepairDefault]);
    /* eslint-enable react-hooks/set-state-in-effect */
    const auditRepair = useChapterAuditRepair(currentProject?.id, repairResult?.chapterId || '');
    const auditRepairRetry = useChapterAuditRepairRetry(currentProject?.id, repairResult?.chapterId || '');
    const auditReview = useChapterAuditReview(currentProject?.id, repairResult?.chapterId || '');
    const auditRollback = useChapterAuditRollback(currentProject?.id);
    const auditCancel = useChapterAuditRepairRetryCancel();
    const retryStatusData = useChapterAuditRepairRetryStatus(
        retryTaskId, { refetchInterval: 3000, enabled: !!retryTaskId },
    );
    const inlineRepair = useChapterAuditRepair(currentProject?.id, repairingChapterId || '');
    const inlineRepairRetry = useChapterAuditRepairRetry(currentProject?.id, repairingChapterId || '');

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (retryStatusData.data && (retryStatusData.data.status === 'completed' || retryStatusData.data.status === 'error')) {
            const status = retryStatusData.data;
            setRetryTaskId(null);
            if (status.status === 'completed') {
                setRepairResult(status.result);
                setReviewResult(status.result?.reviewResults);
                setRepairingChapter(null);
                onAuditRefresh?.();
            } else {
                alert('返修失败: ' + status.error);
                setRetryProgress(null);
                setRepairingChapter(null);
            }
        } else if (retryStatusData.data && retryStatusData.data.status === 'running') {
            setRetryProgress(retryStatusData.data);
        }
    }, [retryStatusData.data, onAuditRefresh]);
    /* eslint-enable react-hooks/set-state-in-effect */

    return {
        repairingChapter, setRepairingChapter,
        repairingChapterId, setRepairingChapterId,
        repairInstructions, setRepairInstructions,
        repairResult, setRepairResult,
        repairModels,
        selectedRepairModel, setSelectedRepairModel,
        retryCount, setRetryCount,
        retryTaskId, setRetryTaskId,
        retryProgress, setRetryProgress,
        expandedAttempt, setExpandedAttempt,
        autoRetryUntilPass, setAutoRetryUntilPass,
        followUpPipeline, setFollowUpPipeline,
        reviewLoading, setReviewLoading,
        reviewResult, setReviewResult,
        auditRepair,
        auditRepairRetry,
        auditReview,
        auditRollback,
        auditCancel,
        retryStatusData,
        inlineRepair,
        inlineRepairRetry,
    };
}
