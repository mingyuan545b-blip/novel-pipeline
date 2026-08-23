import { chapterAuditApi } from '../../services/api';
import logger from '../../shared/logger';
import s from './AuditBatchPanel.module.css';

export default function AuditBatchPanel({
    selectedForBatch,
    batchRepairing, setBatchRepairing,
    batchTaskId: _batchTaskId, setBatchTaskId,
    batchProgress, setBatchProgress,
    setSelectedForBatch,
    currentProject, selectedRepairModel,
    buttonPollRefs,
    setChapterAuditData,
    repairingChapter, retryTaskId,
}) {
    if (selectedForBatch.size === 0) return null;

    const handleBatchRepair = async () => {
        if (batchRepairing || repairingChapter || retryTaskId) return;
        if (!confirm(`确认顺序返修${selectedForBatch.size}章？每章修完再修下一章，返修+审核通过后自动执行复审→定稿→润色→素材更新`)) return;
        setBatchRepairing(true);
        const ids = [...selectedForBatch];
        const [provider, model] = (selectedRepairModel || '').split('|');
        try {
            const res = await chapterAuditApi.batchRepair(currentProject.id, {
                chapterIds: ids, provider: provider || undefined, model: model || undefined,
                maxRetries: 10, autoReview: true, followUpPipeline: true,
            });
            const { taskId } = res.data;
            setBatchTaskId(taskId);
            const pollInterval = setInterval(async () => {
                try {
                    const status = (await chapterAuditApi.batchRepairStatus(taskId)).data;
                    setBatchProgress(status);
                    if (status.status === 'completed') {
                        clearInterval(pollInterval);
                        buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval);
                        setBatchTaskId(null);
                        setBatchRepairing(false);
                        setSelectedForBatch(new Set());
                        const ok = status.results.filter(r => r.allPassed).length;
                        const fail = status.results.filter(r => !r.allPassed).length;
                        const pipelineOk = status.results.filter(r => r.pipelineSuccess).length;
                        alert(`批量返修完成：✅${ok}章通过 ❌${fail}章未通过 | 流水线完成${pipelineOk}章`);
                        const newAudit = await chapterAuditApi.audit(currentProject.id);
                        setChapterAuditData(newAudit.data);
                    } else if (status.status === 'error' || status.status === 'failed') {
                        clearInterval(pollInterval);
                        buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval);
                        setBatchTaskId(null);
                        setBatchRepairing(false);
                        alert('批量返修失败: ' + (status.error || '未知错误'));
                    }
                } catch (e) {
                    logger.warn('AuditBatchPanel', 'batch repair poll failed:', e.message);
                    clearInterval(pollInterval);
                    buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval);
                    setBatchRepairing(false);
                }
            }, 5000);
            buttonPollRefs.current.push(pollInterval);
        } catch (e) { alert('批量返修请求失败: ' + e.message); setBatchRepairing(false); }
    };

    return (
        <button className={`cyber-btn cyber-btn-sm ${s.batchBtn}`}
            disabled={batchRepairing || !!repairingChapter || !!retryTaskId} onClick={handleBatchRepair}>
            {batchRepairing ? `⏳顺序返修中${batchProgress ? `(${batchProgress.completed}/${batchProgress.total})` : ''}...` : `🔧顺序返修+流水线(${selectedForBatch.size})`}
        </button>
    );
}
