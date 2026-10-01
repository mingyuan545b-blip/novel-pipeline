/**
 * SourceList — 「按来源」视图：每本提取过的书一张卡
 *
 * 回答用户的诉求："可以根据前面已经提取过的一本书提取了哪些内容"。
 * 数据源：GET /api/library/sources（含条数、完整度分布、部门分布、最后提取时间）
 *        + 索引条目按来源分组（展开后列出该书贡献的技法，可直接点进右侧详情）。
 *
 * 2026-10-01 修复：此前点卡只设置 filters.source，而来源视图并不渲染条目列表 →
 * 除了边框变色什么都没有（用户反馈"点击了全球死考 什么东西都没变化"）。
 * 现在展开即列出技法，并自动选中第一条。
 */
import { COMPLETENESS, cleanDept } from './libraryConstants';
import TechListItem from './TechListItem';
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

/** 展开后的技法清单：该书贡献的条目，可直接点进右侧详情 */
function SourceTechs({ src, list, selectedTech, onSelect }) {
    if (list.length === 0) {
        return <div className={s.emptyTip}>这本书在当前筛选条件下没有条目</div>;
    }
    return (
        <div className={s.srcTechs}>
            <div className={s.srcTechHead}>
                提取到的技法 {list.length} 条
                {list.length !== src.total && <span className={s.srcTechFilter}>（共 {src.total} 条，已按上方条件筛选）</span>}
            </div>
            {list.map(t => (
                <TechListItem key={t.id} tech={t} selected={selectedTech === t.id} onClick={() => onSelect(t.id)} />
            ))}
        </div>
    );
}

export default function SourceList({ sources, active, onPick, loading, sourceEntries, selectedTech, onSelect }) {
    if (loading) return <div className={s.emptyTip}>加载提取来源…</div>;
    if (!sources || sources.length === 0) return <div className={s.emptyTip}>还没有提取记录，点右上「一键提取」从已有小说沉淀技法</div>;
    return (
        <div className={s.srcList}>
            {sources.map(src => {
                const open = active === src.novel;
                const list = (sourceEntries || {})[src.novel] || [];
                return (
                    <div key={src.novel} className={`${s.srcBlock} ${open ? s.srcBlockOn : ''}`}>
                        <button type="button" className={`${s.srcCard} ${open ? s.srcCardOn : ''}`}
                            title={open ? '收起技法清单' : `查看《${src.novel}》提取到的技法`}
                            onClick={() => onPick(open ? '' : src.novel)}>
                            <div className={s.srcHead}>
                                <span className={s.srcCaret}>{open ? '▾' : '▸'}</span>
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
                        {open && <SourceTechs src={src} list={list} selectedTech={selectedTech} onSelect={onSelect} />}
                    </div>
                );
            })}
        </div>
    );
}
