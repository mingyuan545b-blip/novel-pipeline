import { useState, useEffect } from 'react';
import {
    useChapterAuditBatchRepair,
    useChapterAuditBatchRepairStatus,
} from '../../hooks/queries/useChapterAudit';

export function useAuditBatchState(currentProject, onAuditRefresh) {
    const [selectedForBatch, setSelectedForBatch] = useState(new Set());
    const [batchRepairing, setBatchRepairing] = useState(false);
    const [batchTaskId, setBatchTaskId] = useState(null);
    const [batchProgress, setBatchProgress] = useState(null);

    const auditBatchRepair = useChapterAuditBatchRepair(currentProject?.id);
    const batchRepairStatusData = useChapterAuditBatchRepairStatus(
        batchTaskId, { refetchInterval: 5000, enabled: !!batchTaskId },
    );

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (batchRepairStatusData.data && batchRepairStatusData.data.status === 'completed') {
            setBatchTaskId(null);
            setBatchRepairing(false);
            setSelectedForBatch(new Set());
            const status = batchRepairStatusData.data;
            const ok = status.results.filter(r => r.allPassed).length;
            const fail = status.results.filter(r => !r.allPassed).length;
            const pipelineOk = status.results.filter(r => r.pipelineSuccess).length;
            setBatchProgress(status);
            alert(`批量返修完成：✅${ok}章通过 ❌${fail}章未通过 | 流水线完成${pipelineOk}章`);
            onAuditRefresh?.();
        } else if (batchRepairStatusData.data && batchRepairStatusData.data.status === 'running') {
            setBatchProgress(batchRepairStatusData.data);
        }
    }, [batchRepairStatusData.data]); // eslint-disable-line react-hooks/exhaustive-deps
    /* eslint-enable react-hooks/set-state-in-effect */

    return {
        selectedForBatch, setSelectedForBatch,
        batchRepairing, setBatchRepairing,
        batchTaskId, setBatchTaskId,
        batchProgress, setBatchProgress,
        auditBatchRepair,
        batchRepairStatusData,
    };
}
