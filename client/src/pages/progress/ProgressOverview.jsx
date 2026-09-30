/**
 * ProgressOverview — 运行看板顶部：第几章 / 共几章 / 字数 / 运行状态
 */
import { fmtNum, statusMeta } from './progressConstants';
import s from './progress.module.css';

export default function ProgressOverview({ view }) {
    if (!view) return null;
    const p = view.progress || {};
    return (
        <section className={s.overview}>
            <div className={s.ovLeft}>
                <div className={s.ovRun}>
                    <span className={view.running ? s.dotRunning : s.dotIdle} />
                    <b>{view.running ? '正在运行' : '空闲'}</b>
                    {view.phase && <span className={s.ovPhase}>阶段：{view.phase}</span>}
                    {view.batchProgress && <span className={s.ovPhase}>{view.batchProgress}</span>}
                </div>
                <div className={s.ovChapter}>
                    <span className={s.ovBig}>{p.completed}</span>
                    <span className={s.ovSlash}>/</span>
                    <span className={s.ovTotal}>{p.target || '—'}</span>
                    <span className={s.ovUnit}>章已完成</span>
                    {p.currentChapter && <span className={s.ovNow}>当前第 {p.currentChapter} 章</span>}
                </div>
                <div className={s.ovBar}><span className={s.ovBarFill} style={{ width: `${p.percent || 0}%` }} /></div>
                <div className={s.ovMeta}>
                    <span>进度 <b>{p.percent || 0}%</b></span>
                    <span>累计字数 <b>{fmtNum(p.words)}</b>{p.targetWords ? ` / ${fmtNum(p.targetWords)}` : ''}</span>
                    <span>类型 <b>{view.genre || '—'}</b></span>
                </div>
            </div>
            <div className={s.ovRight}>
                <div className={s.ovStatTitle}>章节状态分布</div>
                <div className={s.ovStates}>
                    {Object.entries(view.chapterStates || {}).map(([st, n]) => {
                        const m = statusMeta(st);
                        return (
                            <span key={st} className={s.ovStateChip}>
                                <span className={s.ovStateDot} style={{ background: m.color }} />{m.label} <b>{n}</b>
                            </span>
                        );
                    })}
                    {Object.keys(view.chapterStates || {}).length === 0 && <span className={s.muted}>暂无章节</span>}
                </div>
                {view.lastError && <div className={s.errorBox}>最近错误：{view.lastError}</div>}
            </div>
        </section>
    );
}
