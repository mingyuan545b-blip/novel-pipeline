import s from './ContextAssemblyPage.module.css';

/**
 * AssemblyPanel.jsx — 本章装配实况面板
 * 回答三个问题：
 *   1. 数据源流通了吗（素材库/实体中心/知识库/意图/约束/预算）
 *   2. 每个Agent本章装了哪些素材类型、什么深度、多少字符
 *   3. 哪些"该有却没有"（告警）
 */

const STATUS_META = {
    injected: { icon: '●', label: '已注入', cls: 'ok' },
    dropped: { icon: '○', label: '本章不需要', cls: 'info' },
    empty: { icon: '△', label: '无数据', cls: 'warning' },
    missing: { icon: '✕', label: '链路丢失', cls: 'error' },
};

export default function AssemblyPanel({ data }) {
    if (!data || data.error) return null;
    const agents = data.agents || [];
    const flow = data.flow || [];
    const alerts = data.alerts || [];

    return (
        <div className={s.assemblyWrap}>
            <div className={s.assemblyRow}>
                <section className={s.card}>
                    <h3 className={s.cardTitle}>🔌 数据源流通（本章）</h3>
                    {flow.length === 0
                        ? <p className={s.muted}>本项目第{data.chapterNumber}章还没有装配记录。运行该章后即可看到实况。</p>
                        : (
                            <ul className={s.flowList}>
                                {flow.map(src => (
                                    <li key={src.key} className={s.flowItem}>
                                        <span className={`${s.flowDot} ${src.wired ? s.dotOk : s.dotOff}`} />
                                        <span className={s.flowLabel}>{src.label}</span>
                                        <span className={s.flowDetail}>{src.wired ? src.detail : `未接入 · ${src.detail}`}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                </section>

                <section className={s.card}>
                    <h3 className={s.cardTitle}>⚠️ 数据缺失 / 丢失告警</h3>
                    {alerts.length === 0
                        ? <p className={s.muted}>无告警：决策需要的素材类型都拿到了数据。</p>
                        : (
                            <ul className={s.alertList}>
                                {alerts.map((a, i) => (
                                    <li key={i} className={`${s.alertItem} ${a.severity === 'error' ? s.alertError : s.alertWarning}`}>
                                        <span className={s.alertAgent}>{a.agentType}</span>
                                        {a.message}
                                    </li>
                                ))}
                            </ul>
                        )}
                </section>
            </div>

            {agents.map(agent => (
                <section key={agent.agentType} className={s.card}>
                    <h3 className={s.cardTitle}>
                        🧩 {agent.agentType}
                        <span className={s.budgetTag}>
                            预算 {agent.budget?.label || '-'} · {agent.summary?.actualChars || 0}字 · 注入{agent.summary?.injectedTypes || 0}类 / 丢弃{agent.summary?.droppedTypes || 0}类
                        </span>
                    </h3>
                    <div className={s.tableScroll}>
                        <table className={s.typeTable}>
                            <thead>
                                <tr>
                                    <th>素材类型</th><th>状态</th><th>层级</th><th>条数</th><th>字符</th><th>约token</th><th>依据</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agent.types.map(t => {
                                    const meta = STATUS_META[t.status] || STATUS_META.dropped;
                                    return (
                                        <tr key={t.type} className={s[`row_${meta.cls}`]}>
                                            <td className={s.typeName}>{t.type}</td>
                                            <td><span className={`${s.statusPill} ${s[`pill_${meta.cls}`]}`}>{meta.icon} {meta.label}</span></td>
                                            <td>{t.actualDepth || '-'}{t.degraded ? ' ↓' : ''}</td>
                                            <td>{t.itemCount}</td>
                                            <td>{t.chars}</td>
                                            <td>{t.estTokens}</td>
                                            <td className={s.reasonCell}>{t.relevanceReason || t.dropReason || '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            ))}
        </div>
    );
}
