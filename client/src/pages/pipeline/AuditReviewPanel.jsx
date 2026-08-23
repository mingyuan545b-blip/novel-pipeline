import { chapterAuditApi } from '../../services/api';
import logger from '../../shared/logger';
import RepairResultCard from './RepairResultCard';
import RetryProgressBar from './RetryProgressBar';
import { startRepairPolling } from './repairPolling';

export default function AuditReviewPanel({
    repairResult, setRepairResult, retryProgress, setRetryProgress,
    retryCount, setRetryCount, expandedAttempt, setExpandedAttempt,
    reviewLoading, setReviewLoading, reviewResult, setReviewResult,
    repairingChapter, setRepairingChapter, retryTaskId, setRetryTaskId,
    selectedRepairModel, currentProject, buttonPollRefs,
    setChapterAuditData, repairInstructions,
}) {
    const clearResult = () => { setRepairResult(null); setReviewResult(null); setRetryCount(0); setRetryProgress(null); setExpandedAttempt(null); };

    const startRetryWithPolling = (chapterId, options, confirmMsg, errorMsg) => {
        if (repairingChapter || retryTaskId) return;
        if (confirmMsg && !confirm(confirmMsg)) return;
        setRepairingChapter(repairResult.chapterNumber);
        setRetryProgress({ status: 'running', progress: [], currentPhase: options.currentPhase || 'repair', currentAttempt: 1 });
        const [provider, model] = (selectedRepairModel || '').split('|');
        chapterAuditApi.repairRetry(currentProject.id, chapterId, {
            provider: provider || undefined, model: model || undefined, ...options,
        }).then(res => {
            const { taskId } = res.data;
            setRetryTaskId(taskId);
            startRepairPolling({
                taskId, interval: 3000, buttonPollRefs, setRetryProgress, setRepairResult,
                setReviewResult, setRetryTaskId, setRepairingChapter, setChapterAuditData,
                currentProject, onError: (err) => alert((errorMsg || '操作失败') + ': ' + err),
            });
        }).catch(e => { alert('请求失败: ' + e.message); setRepairingChapter(null); setRetryProgress(null); });
    };

    const handleAutoRetry = () => startRetryWithPolling(
        repairResult.chapterId,
        { maxRetries: 10, autoReview: true, followUpPipeline: true },
        '确认自动重试返修直到通过？将通过后自动执行复审→定稿→润色→素材更新',
        '自动重试失败',
    );

    const handlePipeline = () => startRetryWithPolling(
        repairResult.chapterId,
        { maxRetries: 1, autoReview: false, followUpPipeline: true, currentPhase: 'pipeline-start' },
        '确认执行复审→定稿→润色→素材更新流水线?',
        '流水线失败',
    );

    const handleManualRetry = async () => {
        if (repairingChapter || retryTaskId) return;
        setRepairingChapter(repairResult.chapterNumber);
        setRetryCount(prev => prev + 1);
        try {
            const [provider, model] = (selectedRepairModel || '').split('|');
            const res = await chapterAuditApi.repair(currentProject.id, repairResult.chapterId, {
                repairInstructions: repairInstructions || undefined, provider: provider || undefined,
                model: model || undefined, autoReview: true,
            });
            const result = res.data;
            if (result.success) {
                setRepairResult(result); setReviewResult(result.reviewResults);
                const newAudit = await chapterAuditApi.audit(currentProject.id);
                setChapterAuditData(newAudit.data);
            } else { alert('❌ 重试返修失败：' + result.error); }
        } catch (e) { alert('重试请求失败: ' + e.message); }
        finally { setRepairingChapter(null); }
    };

    const handleReview = async () => {
        setReviewLoading(true);
        try {
            const [provider, model] = (selectedRepairModel || '').split('|');
            const res = await chapterAuditApi.review(currentProject.id, repairResult.chapterId, {
                provider: provider || undefined, model: model || undefined,
            });
            setReviewResult(res.data);
        } catch (e) { alert('审核请求失败: ' + e.message); }
        finally { setReviewLoading(false); }
    };

    const handleRollback = async () => {
        if (!confirm('确认回滚到返修前版本?')) return;
        try {
            const res = await chapterAuditApi.rollback(currentProject.id, repairResult.snapshotId);
            const data = res.data;
            if (data.success) {
                alert(`已回滚Ch${data.chapterNumber}，恢复${data.restoredWordCount}字`);
                clearResult();
                const newAudit = await chapterAuditApi.audit(currentProject.id);
                setChapterAuditData(newAudit.data);
            } else { alert('回滚失败: ' + data.error); }
        } catch (e) { alert('回滚请求失败: ' + e.message); }
    };

    const handleRetryCancel = async () => {
        if (!confirm('确认停止返修？已完成的修改会保留')) return;
        try {
            await chapterAuditApi.repairRetryCancel(retryTaskId);
            setRetryTaskId(null); setRepairingChapter(null);
            const newAudit = await chapterAuditApi.audit(currentProject.id);
            setChapterAuditData(newAudit.data);
        } catch (e) { logger.error('AuditReview', 'Repair failed:', e.message); }
    };

    return (
        <>
            <RetryProgressBar
                retryProgress={retryProgress}
                retryTaskId={retryTaskId}
                repairingChapter={repairingChapter}
                onCancel={handleRetryCancel}
            />
            <RepairResultCard
                repairResult={repairResult}
                reviewResult={reviewResult}
                retryCount={retryCount}
                expandedAttempt={expandedAttempt}
                repairingChapter={repairingChapter}
                retryTaskId={retryTaskId}
                reviewLoading={reviewLoading}
                onClear={clearResult}
                onAutoRetry={handleAutoRetry}
                onManualRetry={handleManualRetry}
                onPipeline={handlePipeline}
                onReview={handleReview}
                onRollback={handleRollback}
                setExpandedAttempt={setExpandedAttempt}
            />
        </>
    );
}
