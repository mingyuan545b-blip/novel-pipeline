/**
 * ChronicleDims.jsx — 角色编年史【多维视图组件】
 * 维度定义/抽取在 chronicleDimensions.js；本文件只放组件（满足 fast-refresh）。
 */
import { useMemo } from 'react';
import { itemsOf, dimensionCounts, dimensionsForLevel } from './chronicleDimensions';

/** 维度筛选条（带计数；空维度置灰可点，点了给友好空态）。只展示当前档位可见维度 */
export function DimensionChips({ counts, active, onChange, level }) {
    const dims = dimensionsForLevel(level);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return (
        <div className="chr-chips">
            <button className={`chr-chip ${active === 'all' ? 'chr-chip-on' : ''}`} onClick={() => onChange('all')}>
                🗂 全部 <span className="chr-chip-count">{total}</span>
            </button>
            {dims.map(d => (
                <button key={d.key}
                    className={`chr-chip ${active === d.key ? 'chr-chip-on' : ''} ${counts[d.key] ? '' : 'chr-chip-empty'}`}
                    style={{ '--chip-color': d.color }}
                    onClick={() => onChange(d.key)}>
                    {d.icon} {d.label} <span className="chr-chip-count">{counts[d.key]}</span>
                </button>
            ))}
        </div>
    );
}

function DimensionCard({ dim, items }) {
    return (
        <div className="chr-dim-card" style={{ '--dim-color': dim.color }}>
            <div className="chr-dim-head">
                <span className="chr-dim-title">{dim.icon} {dim.label}</span>
                <span className="chr-dim-count">{items.length}</span>
            </div>
            {items.length === 0
                ? <div className="chr-dim-empty">暂无「{dim.label}」记录</div>
                : (
                    <ul className="chr-dim-list">
                        {items.map((it, i) => (
                            <li key={i} className="chr-dim-item">
                                <span className="chr-dim-meta">第{it.chapter}章 · {it.entity}</span>
                                {it.scene && <span className="chr-dim-scene">【{it.scene}】</span>}
                                <span className="chr-dim-text">{it.text}</span>
                                {it.note && <span className="chr-dim-note">↳ {it.note}</span>}
                            </li>
                        ))}
                    </ul>
                )}
        </div>
    );
}

/** 按维度视图：全部=只展示有数据的维度；选中某维度=只展示该维度（均限当前档位可见维度） */
export function ChronicleByDimension({ data, active, level }) {
    const dims = dimensionsForLevel(level);
    const counts = dimensionCounts(data, level);
    const shown = active === 'all'
        ? dims.filter(d => counts[d.key] > 0)
        : dims.filter(d => d.key === active);
    if (data.length === 0) return <div className="chr-empty">暂无编年史数据，Pipeline运行后将自动提取</div>;
    if (shown.length === 0) return <div className="chr-empty">该维度暂无记录，可点「补提取」或切换其他维度</div>;
    return (
        <div className="chr-dim-grid">
            {shown.map(d => (
                <DimensionCard key={d.key} dim={d} items={data.flatMap(e => itemsOf(e, d.key))} />
            ))}
        </div>
    );
}

/** 按章节视图：章节 → 角色 → 各维度条目（限当前档位可见维度） */
export function ChronicleByChapter({ data, level }) {
    const dims = dimensionsForLevel(level);
    const byChapter = useMemo(() => {
        const map = new Map();
        for (const e of data) {
            const ch = e.chapterNumber || 0;
            if (!map.has(ch)) map.set(ch, []);
            map.get(ch).push(e);
        }
        return [...map.entries()].sort((a, b) => a[0] - b[0]);
    }, [data]);
    if (byChapter.length === 0) return <div className="chr-empty">暂无编年史数据</div>;
    return (
        <div className="chr-bychapter">
            {byChapter.map(([ch, entries]) => (
                <div key={ch} className="chr-chapter-block">
                    <div className="chr-chapter-title">第{ch}章 · {entries.length}人</div>
                    {entries.map((e, i) => (
                        <div key={i} className="chr-chapter-entry">
                            <div className="chr-chapter-entity">{e.entityName}</div>
                            {dims.map(d => {
                                const items = itemsOf(e, d.key);
                                if (!items.length) return null;
                                return (
                                    <div key={d.key} className="chr-chapter-dim" style={{ '--dim-color': d.color }}>
                                        <span className="chr-chapter-dimlabel">{d.icon} {d.label}</span>
                                        {items.map((it, j) => (
                                            <span key={j} className="chr-chapter-item">
                                                {it.scene ? `【${it.scene}】` : ''}{it.text}
                                            </span>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
