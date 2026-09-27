import { useState, useMemo } from 'react';
import { SCOPE_ICONS, SCOPE_LABELS, SCOPE_BORDER_COLORS } from './constants';
import { entityTitle, sortFields, scopeCounts, filterKv, groupKv } from './stateTrackUtils';
import './categoryBrowser.css';

const FIELD_COLLAPSE = 8;

function KvEntityCard({ entity }) {
    const [expanded, setExpanded] = useState(false);
    const borderColor = SCOPE_BORDER_COLORS[entity.scope] || 'var(--neon-purple)';
    const fields = sortFields(entity.fields);
    const shown = expanded ? fields : fields.slice(0, FIELD_COLLAPSE);
    return (
        <div className="cyber-card" style={{ borderLeft: `3px solid ${borderColor}` }}>
            <div className="st-entity-head">
                <span className="ec-text-14" aria-hidden="true">{SCOPE_ICONS[entity.scope] || '📋'}</span>
                <span className="ec-text-14 ec-font-600">{entityTitle(entity)}</span>
                <span className="ec-badge-lg ec-badge-cyan">{SCOPE_LABELS[entity.scope] || entity.scope}</span>
                <span className="st-field-count">{fields.length} 字段</span>
            </div>
            <div className="ec-grid-fields">
                {shown.map(([key, field]) => (
                    <div key={key} className={`ec-kv-field ${field.isHot ? 'ec-kv-hot' : 'ec-kv-normal'}`}>
                        <div className="ec-text-10 ec-text-muted ec-flex ec-justify-between">
                            <span>{key}{field.isHot && ' 🔥'}</span>
                            <span>章{field.chapterUpdated}</span>
                        </div>
                        <div className="ec-text-12 ec-text-primary ec-font-mono ec-ellipsis">{String(field.value)}</div>
                    </div>
                ))}
            </div>
            {fields.length > FIELD_COLLAPSE && (
                <button className="cyber-btn cyber-btn-sm cyber-btn-outline st-more" onClick={() => setExpanded(!expanded)}>
                    {expanded ? '收起' : `展开全部 ${fields.length} 字段`}
                </button>
            )}
        </div>
    );
}

