import s from './ChapterAuditPanel.module.css';

const SEVERITY_BORDER = { critical: s.borderCritical, high: s.borderHigh, medium: s.borderMedium };
const SEVERITY_COLOR = { critical: s.severityCritical, high: s.severityHigh, medium: s.severityMedium };

export function WordViolationCard({ r, wordCountViolation }) {
    if (!wordCountViolation) return null;
    return (
        <div className={s.wordViolation}>
            <div className={s.wordViolationTitle}>⚠字数不达标</div>
            <div className={s.wordViolationDetail}>
                当前 <b>{r.wordCount}</b> 字{wordCountViolation.target ? `，目标${wordCountViolation.target} 字` : ''}{wordCountViolation.gap ? `，还差<b className={s.severityCritical}>{wordCountViolation.gap}</b> 字` : ''}<br />{wordCountViolation.desc}
            </div>
        </div>
    );
}

export function ViolationList({ violations }) {
    if (!violations.length) return null;
    return (
        <div className={s.violationSection}>
            <div className={s.violationSectionTitle}>🔴违规问题 ({violations.length})</div>
            {violations.map((v, i) => {
                const sc = v.severity || 'medium';
                return (
                    <div key={i} className={`${s.violationItem} ${SEVERITY_BORDER[sc] || s.borderMedium}`}>
                        <span className={`${s.violationSeverity} ${SEVERITY_COLOR[sc] || s.severityMedium}`}>{sc.toUpperCase()}</span>
                        <span className={`${s.violationCategory} ${SEVERITY_COLOR[sc] || s.severityMedium}`}>[{v.category}]</span>
                        <span className={s.violationDesc}>{v.desc}</span>
                        {v.match && <div className={s.violationMatch}>匹配: <code className={s.violationMatchCode}>{v.match}</code></div>}
                        {v.suggestion && <div className={s.violationSuggestion}>💡 {v.suggestion}</div>}
                        {v.jargons?.length > 0 && <div className={s.violationJargon}>{v.jargons.map((j, ji) => <div key={ji}><code className={s.jargonMatch}>{j.match}</code> →<code className={s.jargonSuggestion}>{j.suggestion}</code>{j.perspective ? ` (${j.perspective})` : ''}</div>)}</div>}
                        {v.count !== undefined && <div className={s.violationCount}>数量: {v.count}</div>}
                    </div>
                );
            })}
        </div>
    );
}

export function ViolationTagBar({ violations }) {
    return (
        <div className={s.tagBar}>
            {violations.map((v, i) => {
                const cls = v.severity === 'critical' ? s.tagCritical : v.severity === 'high' ? s.tagHigh : s.tagNormal;
                return <span key={i} className={`${s.tag} ${cls}`}>[{v.category}]</span>;
            })}
        </div>
    );
}
