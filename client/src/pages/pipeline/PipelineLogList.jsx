import { AGENT_ICONS, AGENT_LABELS, formatTime } from './pipelineConstants';
import s from './PipelineLogViewer.module.css';

const STATUS_STEPS = ['pipeline-start', 'pipeline-done', 'pipeline-error', 'pipeline-stop', 'cooldown', 'chapter-skip', 'outline-supplement', 'chapter-status'];
const ISSUE_CLASS = { critical: s.issueCritical, high: s.issueHigh, medium: s.issueMedium };

const DETAIL_MAX = 120;

/** 去掉消息里的 [R1 执笔] 前缀与装饰线，避免与结构化字段重复 */
function cleanMsg(msg) {
    if (!msg) return '';
    return String(msg)
        .replace(/\[R\d+\s*[^\]]*\]/g, '')
        .replace(/[━]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export default function PipelineLogList({ pipelineState, pipelineSteps, reviewLogs, selectedChapter }) {
    const hasLogs = pipelineState.logs.length > 0 || reviewLogs.length > 0;

    return (
        <div>
            <div className="cyber-section-title">执行日志</div>
            <div className={s.logSection}>
                {!hasLogs ? (
                    <div className={`${s.logRow} ${s.logEmpty}`}>暂无日志</div>
                ) : (
                    <>
                        {pipelineState.logs.map((log, idx) => {
                            const stepInfo = pipelineSteps.find(st => st.key === log.step);
                            const beijingTime = formatTime(log.timestamp || log.time);
                            // 章节号：优先日志自带，其次当前选中章节（避免"只显示R1/R2、看不出第几章"）
                            const affectedCh = log.affectedChapter || log.chapterNumber
                                || log.result?.affectedChapter || selectedChapter?.chapterNumber;
                            const detail = log.detail || log.feedback?.summary || (log.result?.feedback?.summary ?? cleanMsg(log.msg));
                            const roundNo = log.round || log.result?.round;
                            const icon = stepInfo?.icon || AGENT_ICONS[log.step] || '❓';
                            const label = stepInfo?.label || AGENT_LABELS[log.step] || log.step || '';
                            const isPassed = log.result?.passed ?? log.passed;
                            const isStatusMsg = !stepInfo && STATUS_STEPS.includes(log.step);
                            return (
                                <div key={`pl-${idx}`} className={`${s.logRow} ${isStatusMsg ? s.logRowStatus : ''}`}>
                                    <div className={s.logContent}>
                                        <span className={s.logStep} style={{ color: stepInfo?.color || undefined }}>{icon} {label}</span>
                                        {affectedCh && <span className={`${s.logChapter} cyber-badge`}>第${affectedCh}章</span>}
                                        {roundNo ? <span className={s.logRound}>第{roundNo}轮</span> : null}
                                        {log.status === 'running' && <span className="cyber-loading"></span>}
                                        {log.status === 'error' && <span className={s.logError}>{cleanMsg(log.error) ? '错误：' + cleanMsg(log.error).substring(0, 60) : '错误'}</span>}
                                        {isPassed !== undefined && (
                                            <span className={`cyber-badge ${isPassed ? 'cyber-badge-green' : 'cyber-badge-red'}`}>
                                                {isPassed ? '通过' : '未通过'}
                                            </span>
                                        )}
                                        {detail
                                            ? <span className={s.logMsg} title={String(detail)}>{String(detail).substring(0, DETAIL_MAX)}</span>
                                            : (isStatusMsg && log.msg
                                                ? <span className={s.logMsg}>{cleanMsg(log.msg).substring(0, DETAIL_MAX)}</span>
                                                : null)}
                                    </div>
                                    <span className={s.logTime}>{beijingTime}</span>
                                </div>
                            );
                        })}
                        {reviewLogs.map(review => (
                            <ReviewLogItem key={review.id} review={review} />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}

function ReviewLogItem({ review }) {
    const isPassed = review.result?.passed === true || review.result?.approved === true || review.passed === true;
    const issues = review.result?.issues || review.issues || [];
    const suggestions = review.result?.suggestions || review.suggestions || [];
    const edits = review.result?.edits || [];
    const summary = review.result?.summary || review.content || '';
    const styleScore = review.result?.styleScore;
    const round = review.round || 1;

    return (
        <div className={s.reviewRow}>
            <div className={s.reviewHeader}>
                <div className={s.reviewMeta}>
                    <span className={s.reviewType}>{AGENT_LABELS[review.type] || review.type}</span>
                    <span className={`cyber-badge ${isPassed ? 'cyber-badge-green' : 'cyber-badge-red'}`}>
                        {isPassed ? '通过' : '未通过'}
                    </span>
                    {styleScore && <span className="cyber-badge cyber-badge-blue">风格{styleScore}/10</span>}
                    <span className={s.reviewMetaMuted}>R{round}</span>
                </div>
                <span className={s.reviewTimeMuted}>{review.createdAt}</span>
            </div>
            {summary && <div className={s.reviewSummary}>{typeof summary === 'string' ? summary.substring(0, 200) : JSON.stringify(summary).substring(0, 200)}</div>}
            {issues.length > 0 && <IssueList items={issues} />}
            {edits.length > 0 && <IssueList items={edits} />}
            {suggestions.length > 0 && <SuggestionList items={suggestions} />}
        </div>
    );
}

function IssueList({ items }) {
    return (
        <div className={s.issueList}>
            {items.map((item, i) => {
                const desc = typeof item === 'string' ? item : (item.description || item.title || JSON.stringify(item));
                const severity = item.severity || 'medium';
                return <div key={i} className={`${s.issueItem} ${ISSUE_CLASS[severity] || s.issueMedium}`}>{desc.substring(0, 120)}</div>;
            })}
        </div>
    );
}

function SuggestionList({ items }) {
    return (
        <div className={s.issueList}>
            {items.slice(0, 3).map((sug, i) => {
                const desc = typeof sug === 'string' ? sug : JSON.stringify(sug);
                return <div key={i} className={s.suggestionItem}>💡 {desc.substring(0, 120)}</div>;
            })}
        </div>
    );
}
