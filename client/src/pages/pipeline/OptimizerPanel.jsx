import { optimizerApi } from '../../services/api';
import s from './OptimizerPanel.module.css';

function sevClass(sev) { return sev === 'critical' ? s.sevCritical : sev === 'high' ? s.sevHigh : s.sevNormal; }
function sevColor(sev) { return sev === 'critical' ? '#ff4757' : sev === 'high' ? '#ffa502' : '#54a0ff'; }

export default function OptimizerPanel({ currentProject, optimizerReport, setOptimizerReport, optimizerLoading, setOptimizerLoading, optimizerApplying, setOptimizerApplying }) {
    const runReport = async () => {
        if (!currentProject) return;
        setOptimizerLoading(true);
        try {
            const res = await optimizerApi.report(currentProject.id, 10);
            const data = res.data;
            if (data.error) alert('检测失败：' + data.error);
            else setOptimizerReport(data);
        } catch (e) { alert('检测请求失败：' + e.message); }
        finally { setOptimizerLoading(false); }
    };

    const applyPattern = async (p) => {
        if (!confirm(`确认优化"${p.category}"？\n\n将修改 ${p.targetField}\n根因: ${p.rootCause}\n\n优化后健康度必须≥0，Token只减不增。`)) return;
        setOptimizerApplying(p.patternId);
        try {
            const sugRes = await optimizerApi.suggestion(currentProject.id, p.patternId);
            if (sugRes.data.error) { alert('获取建议失败: ' + sugRes.data.error); return; }
            const applyRes = await optimizerApi.apply(currentProject.id, p.patternId, { suggestionIndex: 0 });
            const result = applyRes.data;
            if (result.success) {
                alert(`✅ 优化成功！\n\nToken变化: ${result.tokenDelta > 0 ? '+' : ''}${result.tokenDelta}\n健康度: ${result.healthScoreAfter}\n字数变化: ${result.charDelta > 0 ? '+' : ''}${result.charDelta}`);
                const rptRes = await optimizerApi.report(currentProject.id, 10);
                setOptimizerReport(rptRes.data);
            } else { alert('❌ 优化失败：' + result.error); }
        } catch (e) { alert('优化请求失败: ' + e.message); }
        finally { setOptimizerApplying(null); }
    };

    return (
        <div className={s.panel}>
            <div className={s.header}>
                <span className={s.title}>🧠 提示词优化器 (Prompt Optimizer)</span>
                <button className={`cyber-btn cyber-btn-sm ${s.detectBtn}`} onClick={runReport} disabled={optimizerLoading}>
                    {optimizerLoading ? '⏳检测中...' : '检测'}
                </button>
            </div>
            {optimizerReport?.detection ? (
                <div>
                    <div className={s.analysisInfo}>分析最近{optimizerReport.detection.analyzedChapters}章 | {optimizerReport.detection.totalReviewsAnalyzed}条审核记录</div>
                    {optimizerReport.detection.patterns.length === 0 ? (
                        <div className={s.noIssues}>✅ 未检测到跨章节高频问题</div>
                    ) : (
                        <div>
                            {optimizerReport.detection.patterns.map((p) => {
                                const canOpt = optimizerReport.canOptimize?.find(c => c.patternId === p.patternId);
                                return (
                                    <div key={p.patternId} className={s.patternCard} style={{ border: `1px solid ${sevColor(p.severity)}33` }}>
                                        <div className={s.patternHeader}>
                                            <div>
                                                <span className={`${s.patternCategory} ${sevClass(p.severity)}`}>{p.category}</span>
                                                <span className={s.patternSeverity}>{p.severity}</span>
                                            </div>
                                            <div className={s.patternStats}>
                                                <span className={s.statHits}>{p.totalHits}次</span>
                                                <span className={s.statSep}>|</span>
                                                <span className={s.statChapters}>{p.chapterCount}章</span>
                                            </div>
                                        </div>
                                        <div className={s.patternRoot}>根因: {p.rootCause}</div>
                                        <div className={s.patternAffected}>影响章节: {p.affectedChapters.join(', ')}</div>
                                        {canOpt?.allowed && p.canAutoOptimize ? (
                                            <div className={s.patternActions}>
                                                <button className={`cyber-btn cyber-btn-sm ${s.optimizeBtn}`} onClick={() => applyPattern(p)} disabled={optimizerApplying === p.patternId}>
                                                    {optimizerApplying === p.patternId ? '⏳执行中...' : '🔧 优化'}
                                                </button>
                                            </div>
                                        ) : canOpt && !canOpt.allowed ? (
                                            <div className={s.blockedMsg}>🚫 {canOpt.reason}</div>
                                        ) : !p.canAutoOptimize ? (
                                            <div className={s.manualMsg}>⚠️ 此模式需手动优化</div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {optimizerReport.history?.log?.length > 0 && (
                        <div className={s.historySection}>
                            <div className={s.historyTitle}>优化历史 ({optimizerReport.history.log.length})</div>
                            {optimizerReport.history.log.slice(-3).reverse().map((l, i) => (
                                <div key={i} className={s.historyItem}>
                                    {l.timestamp?.split('T')[0]} {l.category} | Token{l.tokenDelta > 0 ? '+' : ''}{l.tokenDelta} | 健康{l.healthScoreAfter}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : <div className={s.placeholder}>点击"检测"分析跨章节高频问题模式</div>}
        </div>
    );
}
