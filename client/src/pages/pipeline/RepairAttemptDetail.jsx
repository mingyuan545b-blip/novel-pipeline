import { openContentWindow, openCompareWindow } from './repairPolling';
import s from './RepairAttemptDetail.module.css';

function sevClass(severity) {
    if (severity === 'critical') return s.sevCritical;
    if (severity === 'high') return s.sevHigh;
    return s.sevNormal;
}

export default function RepairAttemptDetail({ attempt: att, chapterNumber }) {
    return (
        <>
            {att.repairInstructions && (
                <div className={s.instructionBox}>
                    <div className={s.instructionLabel}>📝 返修指令</div>
                    <div className={s.instructionText}>{att.repairInstructions}</div>
                </div>
            )}
            {att.reviewContent && (
                <div className={`${s.reviewBox} ${att.reviewPassed ? s.reviewBoxPassed : s.reviewBoxFailed}`}>
                    <div className={att.reviewPassed ? s.passLabel : s.failLabel}>
                        {att.reviewPassed ? '✅ 审核通过理由' : '❌ 审核拒绝理由'}
                    </div>
                    {att.reviewSummary && <div className={s.summaryText}>{att.reviewSummary}</div>}
                    {(att.reviewIssues || []).length > 0 && (
                        <div className={s.issueList}>
                            <div className={s.issueListTitle}>问题列表 ({att.reviewIssues.length}项)</div>
                            {att.reviewIssues.map((issue, ii) => (
                                <div key={ii} className={`${s.issueBox} ${sevClass(issue.severity)}`} style={{ borderLeft: `3px solid ${issue.severity === 'critical' ? '#ff4757' : issue.severity === 'high' ? '#ffa502' : '#747d8c'}` }}>
                                    <div className={`${sevClass(issue.severity)} ${s.issueTitle}`}>
                                        [{issue.severity?.toUpperCase()}] {issue.title}
                                    </div>
                                    {issue.location && <div className={s.issueLocation}>📍 {issue.location}</div>}
                                    {issue.originalText && <div className={s.issueOriginal}>原文: <code className={s.codeInline}>{issue.originalText}</code></div>}
                                    {issue.violationReason && <div className={s.issueViolation}>违规: {issue.violationReason}</div>}
                                    {issue.howToFix && <div className={s.issueFix}>改法: {issue.howToFix}</div>}
                                    {issue.targetText && <div className={s.issueTarget}>改为: <code className={s.codeInlineGreen}>{issue.targetText}</code></div>}
                                    {issue.description && !issue.originalText && !issue.violationReason && <div className={s.issueDesc}>{issue.description}</div>}
                                </div>
                            ))}
                        </div>
                    )}
                    {(att.reviewSuggestions || []).length > 0 && (
                        <div className={s.issueList}>
                            <div className={s.suggestionTitle}>修改建议 ({att.reviewSuggestions.length})</div>
                            {att.reviewSuggestions.map((sg, si) => (
                                <div key={si} className={s.suggestionBox}>
                                    <div className={s.suggestionTitle}>{sg.title}</div>
                                    <div className={s.suggestionDesc}>{sg.description}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!(att.reviewIssues || []).length && !(att.reviewSuggestions || []).length && (
                        <div className={s.rawContent}>{att.reviewContent}</div>
                    )}
                </div>
            )}
            {(att.contentDiff || []).length > 0 && (
                <div className={s.diffBox}>
                    <div className={s.diffTitle}>📊 修改对比 ({att.contentDiff.length}处变更)</div>
                    <div className={s.diffList}>
                        {att.contentDiff.slice(0, 20).map((d, di) => (
                            <div key={di} className={s.diffItem}>
                                <div className={s.diffBefore}>L{d.line}: {d.before?.substring(0, 100)}</div>
                                <div className={s.diffAfter}>L{d.line}: {d.after?.substring(0, 100)}</div>
                            </div>
                        ))}
                        {att.contentDiff.length > 20 && <div className={s.diffMore}>...还有{att.contentDiff.length - 20}处变更</div>}
                    </div>
                </div>
            )}
            {att.contentBefore && att.contentAfter && (
                <div className={s.btnRow}>
                    <button className={`cyber-btn cyber-btn-sm ${s.btnSm}`} onClick={() => openContentWindow(`Ch${chapterNumber} ${att.attempt}次返修前`, att.contentBefore)}>📄 返修前</button>
                    <button className={`cyber-btn cyber-btn-sm ${s.btnSm}`} onClick={() => openContentWindow(`Ch${chapterNumber} ${att.attempt}次返修后`, att.contentAfter)}>📄 返修后</button>
                    <button className={`cyber-btn cyber-btn-sm ${s.btnCompare}`} onClick={() => openCompareWindow(`Ch${chapterNumber} ${att.attempt}次左右对比`, att.contentBefore, att.contentAfter, att.wordCount?.before, att.wordCount?.after)}>📄 左右对比</button>
                </div>
            )}
        </>
    );
}
