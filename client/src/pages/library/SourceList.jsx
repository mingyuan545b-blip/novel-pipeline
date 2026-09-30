/**
 * SourceList — 「按来源」视图：每本提取过的书一张卡
 *
 * 回答用户的诉求："可以根据前面已经提取过的一本书提取了哪些内容"。
 * 数据源：GET /api/library/sources（含条数、完整度分布、部门分布、最后提取时间）。
 */
import { COMPLETENESS, cleanDept } from './libraryConstants';
import s from './library.module.css';

function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Bar({ item }) {
    const total = item.total || 1;
    return (
        <div className={s.srcBar}>
            {['full', 'partial', 'empty'].map(k => (
                item[k] > 0 ? (
                    <span key={k} className={s.srcBarSeg}
                        style={{ width: `${item[k] / total * 100}%`, background: COMPLETENESS[k].color }}
                        title={`${COMPLETENESS[k].label} ${item[k]} 条`} />
                ) : null
            ))}
        </div>
    );
}

export default function SourceList({ sources, active, onPick, loading }) {
    if (loading) return <div className={s.emptyTip}>加载提取来源…</div>;
    if (!sources || sources.length === 0) return <div className={s.emptyTip}>还没有提取记录，点右上「一键提取」从已有小说沉淀技法</div>;
    return (
        <div className={s.srcList}>
            {sources.map(src => (
                <button key={src.novel} type="button"
                    className={`${s.srcCard} ${active === src.novel ? s.srcCardOn : ''}`}
                    onClick={() => onPick(active === src.novel ? '' : src.novel)}>
                    <div className={s.srcHead}>
                        <span className={s.srcTitle} title={src.novel}>{src.novel}</span>
                        <span className={s.srcTotal}>{src.total} 条</span>
                    </div>
                    <Bar item={src} />
                    <div className={s.srcMeta}>
                        <span>完整 <b style={{ color: COMPLETENESS.full.color }}>{src.full}</b></span>
                        {src.partial > 0 && <span>部分 <b style={{ color: COMPLETENESS.partial.color }}>{src.partial}</b></span>}
                        <span>空壳 <b style={{ color: COMPLETENESS.empty.color }}>{src.empty}</b></span>
                        <span className={s.srcTime}>{fmtTime(src.lastAt)}</span>
                    </div>
                    <div className={s.srcDepts}>
                        {src.departments.slice(0, 4).map(d => (
                            <span key={d.name} className={s.srcDept}>{cleanDept(d.name)} × {d.count}</span>
                        ))}
                        {src.departments.length > 4 && <span className={s.srcDept}>…</span>}
                    </div>
                </button>
            ))}
        </div>
    );
}
