import s from './AuditReviewPanel.module.css';

const PHASE_LABELS = {
    repair: (p) => `第${p.currentAttempt}次返修中...`,
    'repair-done': (p) => `第${p.currentAttempt}次返修完成，审核中...`,
    'pipeline-start': () => '返修通过，启动流水线...',
    'pipeline-step': () => '流水线执行中...',
    'pipeline-done': () => '流水线完成✅',
};

export default function RetryProgressBar({ retryProgress, retryTaskId, repairingChapter, onCancel }) {
    if (!retryProgress || retryProgress.status !== 'running') return null;

    const phaseLabel = PHASE_LABELS[retryProgress.currentPhase]?.(retryProgress) || '';

    return (
        <div className={s.retryProgress}>
            <div className={s.progressHeader}>
                <span className={s.progressTitle}>⏳ Ch{repairingChapter} 返修进行中.....</span>
                {retryTaskId && (
                    <button className={s.cancelBtn} onClick={onCancel}>⏹停止</button>
                )}
            </div>
            <div className={s.phaseLabel}>{phaseLabel}</div>
            <div className={s.attemptList}>
                {(retryProgress.progress || []).filter(p => p.phase === 'repair-done').map((p, i) => (
                    <div key={i} className={`${s.attemptItem} ${p.attemptRecord?.reviewPassed ? s.attemptPassed : s.attemptFailed}`}>
                        第{p.attempt}次 修复{p.attemptRecord?.violationsFixed}项剩余{p.attemptRecord?.violationsAfter}项{p.attemptRecord?.reviewPassed ? '✅审核通过' : '❌审核未通过'} [{p.attemptRecord?.repairModel}]
                        {(p.attemptRecord?.reviewIssues || []).length > 0 && <span className={s.attemptIssueCount}>问题{p.attemptRecord.reviewIssues.length}项</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}
