import { pipelineApi } from '../../services/api';
import { AGENT_LABELS } from './pipelineConstants';
import s from './PromptAuditPanel.module.css';

function scoreClass(score) {
    if (score >= 80) return s.scoreGood;
    if (score >= 60) return s.scoreWarn;
    return s.scoreBad;
}
function sevIcon(sev) { return sev === 'high' ? '🔴' : sev === 'medium' ? '🟡' : '🟢'; }
function sevColor(sev) { return sev === 'high' ? '#ff6b6b' : sev === 'medium' ? '#ffa502' : '#2ed573'; }

export default function PromptAuditPanel({ currentProject, projectMode, promptAuditInfo, setPromptAuditInfo, promptAuditLoading, setPromptAuditLoading }) {
    const runAudit = async () => {
        if (!currentProject) return;
        setPromptAuditLoading(true);
        try {
            const res = await pipelineApi.getPromptAudit(currentProject.id, projectMode);
            const data = res.data || res;
            if (data.error) alert('审计失败: ' + data.error);
            else setPromptAuditInfo(data);
        } catch (e) { alert('审计请求失败: ' + (e.response?.data?.error || e.message)); }
        finally { setPromptAuditLoading(false); }
    };

    return (
        <div className={s.panel}>
            <div className={s.header}>
                <span className={s.title}>🔍 约束词审计(Prompt Audit)</span>
                <button className={`cyber-btn cyber-btn-sm ${s.auditBtn}`} onClick={runAudit} disabled={promptAuditLoading}>
                    {promptAuditLoading ? '⏳审计中...' : '审计'}
                </button>
            </div>
            {promptAuditInfo?.overall ? (
                <div>
                    <div className={s.statsGrid}>
                        <div className={`${s.statCard} ${s.statHealth}`}>
                            <div className={`${s.statValue} ${scoreClass(promptAuditInfo.overall.healthScore)}`}>{promptAuditInfo.overall.healthScore}</div>
                            <div className={s.statLabel}>健康度</div>
                        </div>
                        <div className={`${s.statCard} ${s.statDup}`}>
                            <div className={s.statValue}>{promptAuditInfo.overall.totalDuplicates || 0}</div>
                            <div className={s.statLabel}>重复概念</div>
                        </div>
                        <div className={`${s.statCard} ${s.statInflate}`}>
                            <div className={s.statValue}>{promptAuditInfo.overall.totalInflation || 0}</div>
                            <div className={s.statLabel}>膨胀问题</div>
                        </div>
                        <div className={`${s.statCard} ${s.statAgents}`}>
                            <div className={s.statValue}>{Object.keys(promptAuditInfo.agents || {}).filter(k => !promptAuditInfo.agents[k].error).length}</div>
                            <div className={s.statLabel}>已审计Agent</div>
                        </div>
                    </div>
                    <div className={s.summary}>{promptAuditInfo.overall.summary || '审计完成'}</div>
                    {Object.entries(promptAuditInfo.agents || {}).filter(([, a]) => !a.error && (a.duplicateConcepts?.length > 0 || a.inflationIssues?.length > 0)).map(([agentType, audit]) => (
                        <div key={agentType} className={s.agentCard} style={{ border: `1px solid ${audit.healthScore >= 80 ? 'rgba(50,255,100,0.2)' : audit.healthScore >= 60 ? 'rgba(255,165,0,0.3)' : 'rgba(255,80,80,0.4)'}` }}>
                            <div className={s.agentHeader}>
                                <span className={`${s.agentName} ${scoreClass(audit.healthScore)}`}>{AGENT_LABELS[agentType] || agentType}</span>
                                <span className={s.agentStats}>健康度: {audit.healthScore} | 重复 {audit.totalDuplicates} | 膨胀 {audit.totalInflation}</span>
                            </div>
                            {audit.duplicateConcepts?.map((c, i) => (
                                <div key={i} className={s.issueLine}>
                                    <span style={{ color: sevColor(c.severity) }}>{sevIcon(c.severity)}</span>
                                    <span className={s.issueLabel}>{c.label}</span> x{c.totalCount} →{c.fix}
                                </div>
                            ))}
                            {audit.inflationIssues?.map((issue, i) => (
                                <div key={i} className={s.issueLine}>
                                    <span style={{ color: sevColor(issue.severity) }}>⚠️</span>
                                    <span className={s.issueLabel}>{issue.desc}</span> ({issue.count}/{issue.maxCount}) →{issue.fix}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ) : <div className={s.placeholder}>点击"审计"检测约束词重复和膨胀问题</div>}
        </div>
    );
}
