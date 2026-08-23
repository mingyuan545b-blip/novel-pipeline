import { chapterAuditApi } from '../../services/api';
import { startRepairPolling } from './repairPolling';
import s from './AuditRepairPanel.module.css';

export default function AuditRepairPanel({
    chapter,
    repairingChapter, setRepairingChapter,
    repairingChapterId, setRepairingChapterId,
    repairInstructions, setRepairInstructions,
    repairModels, selectedRepairModel, setSelectedRepairModel,
    retryTaskId, batchRepairing,
    currentProject, buttonPollRefs,
    setRetryCount, setRetryProgress, setRetryTaskId,
    setRepairResult, setReviewResult, setChapterAuditData,
}) {
    if (repairingChapterId !== chapter.chapterId) return null;

    const handleRepairRetry = async () => {
        if (repairingChapter || retryTaskId || batchRepairing) return;
        setRepairingChapter(chapter.chapterNumber);
        setRetryCount(0);
        setRetryProgress({ status: 'running', progress: [], currentPhase: 'repair', currentAttempt: 1 });
        try {
            const [provider, model] = (selectedRepairModel || '').split('|');
            const autoReviewEl = document.getElementById(`autoReview_${chapter.chapterId}`);
            const followUpEl = document.getElementById(`followUpPipeline_${chapter.chapterId}`);
            const autoReview = autoReviewEl ? autoReviewEl.checked : true;
            const followUpPipeline = followUpEl ? followUpEl.checked : true;
            const res = await chapterAuditApi.repairRetry(currentProject.id, chapter.chapterId, {
                repairInstructions: repairInstructions || undefined, provider: provider || undefined,
                model: model || undefined, maxRetries: 10, autoReview, followUpPipeline,
            });
            const { taskId } = res.data;
            setRetryTaskId(taskId);
            setRepairingChapterId(null);
            setRepairInstructions('');
            startRepairPolling({
                taskId, interval: 3000, buttonPollRefs, setRetryProgress, setRepairResult,
                setReviewResult, setRetryTaskId, setRepairingChapter, setChapterAuditData,
                currentProject, onError: (err) => alert('返修失败: ' + err),
            });
        } catch (e) { alert('返修请求失败: ' + e.message); setRepairingChapter(null); setRetryProgress(null); }
    };

    const handleRepairOnce = async () => {
        if (repairingChapter || retryTaskId || batchRepairing) return;
        setRepairingChapter(chapter.chapterNumber);
        setRetryCount(0);
        try {
            const [provider, model] = (selectedRepairModel || '').split('|');
            const autoReviewEl = document.getElementById(`autoReview_${chapter.chapterId}`);
            const autoReview = autoReviewEl ? autoReviewEl.checked : true;
            const res = await chapterAuditApi.repair(currentProject.id, chapter.chapterId, {
                repairInstructions: repairInstructions || undefined, provider: provider || undefined,
                model: model || undefined, autoReview,
            });
            const result = res.data;
            if (result.success) {
                setRepairResult(result);
                setReviewResult(result.reviewResults);
                const newAudit = await chapterAuditApi.audit(currentProject.id);
                setChapterAuditData(newAudit.data);
            } else { alert('❌ 返修失败：' + result.error); }
        } catch (e) { alert('返修请求失败: ' + e.message); }
        finally { setRepairingChapter(null); setRepairingChapterId(null); setRepairInstructions(''); }
    };

    const handleCancel = () => { setRepairingChapterId(null); setRepairInstructions(''); };

    return (
        <div className={s.panel}>
            <div className={s.hint}>返修指令（留空则自动修复所有违规）</div>
            <textarea value={repairInstructions} onChange={e => setRepairInstructions(e.target.value)} placeholder="例：修复全知旁白，改为林晚视角感知；补入3个拟声词；添加2句母子对话" className={s.textarea} />
            <div className={s.optionsRow}>
                {repairModels.length > 0 && (
                    <select value={selectedRepairModel} onChange={e => setSelectedRepairModel(e.target.value)} className={s.select}>
                        {repairModels.map(m => <option key={`${m.provider}|${m.model}`} value={`${m.provider}|${m.model}`}>{m.label}{m.isDefault ? ' (默认)' : ''}</option>)}
                    </select>
                )}
                <label className={s.checkboxLabel}>
                    <input type="checkbox" defaultChecked={true} id={`autoReview_${chapter.chapterId}`} className={s.checkbox} /> 自动审核
                </label>
                <label className={s.checkboxLabel}>
                    <input type="checkbox" defaultChecked={true} id={`followUpPipeline_${chapter.chapterId}`} className={s.checkbox} /> 通过后流水线
                </label>
            </div>
            <div className={s.actionRow}>
                <button className={`cyber-btn cyber-btn-sm ${s.btnRetry}`} disabled={!!repairingChapter || !!retryTaskId || batchRepairing} onClick={handleRepairRetry}>🔄 重试到通过+流水线</button>
                <button className={`cyber-btn cyber-btn-sm ${s.btnOnce}`} disabled={!!repairingChapter || !!retryTaskId || batchRepairing} onClick={handleRepairOnce}>修一次</button>
                <button className={`cyber-btn cyber-btn-sm ${s.btnCancel}`} onClick={handleCancel}>取消</button>
            </div>
        </div>
    );
}
