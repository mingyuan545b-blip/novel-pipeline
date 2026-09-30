/**
 * StepTimelinePanel — 最近步骤时间线（哪一步、哪一章、第几轮、耗时）
 */
import { fmtDuration, fmtTime, stepStatusColor } from './progressConstants';
import s from './progress.module.css';

export default function StepTimelinePanel({ view }) {
    const rows = (view && view.timeline) || [];
    return (
        <section className={s.card}>
            <h3 className={s.cardTitle}>最近步骤（新的在前）</h3>
            {rows.length === 0 ? <p className={s.muted}>暂无日志</p> : (
                <ol className={s.timeline}>
                    {rows.map((r, i) => (
                        <li key={`${r.at}-${r.step}-${i}`} className={s.tlItem}>
                            <span className={s.tlDot} style={{ background: stepStatusColor(r.status, r.passed) }} />
                            <span className={s.tlStep}>{r.stepLabel}</span>
                            <span className={r.passed === false ? s.tlFail : s.tlPass} title={r.status || ''}>
                                {r.passed === true ? '通过' : r.passed === false ? '未过' : (r.status || '—')}
                            </span>
                            <span className={s.tlCh}>{r.chapterNumber ? `第${r.chapterNumber}章` : ''}</span>
                            <span className={s.tlRound}>{r.round ? `R${r.round}${r.runRound ? `/第${r.runRound}轮` : ''}` : ''}</span>
                            <span className={s.tlDur}>{fmtDuration(r.durationMs)}</span>
                            <span className={s.tlAt}>{fmtTime(r.at)}</span>
                            {r.running && <span className={s.tlRunning}>进行中</span>}
                        </li>
                    ))}
                </ol>
            )}
            <p className={s.legend}>耗时 = 与上一条日志的间隔（日志在步骤结束时写入，故为近似值）</p>
        </section>
    );
}
