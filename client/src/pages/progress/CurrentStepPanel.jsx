/**
 * CurrentStepPanel — 当前在干什么：哪个步骤 / 哪一章 / 第几轮 / 已进行多久
 *
 * 口径说明（避免误读）：
 *   日志在步骤**结束时**写入，所以「当前步骤」= 最后一条日志的步骤 +
 *   距其结束已过去的时间。真正"正在跑哪一步"由服务端 phase 字段给出。
 */
import { fmtDuration, fmtTime } from './progressConstants';
import s from './progress.module.css';

export default function CurrentStepPanel({ view }) {
    if (!view) return null;
    const c = view.current;
    if (!c) return <section className={s.card}><h3 className={s.cardTitle}>当前步骤</h3><p className={s.muted}>还没有步骤日志</p></section>;
    return (
        <section className={s.card}>
            <h3 className={s.cardTitle}>当前步骤</h3>
            <div className={s.stepMain}>
                <span className={s.stepName}>{c.stepLabel}</span>
                <code className={s.stepKey}>{c.step}</code>
            </div>
            <div className={s.stepGrid}>
                <div className={s.stepCell}><span className={s.cellKey}>章节</span><span className={s.cellVal}>{c.chapterNumber ? `第 ${c.chapterNumber} 章` : '—'}</span></div>
                <div className={s.stepCell}>
                    <span className={s.cellKey}>轮次</span>
                    <span className={s.cellVal}>{c.round ? `累计第 ${c.round} 轮` : '—'}{c.runRound ? `（本次第 ${c.runRound} 轮）` : ''}</span>
                </div>
                <div className={s.stepCell}><span className={s.cellKey}>上次步骤结束</span><span className={s.cellVal}>{fmtTime(c.lastAt)}</span></div>
                <div className={s.stepCell}>
                    <span className={s.cellKey}>{view.running ? '距上次结束' : '状态'}</span>
                    <span className={s.cellVal}>{view.running ? fmtDuration(c.sinceMs) : '已停止'}</span>
                </div>
            </div>
            {view.anomalies?.length > 0 && (
                <div className={s.anomalyBox}>
                    {view.anomalies.slice(-3).map((a, i) => <div key={i} className={s.anomalyLine}>{a}</div>)}
                </div>
            )}
        </section>
    );
}