function HistoryRecord({ record, toBeijingTime }) {
    const deltaEntries = Object.entries(record.delta || {});
    return (
        <div className="ec-timeline-record">
            <div className="ec-timeline-dot" />
            <div className="cyber-card ec-timeline-card">
                <div className="ec-flex ec-justify-between ec-items-center ec-mb-6">
                    <div>
                        <h4 className="ec-text-14 ec-font-600 ec-title-no-margin">
                            第{record.chapterNumber}章 · {record.characterName || record.characterId}
                        </h4>
                        <div className="ec-text-11 ec-text-muted">{toBeijingTime(record.updatedAt)}</div>
                    </div>
                    <span className="ec-badge-lg ec-badge-cyan">{deltaEntries.length} 项变更</span>
                </div>
                {deltaEntries.length > 0 && (
                    <div className="ec-grid-delta">
                        {deltaEntries.map(([key, change]) => {
                            const from = change?.from ?? '(无)';
                            const displayTo = change?.to !== undefined ? change.to : change;
                            return (
                                <div key={key} className="ec-delta-item">
                                    <span className="ec-text-muted">{key}:</span>{' '}
                                    <span className="ec-delta-from">{String(from)}</span>{' → '}
                                    <span className="ec-delta-to">{String(displayTo)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function KvIndexSection({ kvData, kvScopeFilter, setKvScopeFilter, query, setQuery }) {
    const counts = useMemo(() => scopeCounts(kvData), [kvData]);
    const shown = useMemo(() => filterKv(kvData, { scope: kvScopeFilter, query }), [kvData, kvScopeFilter, query]);
    const groups = useMemo(() => groupKv(shown), [shown]);
    return (
        <>
            <div className="cb-tools ec-mb-10">
                <input className="cb-search" placeholder="搜索实体名 / 字段名…" value={query}
                    onChange={e => setQuery(e.target.value)} aria-label="搜索实体" />
                <span className="cb-count">{shown.length}/{kvData?.length || 0} 个实体</span>
            </div>
            <div className="cb-chips ec-mb-12">
                <button className={`cb-chip ${kvScopeFilter === 'all' ? 'cb-chip-on' : ''}`} onClick={() => setKvScopeFilter('all')}>
                    全部范围 {kvData?.length || 0}
                </button>
                {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                    <button key={k} className={`cb-chip ${kvScopeFilter === k ? 'cb-chip-on' : ''}`} onClick={() => setKvScopeFilter(k)}>
                        {SCOPE_ICONS[k]} {v} {counts[k] || 0}
                    </button>
                ))}
            </div>
            {!kvData?.length ? (
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon" aria-hidden="true">⚡</div>
                    <div>暂无 KV 索引数据。请先运行 Pipeline 的 material-manager 步骤。</div>
                </div>
            ) : groups.length === 0 ? (
                <div className="cb-empty">没有匹配的实体</div>
            ) : (
                groups.map(g => (
                    <section key={g.scope} className="cb-group">
                        <div className="cb-group-head">
                            <span className="cb-group-name">{g.meta.icon} {g.meta.label}</span>
                            <span className="cb-group-count">{g.items.length}</span>
                        </div>
                        <div className="ec-flex-col ec-gap-12">
                            {g.items.map(entity => <KvEntityCard key={`${entity.scope}:${entity.entityKey}`} entity={entity} />)}
                        </div>
                    </section>
                ))
            )}
        </>
    );
}

function HistorySection({ historyCharId, setHistoryCharId, historyData, csCharactersData, statesData, toBeijingTime }) {
    return (
        <div className="ec-divider">
            <h3 className="ec-text-15 ec-font-600 ec-mb-16 ec-color-blue">📋 状态历史</h3>
            <div className="ec-flex ec-gap-12 ec-mb-16 ec-items-center ec-flex-wrap">
                <label className="ec-text-13 ec-text-muted">选择角色:</label>
                <select className="cyber-select ec-select-max-250" value={historyCharId || ''} onChange={e => setHistoryCharId(e.target.value || null)}>
                    <option value="">-- 请选择 --</option>
                    {csCharactersData?.characters?.map(c => (
                        <option key={c.entityKey} value={c.entityKey}>{c.name} ({c.entityKey})</option>
                    ))}
                </select>
                {statesData?.length > 0 && !historyCharId && (
                    <select className="cyber-select ec-select-max-250" onChange={e => setHistoryCharId(e.target.value)}>
                        <option value="">从状态记录中选择...</option>
                        {[...new Set(statesData.map(s => s.characterId))].map(cid => (
                            <option key={cid} value={cid}>{statesData.find(s => s.characterId === cid)?.characterName || cid}</option>
                        ))}
                    </select>
                )}
            </div>
            {!historyData?.length ? (
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon" aria-hidden="true">📋</div>
                    <div>{historyCharId ? '该角色暂无状态历史记录' : '请先选择一个角色查看状态历史'}</div>
                </div>
            ) : (
                <div className="ec-timeline">
                    <div className="ec-timeline-line" />
                    {historyData.map(record => <HistoryRecord key={record.id} record={record} toBeijingTime={toBeijingTime} />)}
                </div>
            )}
        </div>
    );
}

export default function StateTrackingTab({ kvData, kvScopeFilter, setKvScopeFilter, historyCharId, setHistoryCharId, historyData, csCharactersData, statesData, toBeijingTime }) {
    const [query, setQuery] = useState('');
    return (
        <div>
            <KvIndexSection kvData={kvData} kvScopeFilter={kvScopeFilter} setKvScopeFilter={setKvScopeFilter} query={query} setQuery={setQuery} />
            <HistorySection historyCharId={historyCharId} setHistoryCharId={setHistoryCharId} historyData={historyData}
                csCharactersData={csCharactersData} statesData={statesData} toBeijingTime={toBeijingTime} />
        </div>
    );
}
