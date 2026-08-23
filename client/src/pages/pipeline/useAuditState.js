import { useState } from 'react';
import { useChapterAuditRun } from '../../hooks/queries';
import { useAuditRepairState } from './useAuditRepairState';
import { useAuditBatchState } from './useAuditBatchState';

export function useAuditState(currentProject) {
    const [chapterAuditData, setChapterAuditData] = useState(null);
    const [chapterAuditLoading, setChapterAuditLoading] = useState(false);
    const [auditPage, setAuditPage] = useState(1);
    const [auditPageSize] = useState(20);
    const [auditFilter, setAuditFilter] = useState('all');
    const [expandedChapter, setExpandedChapter] = useState(null);

    const auditRun = useChapterAuditRun(currentProject?.id);

    const refreshAudit = () => {
        auditRun.mutateAsync()
            .then(data => { if (!data.error) { setChapterAuditData(data); setAuditPage(1); } })
            .catch(() => {});
    };

    const repairState = useAuditRepairState(currentProject, refreshAudit);
    const batchState = useAuditBatchState(currentProject, refreshAudit);

    return {
        chapterAuditData, setChapterAuditData,
        chapterAuditLoading, setChapterAuditLoading,
        auditPage, setAuditPage,
        auditPageSize,
        auditFilter, setAuditFilter,
        expandedChapter, setExpandedChapter,
        auditRun,
        ...repairState,
        ...batchState,
    };
}
