import { MATERIAL_TYPE_LABELS } from './materialConstants';
import layout from './materials.module.css';
import s from './integrity.module.css';

const SEVERITY_CLASS = {
    critical: s.issueCritical,
    warning: s.issueWarning,
    info: s.issueInfo,
};

const SEVERITY_ICON = { critical: '🔴', warning: '🟡', info: '🔵' };

export default function IntegrityPanel({ report, fixResult, onFix, onClose }) {
    if (!report) return null;

    return (
        <div className="cyber-modal-overlay" onClick={onClose}>
            <div className={`cyber-modal ${layout.modalLarge}`} onClick={e => e.stopPropagation()}>
                <div className={layout.modalHeader}>
                    <h2>🏥 素材健康检查</h2>
                    <button className="cyber-btn cyber-btn-sm" onClick={onClose}>关闭</button>
                </div>

                <div className={s.integrityStats}>
                    <div className={`${s.integrityStatCard} ${s.statHealthy}`}>
                        <div className={`${s.integrityStatValue} ${s.statValueHealthy}`}>
                            {report.healthy ? '✅ 健康' : '⚠ 有问题'}
                        </div>
                    </div>
                    <div className={`${s.integrityStatCard} ${s.statCritical}`}>
                        <div className={s.integrityStatLabel}>严重</div>
                        <div className={`${s.integrityStatValue} ${s.statValueCritical}`}>{report.criticalCount}</div>
                    </div>
                    <div className={`${s.integrityStatCard} ${s.statWarning}`}>
                        <div className={s.integrityStatLabel}>警告</div>
                        <div className={`${s.integrityStatValue} ${s.statValueWarning}`}>{report.warningCount}</div>
                    </div>
                    <div className={`${s.integrityStatCard} ${s.statInfo}`}>
                        <div className={s.integrityStatLabel}>建议</div>
                        <div className={`${s.integrityStatValue} ${s.statValueInfo}`}>{report.infoCount}</div>
                    </div>
                </div>

                {report.stats && (
                    <div className={s.integrityStatsBlock}>
                        <div className={s.integrityStatsTitle}>📊 素材统计</div>
                        <div className={s.integrityStatsRow}>
                            <span>总计: {report.stats.total}</span>
                            <span>👤 主世界角色: {report.stats.characters?.mainWorld || 0}</span>
                            <span>🌀 次位面角色: {report.stats.characters?.subPlane || 0}</span>
                        </div>
                        <div className={s.integrityStatsTypes}>
                            {Object.entries(report.stats.byType || {}).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                                <span key={type} className={s.integrityTypeTag}>
                                    {MATERIAL_TYPE_LABELS[type] || type}: {count}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {report.issues.length > 0 && (
                    <div>
                        <div className={s.issuesTitle}>🔍 发现问题</div>
                        <div className={s.issuesList}>
                            {report.issues.map((issue, idx) => (
                                <div key={idx} className={`${s.issueCard} ${SEVERITY_CLASS[issue.severity] || s.issueInfo}`}>
                                    <div className={s.issueRow}>
                                        <span className={s.issueIcon}>{SEVERITY_ICON[issue.severity] || '🔵'}</span>
                                        <span className={s.issueMessage}>{issue.message}</span>
                                    </div>
                                    {issue.fixDescription && (
                                        <div className={s.issueFix}>💡 {issue.fixDescription}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className={s.fixActions}>
                            <button className="cyber-btn" onClick={() => onFix(true)}>👁 预览修复</button>
                            <button className={`cyber-btn ${s.fixBtnDanger}`} onClick={() => onFix(false)}>🔧 执行修复</button>
                        </div>
                    </div>
                )}

                {fixResult && (
                    <div className={s.fixResult}>
                        <div className={`${s.fixResultTitle} ${fixResult.dryRun ? s.fixResultDryRun : s.fixResultApplied}`}>
                            {fixResult.dryRun ? '👁 预览结果（未实际修改）' : '🔧 修复结果'}
                        </div>
                        <div className={s.fixResultSummary}>
                            共 {fixResult.totalFixes} 项修复{fixResult.errors > 0 ? `，${fixResult.errors} 项失败` : ''}
                        </div>
                        {fixResult.fixes.map((f, i) => (
                            <div key={i} className={`${s.fixItem} ${f.error ? s.fixItemError : s.fixItemSuccess}`}>
                                {f.error ? '❌' : '✅'} {f.action}
                            </div>
                        ))}
                    </div>
                )}

                {report.issues.length === 0 && (
                    <div className={s.allHealthy}>🎉 所有素材数据健康，无重复、无断链、无归属异常！</div>
                )}
            </div>
        </div>
    );
}
