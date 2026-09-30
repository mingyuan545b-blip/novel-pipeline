/**
 * AgentStatsPanel — 各 Agent 的耗时与 token 消耗
 *
 * 说明：耗时取自 metrics.agentTimings（真实计时）；实测部分步骤 totalMs 为 0
 * （计时起点缺失），此时只展示 token 并标注，不把 0 伪造成"很快"。
 */
import { fmtDuration, fmtNum } from './progressConstants';
import s from './progress.module.css';

const BAR_BASE = 1;

export default function AgentStatsPanel({ view }) {
    const rows = (view && view.agentStats) || [];
    const max = rows.reduce((m, r) => Math.max(m, r.hasTiming ? r.totalMs : r.totalTokens), BAR_BASE);
    return (
        <section className={s.card}>
            <h3 className={s.cardTitle}>各 Agent 耗时 / Token</h3>
            {rows.length === 0 ? <p className={s.muted}>暂无统计数据（跑过一章后出现）</p> : (
                <table className={s.table}>
                    <thead>
                        <tr><th>步骤</th><th>调用</th><th>单次均值</th><th>最慢</th><th>累计</th><th>Tokens</th><th className={s.colBar} /></tr>
                    </thead>
                    <tbody>
                        {rows.map(r => {
                            const value = r.hasTiming ? r.totalMs : r.totalTokens;
                            return (
                                <tr key={r.agent}>
                                    <td className={s.tdName} title={r.agent}>{r.label}</td>
                                    <td className={s.tdNum}>{r.calls}</td>
                                    <td className={s.tdNum}>{r.hasTiming ? fmtDuration(r.avgMs) : <span className={s.muted}>未计时</span>}</td>
                                    <td className={s.tdNum}>{r.hasTiming ? fmtDuration(r.maxMs) : <span className={s.muted}>—</span>}</td>
                                    <td className={s.tdNum}>{r.hasTiming ? fmtDuration(r.totalMs) : <span className={s.muted}>—</span>}</td>
                                    <td className={s.tdNum}>{fmtNum(r.totalTokens)}</td>
                                    <td className={s.colBar}>
                                        <span className={r.hasTiming ? s.barTime : s.barToken}
                                            style={{ width: `${Math.max(2, Math.round(value / max * 100))}%` }} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
            <p className={s.legend}>
                <span className={s.legendTime} />{" 按耗时占比 "}<span className={s.legendToken} />{" 按 token 占比（该步骤未计时）"}
            </p>
        </section>
    );
}
