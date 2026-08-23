import { openContentWindow, openCompareWindow } from './repairPolling';
import RepairAttemptDetail from './RepairAttemptDetail';
import s from './AuditReviewPanel.module.css';

function getResultClasses(r) {
    const p = r.allPassed || r.violationsAfter === 0, f = r.success === false;
    return {
        bg: f ? s.resultBgFail : p ? s.resultBgPass : s.resultBgPartial,
        title: f ? s.resultTitleFail : p ? s.resultTitlePass : s.resultTitlePartial,
        icon: f ? '❌' : p ? '✅' : '⚠️',
        label: f ? '失败' : p ? '全部通过' : '完成',
    };
}

export default function RepairResultCard({
    repairResult, reviewResult, retryCount, expandedAttempt,
    repairingChapter, retryTaskId, reviewLoading,
    onClear, onAutoRetry, onManualRetry, onPipeline, onReview, onRollback,
    setExpandedAttempt,
}) {
    if (!repairResult) return null;
    const rc = getResultClasses(repairResult);

    return (
        <div className={`${s.repairResult} ${rc.bg}`}>
            <div className={s.resultHeader}>
                <span className={`${s.resultTitle} ${rc.title}`}>
                    {rc.icon} Ch{repairResult.chapterNumber} 返修{rc.label}{repairResult.attempts ? ` (${repairResult.attempts}次尝试)` : retryCount > 0 ? ` (共${retryCount}次重试)` : ''}
                </span>
                <button className={s.closeBtn} onClick={onClear}>✕</button>
            </div>
            {repairResult.success === false && repairResult.error && <div className={s.errorMsg}>错误: {repairResult.error}</div>}
            {repairResult.success !== false && <div className={s.resultStats}>修复{repairResult.violationsFixed ?? 0}项 | 剩余{repairResult.violationsAfter ?? 0}项 | 字数{repairResult.oldWordCount}→{repairResult.newWordCount}({repairResult.wordCountDelta > 0 ? '+' : ''}{repairResult.wordCountDelta})</div>}
            <div className={s.modelInfo}>模型: {repairResult.usedProvider || '未知'} / {repairResult.usedModel || '未知'}</div>
            {(repairResult.remainingViolations || []).length > 0 && <div className={s.remainingViolations}>剩余：{repairResult.remainingViolations.map(v => v.category).join('、')}</div>}

            {(repairResult.attemptHistory || []).length > 0 && (
                <div className={s.attemptHistory}>
                    <div className={s.attemptHistoryTitle}>📋 返修过程详情 ({repairResult.attemptHistory.length}次尝试)</div>
                    {repairResult.attemptHistory.map((att) => {
                        const passed = att.auditClean && att.reviewPassed;
                        return (
                            <div key={att.attempt} className={`${s.attemptCard} ${passed ? s.attemptCardPass : s.attemptCardFail}`}>
                                <div className={s.attemptCardHeader}>
                                    <span className={`${s.attemptLabel} ${passed ? s.attemptLabelPass : s.attemptLabelFail}`} onClick={() => setExpandedAttempt(expandedAttempt === att.attempt ? null : att.attempt)}>
                                        第{att.attempt}次 {passed ? '✅通过' : '❌未通过'}
                                    </span>
                                    <span className={s.attemptModel}>{att.repairModel}</span>
                                </div>
                                <div className={s.attemptDetail}>违规: {att.violationsBefore}→{att.violationsAfter} (修{att.violationsFixed}项) | 字数: {att.wordCount?.before}→{att.wordCount?.after}({att.wordCount?.delta > 0 ? '+' : ''}{att.wordCount?.delta})</div>
                                <div className={`${s.attemptReview} ${att.reviewPassed ? s.attemptReviewPass : s.attemptReviewFail}`}>审核: {att.reviewPassed ? '✅通过' : '❌未通过'} {att.reviewModel ? `[${att.reviewModel}]` : ''}</div>
                                {(att.remainingViolations || []).length > 0 && <div className={s.attemptRemaining}>剩余违规: {att.remainingViolations.map(v => <span key={v.type} className={s.remainingTag}>[{v.category}] {v.desc?.substring(0, 30)}</span>)}</div>}
                                {expandedAttempt === att.attempt && <RepairAttemptDetail attempt={att} chapterNumber={repairResult.chapterNumber} />}
                            </div>
                        );
                    })}
                </div>
            )}

            {((repairResult.reviewResults || reviewResult) && !(repairResult.attemptHistory || []).length) && <ReviewResultPanel result={repairResult.reviewResults || reviewResult} />}
            {repairResult.contentBefore && repairResult.contentAfter && !(repairResult.attemptHistory || []).length && (
                <div className={s.compareBar}>
                    <button className={`cyber-btn cyber-btn-sm ${s.btnCompare}`} onClick={() => openContentWindow(`Ch${repairResult.chapterNumber} 返修前`, repairResult.contentBefore)}>📄 查看返修前全文</button>
                    <button className={`cyber-btn cyber-btn-sm ${s.btnCompare}`} onClick={() => openContentWindow(`Ch${repairResult.chapterNumber} 返修后`, repairResult.contentAfter)}>📄 查看返修后全文</button>
                    <button className={`cyber-btn cyber-btn-sm ${s.btnCompareBlue}`} onClick={() => openCompareWindow(`Ch${repairResult.chapterNumber} 左右对比`, repairResult.contentBefore, repairResult.contentAfter, repairResult.oldWordCount, repairResult.newWordCount)}>📄 左右对比</button>
                </div>
            )}
            {repairResult.pipelineResult && (
                <div className={`${s.pipelineResult} ${repairResult.pipelineResult.success ? s.pipelineResultOk : s.pipelineResultFail}`}>
                    <div className={`${s.pipelineTitle} ${repairResult.pipelineResult.success ? s.pipelineTitleOk : s.pipelineTitleFail}`}>{repairResult.pipelineResult.success ? '✅ 流水线完成' : '❌ 流水线未完成'}</div>
                    <div className={s.pipelineSteps}>{(repairResult.pipelineResult.results || []).map((r, i) => <span key={i} className={s.pipelineStepTag}>{r.step}: {r.passed ? '▲' : '▼'}</span>)}</div>
                    {repairResult.pipelineResult.finalWordCount && <div className={s.pipelineFinal}>最终字数 {repairResult.pipelineResult.finalWordCount} | 状态 {repairResult.pipelineResult.finalStatus}</div>}
                </div>
            )}
            {repairResult.pipelineError && <div className={s.pipelineError}>流水线错误: {repairResult.pipelineError}</div>}
            {repairResult.maxRetriesReached && <div className={s.maxRetriesWarning}>⚠️ 已达最大重试次数({repairResult.attempts})，仍有{repairResult.violationsAfter}项违规</div>}
            <div className={s.actionBar}>
                {!repairResult.allPassed && !repairResult.pipelineResult && <button className={`cyber-btn cyber-btn-sm ${s.btnRetryAuto}`} disabled={!!repairingChapter || !!retryTaskId || reviewLoading} onClick={onAutoRetry}>🔄 自动重试到通过+流水线</button>}
                {!repairResult.allPassed && !repairResult.pipelineResult && <button className={`cyber-btn cyber-btn-sm ${s.btnRetryManual}`} disabled={!!repairingChapter || !!retryTaskId || reviewLoading} onClick={onManualRetry}>🔄 手动再修一次</button>}
                {repairResult.allPassed && !repairResult.pipelineResult && !repairResult.pipelineError && <button className={`cyber-btn cyber-btn-sm ${s.btnPipeline}`} disabled={!!repairingChapter || !!retryTaskId} onClick={onPipeline}>▶️ 执行复审定稿润色流水线</button>}
                <button className={`cyber-btn cyber-btn-sm ${s.btnReview}`} disabled={reviewLoading || !!repairingChapter} onClick={onReview}>{reviewLoading ? '⏳审核中...' : '🔍 单独初审复审'}</button>
                {repairResult.snapshotId && <button className={`cyber-btn cyber-btn-sm ${s.btnRollback}`} disabled={!!repairingChapter} onClick={onRollback}>⏪回滚</button>}
            </div>
        </div>
    );
}
