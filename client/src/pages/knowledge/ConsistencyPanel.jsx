import { SEVERITY_COLORS, DIMENSION_LABELS } from './knowledgeConstants';
import './knowledge.css';

export default function ConsistencyPanel({ result, reports, checkChapter, setCheckChapter, onCheck, onAiCheck, loading }) {
    // 防御性处理：确保 reports 是数组
    const safeReports = Array.isArray(reports) ? reports : [];
    return (
        <div>
            <div className="consistency-card">
                <h3 className="consistency-title">一致性校验</h3>
                <div className="consistency-input-row">
                    <input
                        type="number" value={checkChapter} onChange={e => setCheckChapter(e.target.value)}
                        placeholder="章节号" className="consistency-chapter-input"
                    />
                    <button className="consistency-check-btn" onClick={onCheck} disabled={loading || !checkChapter}>
                        快速校验
                    </button>
                    <button className="consistency-ai-btn" onClick={onAiCheck} disabled={loading || !checkChapter}>
                        AI深度校验
                    </button>
                </div>

                {result && <ConsistencyResult result={result} />}
            </div>

            <div className="consistency-card">
                <h3 className="consistency-title">校验历史</h3>
                {safeReports.length === 0 ? (
                    <div className="snapshot-empty">暂无校验记录</div>
                ) : (
                    <div className="consistency-history-list">
                        {safeReports.slice(0, 20).map((r, i) => (
                            <div key={i} className="consistency-history-item">
                                <div className="consistency-history-left">
                                    <span className={`consistency-history-dot ${r.passed ? 'consistency-history-dot-pass' : 'consistency-history-dot-fail'}`} />
                                    <span className="consistency-history-chapter">第{r.chapterNumber}章</span>
                                </div>
                                <div className="consistency-history-stats">
                                    <span>严重: {r.criticalCount || 0}</span>
                                    <span>警告: {r.warningCount || 0}</span>
                                    <span>提示: {r.infoCount || 0}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ConsistencyResult({ result }) {
    return (
        <div className="consistency-result">
            <div className="consistency-result-summary">
                <div className={`consistency-result-badge ${result.passed ? 'consistency-result-passed' : 'consistency-result-failed'}`}>
                    {result.passed ? '✓ 校验通过' : '✗ 发现问题'}
                </div>
                {result.criticalCount !== undefined && (
                    <div className="consistency-critical-badge">严重: {result.criticalCount}</div>
                )}
            </div>

            {result.issues?.length > 0 && (
                <div className="consistency-issues">
                    {result.issues.map((issue, i) => (
                        <div key={i} className="consistency-issue" style={{ borderLeft: `4px solid ${SEVERITY_COLORS[issue.severity] || '#888'}` }}>
                            <div className="consistency-issue-header">
                                <span className="consistency-issue-title" style={{ color: SEVERITY_COLORS[issue.severity] }}>{issue.title}</span>
                                <div className="consistency-issue-badges">
                                    <span className="consistency-issue-badge" style={{ background: SEVERITY_COLORS[issue.severity] + '22', color: SEVERITY_COLORS[issue.severity] }}>
                                        {issue.severity === 'critical' ? '严重' : issue.severity === 'warning' ? '警告' : '提示'}
                                    </span>
                                    <span className="consistency-issue-badge" style={{ background: 'var(--card-bg)', color: 'var(--text-secondary)' }}>
                                        {DIMENSION_LABELS[issue.dimension] || issue.dimension}
                                    </span>
                                </div>
                            </div>
                            <div className="consistency-issue-desc">{issue.description}</div>
                            {issue.suggestion && (
                                <div className="consistency-issue-suggestion">💡 {issue.suggestion}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
