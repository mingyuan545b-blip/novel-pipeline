import SafeMarkdown from './SafeMarkdown';
import s from './ReviewResultPanel.module.css';

function sevColor(sev) {
    return sev === 'critical' ? 'var(--neon-red)' : sev === 'high' ? 'var(--neon-orange)' : 'var(--text-muted)';
}

export default function ReviewResultPanel({ result }) {
    if (!result) return null;
    const passed = result.passed;
    const issues = result.issues || [];
    const suggestions = result.suggestions || [];
    const summary = result.summary || '';

    return (
        <div className={`${s.panel} ${passed ? s.panelPass : s.panelFail}`}>
            <div className={s.resultRow} style={{ marginBottom: issues.length > 0 || suggestions.length > 0 ? 10 : 0 }}>
                <div className={`${s.resultBadge} ${passed ? s.badgePass : s.badgeFail}`}>
                    <div className={s.badgeEmoji}>{passed ? '✅' : '❌'}</div>
                    <div className={`${s.badgeText} ${passed ? s.textPass : s.textFail}`}>{passed ? '审核通过' : '未通过'}</div>
                    <div className={s.badgeModel}>{result.usedProvider}/{result.usedModel}</div>
                    {result.wordCount && <div className={s.badgeWordCount}>{result.wordCount}字</div>}
                </div>
                <div className={s.resultContent}>
                    {summary && <div className={`markdown-content ${s.summaryBox}`}><SafeMarkdown>{summary}</SafeMarkdown></div>}
                </div>
            </div>
            {issues.length > 0 && (
                <div className={s.issuesSection}>
                    <div className={s.issuesTitle}>⚠ 发现问题 ({issues.length})</div>
                    {issues.map((issue, i) => (
                        <div key={i} className={`markdown-content ${s.issueCard}`} style={{ borderLeft: `3px solid ${sevColor(issue.severity)}` }}>
                            <span className={s.issueSev} style={{ color: sevColor(issue.severity) }}>{(issue.severity || 'medium').toUpperCase()}</span>
                            <span className={s.issueTitle}>{issue.title}</span>
                            {issue.location && <div className={s.issueLocation}>📍 {issue.location}</div>}
                            {issue.originalText && <div className={s.issueOriginal}>原文: <code className={s.codeInline}>{issue.originalText}</code></div>}
                            {issue.perspective && <span className={s.issuePerspective}>({issue.perspective}视角)</span>}
                            {issue.violationReason && <div className={s.issueViolation}>违规: {issue.violationReason}</div>}
                            {issue.howToFix && <div className={s.issueFix}>改法: {issue.howToFix}</div>}
                            {issue.targetText && <div className={s.issueTarget}>改为: <code className={s.codeInlineGreen}>{issue.targetText}</code></div>}
                            {issue.description && !issue.originalText && !issue.violationReason && <div className={s.issueDesc}><SafeMarkdown>{issue.description}</SafeMarkdown></div>}
                        </div>
                    ))}
                </div>
            )}
            {suggestions.length > 0 && (
                <div className={s.suggestionsBox}>
                    <div className={s.suggestionsTitle}>💡 修改建议 ({suggestions.length})</div>
                    {suggestions.map((sg, i) => (
                        <div key={i} className={`markdown-content ${s.suggestionCard}`}>
                            {sg.title && <span className={s.suggestionTitle}>{sg.title}</span>}
                            {sg.description && <div className={s.suggestionDesc}><SafeMarkdown>{sg.description}</SafeMarkdown></div>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
