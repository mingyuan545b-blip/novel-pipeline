/**
 * EntityGraph.jsx — 关系视图
 * 复合视图：按「一对角色」聚合，多边即复合关系（解决「关系都是单一」）
 * 中心视图：以某角色为中心看 1 跳直接关系 + 2 跳关联
 */
import { useState, useMemo } from 'react';
import RelationPairRow from './RelationPairRow';
import CreateRelationForm from './CreateRelationForm';
import { buildPairs, filterPairs, centerView, typeCounts, relMeta } from './relationUtils';
import { REL_TYPE_LABELS, REL_TYPE_COLORS } from './constants';
import './relationView.css';

const MODES = [{ key: 'pairs', label: '复合视图' }, { key: 'center', label: '中心视图' }];

export default function EntityGraph({ allRelations, getCharName, characters, onCreateRelation }) {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [mode, setMode] = useState('pairs');
    const [filters, setFilters] = useState({ q: '', type: 'all', compoundOnly: false });
    const [centerId, setCenterId] = useState('');

    const nameOf = (id) => getCharName(id);
    const pairs = useMemo(() => buildPairs(allRelations || [], nameOf), [allRelations, getCharName]);
    const shown = useMemo(() => filterPairs(pairs, filters), [pairs, filters]);
    const counts = useMemo(() => typeCounts(allRelations || []), [allRelations]);
    const compoundCount = pairs.filter(p => p.compound).length;
    const center = useMemo(() => (centerId ? centerView(allRelations || [], centerId, nameOf) : null), [centerId, allRelations, getCharName]);

    const centerPairs = useMemo(() => {
        if (!center) return [];
        return center.direct.map(d => {
            const edges = d.edges.map(e => e.rel);
            return {
                key: 'c-' + d.other.id, a: { id: centerId, name: nameOf(centerId) }, b: d.other, edges,
                types: [...new Set(edges.map(e => e.relType || 'other'))],
                strength: Math.max(...edges.map(e => e.strength || 50)), compound: edges.length > 1,
            };
        });
    }, [center, centerId, allRelations, getCharName]);

    if (!allRelations.length && !showCreateForm) {
        return (
            <div className="cyber-card cyber-empty">
                <div className="cyber-empty-icon" aria-hidden="true">🔗</div>
                <div>暂无关系数据</div>
                <div className="ec-text-12 ec-text-muted ec-mt-8">关系数据在大纲生成和 Pipeline 运行时自动创建，也可以手动添加。</div>
                <button className="cyber-btn cyber-btn-sm ec-mt-12" onClick={() => setShowCreateForm(true)}>手动创建关系</button>
            </div>
        );
    }

    const types = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    // 中心角色候选取自"关系里真实出现的 id"（关系用的是 UUID，可能与 characters[].id 不同源）
    const centerOptions = (() => {
        const ids = new Set();
        for (const r of allRelations) { ids.add(r.fromCharacterId); ids.add(r._adapted?.toCharacterId || r.toCharacterId); }
        return [...ids].map(id => ({ id, name: nameOf(id) })).sort((a, b) => a.name.localeCompare(b.name));
    })();
    const chip = (on) => 'cb-chip ' + (on ? 'cb-chip-on' : '');

    return (
        <div>
            <div className="ec-flex ec-justify-between ec-items-center ec-mb-12 ec-flex-wrap ec-gap-8">
                <div className="ec-flex ec-gap-8 ec-items-center ec-flex-wrap">
                    <span className="ec-badge ec-badge-muted">{allRelations.length} 条边 · {pairs.length} 对 · {compoundCount} 对复合</span>
                    {MODES.map(m => (
                        <button key={m.key} className={chip(mode === m.key)} onClick={() => setMode(m.key)}>{m.label}</button>
                    ))}
                </div>
                <button className="cyber-btn cyber-btn-sm" onClick={() => setShowCreateForm(!showCreateForm)}>
                    {showCreateForm ? '收起' : '新建关系'}
                </button>
            </div>

            {showCreateForm && (
                <CreateRelationForm characters={characters}
                    onSubmit={(data) => { if (onCreateRelation) onCreateRelation(data); setShowCreateForm(false); }}
                    onCancel={() => setShowCreateForm(false)} />
            )}

            {mode === 'pairs' ? (
                <>
                    <div className="cb-tools ec-mb-10">
                        <input className="cb-search" placeholder="搜索角色 / 关系描述 / 备注…" value={filters.q}
                            onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} aria-label="搜索关系" />
                        <button className={chip(filters.compoundOnly)}
                            onClick={() => setFilters(f => ({ ...f, compoundOnly: !f.compoundOnly }))}>仅复合</button>
                        <span className="cb-count">{shown.length}/{pairs.length}</span>
                    </div>
                    <div className="cb-chips ec-mb-12">
                        <button className={chip(filters.type === 'all')} onClick={() => setFilters(f => ({ ...f, type: 'all' }))}>全部 {allRelations.length}</button>
                        {types.map(t => (
                            <button key={t} className={chip(filters.type === t)} onClick={() => setFilters(f => ({ ...f, type: t }))}>
                                <span className="cb-chip-dot" style={{ background: REL_TYPE_COLORS[t] || '#888' }} />{REL_TYPE_LABELS[t] || t} {counts[t]}
                            </button>
                        ))}
                    </div>
                    {shown.length === 0 && <div className="cb-empty">没有匹配的关系</div>}
                    <div className="ec-flex-col ec-gap-8">
                        {shown.map(p => <RelationPairRow key={p.key} pair={p} getCharName={getCharName} />)}
                    </div>
                </>
            ) : (
                <>
                    <div className="cb-tools ec-mb-12">
                        <select className="cyber-select ec-select-max-250" value={centerId} onChange={e => setCenterId(e.target.value)} aria-label="中心角色">
                            <option value="">选择中心角色…</option>
                            {centerOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {center && <span className="cb-count">{center.direct.length} 个直接对象 · {center.second.length} 条二跳</span>}
                    </div>
                    {!center && <div className="cb-empty">选择一个角色，查看以他为中心的关系网</div>}
                    {center && (
                        <>
                            <div className="rp-section-title">直接关系（1 跳）</div>
                            <div className="ec-flex-col ec-gap-8">
                                {centerPairs.map(p => <RelationPairRow key={p.key} pair={p} getCharName={getCharName} defaultOpen />)}
                            </div>
                            {center.second.length > 0 && (
                                <>
                                    <div className="rp-section-title">关联关系（2 跳，涉及直接对象）</div>
                                    <div className="ec-flex-col ec-gap-6">
                                        {center.second.map(s => {
                                            const m = relMeta(s.rel.relType);
                                            return (
                                                <div key={s.id} className="cyber-card rp-2hop" style={{ borderLeftColor: m.color }}>
                                                    <span className="ec-text-12">{s.fromName}</span>
                                                    <span className="rp-badge" style={{ '--badge-bg': m.color + '1a', '--badge-color': m.color }}>{m.label}</span>
                                                    <span className="ec-text-12">{s.toName}</span>
                                                    {s.rel.relLabel && <span className="rp-label">{s.rel.relLabel}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
