/**
 * CategoryBrowser.jsx — 通用"分类浏览器"（搜索 + 分面 chips + 分组 + 排序）
 * 供 装备/功法/宠物/仆人 等 tab 复用。卡片内容由 renderCard 注入，保持各 tab 原有交互。
 */
import { useState, useMemo } from 'react';
import { countByKey, groupByKey, matchesText } from './categoryUtils';
import './categoryBrowser.css';

export default function CategoryBrowser({
    items = [], searchOf, searchPlaceholder = '搜索…',
    facets = [], facetOf, facetAllLabel = '全部',
    groups = [], groupOf, sortOptions = [],
    renderCard, emptyIcon = '📦', emptyText = '暂无数据',
}) {
    const [query, setQuery] = useState('');
    const [facetKey, setFacetKey] = useState('all');
    const [sortKey, setSortKey] = useState(sortOptions[0]?.key || 'default');

    const counts = useMemo(() => countByKey(items, facetOf), [items, facetOf]);
    const cmp = useMemo(() => sortOptions.find(o => o.key === sortKey)?.cmp, [sortOptions, sortKey]);
    const shown = useMemo(
        () => items.filter(it => (facetKey === 'all' || facetOf(it) === facetKey) && matchesText(searchOf(it), query)),
        [items, facetKey, facetOf, searchOf, query]
    );
    const grouped = useMemo(() => groupByKey(shown, groupOf, groups, cmp), [shown, groupOf, groups, cmp]);

    if (!items.length) {
        return <div className="cb-empty"><div className="cb-empty-icon" aria-hidden="true">{emptyIcon}</div><div>{emptyText}</div></div>;
    }

    return (
        <div className="cb-root">
            <div className="cb-tools">
                <input className="cb-search" value={query} placeholder={searchPlaceholder}
                    onChange={e => setQuery(e.target.value)} aria-label={searchPlaceholder} />
                {sortOptions.length > 0 && (
                    <select className="cb-sort" value={sortKey} onChange={e => setSortKey(e.target.value)} aria-label="排序方式">
                        {sortOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                )}
                <span className="cb-count">{shown.length}/{items.length}</span>
            </div>

            {facets.length > 0 && (
                <div className="cb-chips">
                    <button className={`cb-chip ${facetKey === 'all' ? 'cb-chip-on' : ''}`} onClick={() => setFacetKey('all')}>
                        {facetAllLabel} {items.length}
                    </button>
                    {facets.map(f => (
                        <button key={f.key} className={`cb-chip ${facetKey === f.key ? 'cb-chip-on' : ''}`}
                            onClick={() => setFacetKey(f.key)}>
                            {f.color && <span className="cb-chip-dot" style={{ background: f.color }} />}
                            {f.label} {counts[f.key] || 0}
                        </button>
                    ))}
                </div>
            )}

            {shown.length === 0 && <div className="cb-empty">没有匹配项</div>}

            {grouped.map(g => (
                <section key={g.key} className="cb-group">
                    {g.label && (
                        <div className="cb-group-head">
                            {g.color && <span className="cb-group-dot" style={{ background: g.color }} />}
                            <span className="cb-group-name" style={{ color: g.color }}>{g.label}</span>
                            <span className="cb-group-count">{g.members.length}</span>
                            {g.hint && <span className="cb-group-hint">{g.hint}</span>}
                        </div>
                    )}
                    <div className="cb-grid">
                        {g.members.map(it => <div className="cb-cell" key={it.id}>{renderCard(it)}</div>)}
                    </div>
                </section>
            ))}
        </div>
    );
}
