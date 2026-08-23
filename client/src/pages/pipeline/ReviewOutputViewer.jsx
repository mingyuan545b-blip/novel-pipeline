import { safeStr } from './pipelineConstants';
import SafeMarkdown from './SafeMarkdown';
import s from './ReviewOutputViewer.module.css';

const parseRawOutput = (raw) => {
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
    } catch {
        return null;
    }
};

const STATUS_CLASS = {
    approved: { card: s.statusCardApproved, label: s.statusLabelApproved, icon: '✅', text: '审核通过' },
    overridden: { card: s.statusCardOverridden, label: s.statusLabelOverridden, icon: '🔄', text: '覆盖通过' },
    rejected: { card: s.statusCardRejected, label: s.statusLabelRejected, icon: '❌', text: '未通过' },
};

const ReviewStatus = ({ parsed, isApproved, isOverridden }) => {
    const key = !isApproved ? 'rejected' : isOverridden ? 'overridden' : 'approved';
    const cls = STATUS_CLASS[key];
    return (
        <div className={s.statusRow}>
            <div className={`${s.statusCard} ${cls.card}`}>
                <div className={s.statusIcon}>{cls.icon}</div>
                <div className={`${s.statusLabel} ${cls.label}`}>{cls.text}</div>
                {parsed.styleScore && <div className={s.styleScore}>风格 {parsed.styleScore}/10</div>}
                {parsed.action && <div className={s.actionLabel}>动作: {parsed.action}</div>}
            </div>
            <div className={s.summaryWrap}>
                {parsed.summary && (
                    <div className={`markdown-content ${s.summaryContent}`}>
                        <SafeMarkdown>{parsed.summary}</SafeMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
};

const ReviewIssues = ({ issues }) => (
    <div className={s.issuesSection}>
        <div className={s.issuesTitle}>⚠ 发现问题 ({issues.length})</div>
        {issues.map((issue, i) => {
            const desc = typeof issue === 'string' ? issue : (issue.description || issue.title || JSON.stringify(issue));
            const severity = issue.severity || 'medium';
            const sevColor = severity === 'critical' ? 'var(--neon-red)' : severity === 'high' ? 'var(--neon-orange)' : 'var(--text-muted)';
            return (
                <div key={i} className={`markdown-content ${s.issueItem}`} style={{ borderLeft: `3px solid ${sevColor}` }}>
                    <span className={s.severityTag} style={{ color: sevColor }}>{severity.toUpperCase()}</span>
                    <SafeMarkdown>{desc}</SafeMarkdown>
                </div>
            );
        })}
    </div>
);

const ReviewEdits = ({ edits }) => (
    <div className={s.editsSection}>
        <div className={s.editsTitle}>📝修改记录({edits.length})</div>
        {edits.map((edit, i) => {
            const desc = typeof edit === 'string' ? edit : (edit.description || JSON.stringify(edit));
            const severity = edit.severity || 'minor';
            const sevColor = severity === 'critical' ? 'var(--neon-red)' : 'var(--neon-orange)';
            return (
                <div key={i} className={`markdown-content ${s.editItem}`}>
                    <span className={s.severityTag} style={{ color: sevColor }}>{severity.toUpperCase()}</span>
                    <SafeMarkdown>{desc}</SafeMarkdown>
                </div>
            );
        })}
    </div>
);

const ReviewSuggestions = ({ suggestions }) => (
    <div className={s.suggestionsSection}>
        <div className={s.suggestionsTitle}>💡 建议 ({suggestions.length})</div>
        {suggestions.map((sug, i) => {
            const desc = typeof sug === 'string' ? sug : safeStr(sug);
            return (
                <div key={i} className={`markdown-content ${s.suggestionItem}`}>
                    <SafeMarkdown>{desc}</SafeMarkdown>
                </div>
            );
        })}
    </div>
);

export default function ReviewOutputViewer({ raw, stepKey: _stepKey }) {
    const parsed = parseRawOutput(raw);

    if (!parsed) {
        return (
            <div className={`markdown-content ${s.fallback}`}>
                <SafeMarkdown>{raw}</SafeMarkdown>
            </div>
        );
    }

    const isApproved = !!(parsed.passed || parsed.approved);
    const isOverridden = !!parsed._overridden;
    const overrideReason = parsed._overrideReason || '';

    return (
        <div className={s.container}>
            {isOverridden && (
                <div className={s.overrideBanner}>
                    🔄 系统覆盖通过 — {overrideReason}
                </div>
            )}
            <ReviewStatus parsed={parsed} isApproved={isApproved} isOverridden={isOverridden} />
            {parsed.issues?.length > 0 && <ReviewIssues issues={parsed.issues} />}
            {parsed.edits?.length > 0 && <ReviewEdits edits={parsed.edits} />}
            {parsed.suggestions?.length > 0 && <ReviewSuggestions suggestions={parsed.suggestions} />}
            {parsed.ipDirection && (
                <div className={`markdown-content ${s.directionBlock}`}>
                    📌 后续方向: <SafeMarkdown>{parsed.ipDirection}</SafeMarkdown>
                </div>
            )}
            {parsed.materialGuidance && (
                <div className={`markdown-content ${s.guidanceBlock}`}>
                    📦 素材指导: <SafeMarkdown>{parsed.materialGuidance}</SafeMarkdown>
                </div>
            )}
        </div>
    );
}
