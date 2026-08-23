import { chapterAuditApi } from '../../services/api';
import logger from '../../shared/logger';

export function startRepairPolling({
    taskId, interval = 3000, buttonPollRefs,
    setRetryProgress, setRepairResult, setReviewResult,
    setRetryTaskId, setRepairingChapter, setChapterAuditData,
    currentProject, onError,
}) {
    const pollInterval = setInterval(async () => {
        try {
            const status = (await chapterAuditApi.repairRetryStatus(taskId)).data;
            setRetryProgress(status);
            if (status.status === 'completed') {
                clearInterval(pollInterval);
                buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval);
                setRepairResult(status.result);
                setReviewResult(status.result?.reviewResults);
                setRetryTaskId(null);
                setRepairingChapter(null);
                const newAudit = await chapterAuditApi.audit(currentProject.id);
                setChapterAuditData(newAudit.data);
            } else if (status.status === 'error') {
                clearInterval(pollInterval);
                buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval);
                if (onError) onError(status.error || '未知错误');
                setRetryTaskId(null); setRetryProgress(null); setRepairingChapter(null);
            }
        } catch (e) {
            logger.warn('RepairPolling', 'poll failed:', e.message);
            clearInterval(pollInterval);
            buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval);
            setRepairingChapter(null);
        }
    }, interval);
    buttonPollRefs.current.push(pollInterval);
}

export function openContentWindow(title, content, width = 600) {
    const w = window.open('', '_blank', `width=${width},height=800`);
    w.document.write(`<html><head><title>${title}</title><style>body{font-family:sans-serif;padding:20px;line-height:1.8;white-space:pre-wrap;background:#1a1a2e;color:#eee;}</style></head><body>${content.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</body></html>`);
    w.document.close();
}

export function openCompareWindow(title, before, after, beforeCount, afterCount) {
    const w = window.open('', '_blank', 'width=1200,height=800');
    w.document.write(`<html><head><title>${title}</title><style>body{margin:0;font-family:sans-serif;display:flex;height:100vh;overflow:hidden;background:#0a0a1a;color:#eee;} .panel{flex:1;overflow-y:auto;padding:20px;line-height:1.8;white-space:pre-wrap;} .left{border-right:2px solid #333;background:#1a1a2e;} .right{background:#16213e;} h3{position:sticky;top:0;background:inherit;padding:8px 0;margin:0;border-bottom:1px solid #333;font-size:14px;}</style></head><body><div class="left panel"><h3>📝 返修前(${beforeCount}字)</h3>${before.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</div><div class="right panel"><h3>返修后(${afterCount}字)</h3>${after.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</div></body></html>`);
    w.document.close();
}
