import { useState } from 'react';
import { CONFIDENCE_LABELS, CONFIDENCE_COLORS, SOURCE_HOW_LABELS } from './constants';
import useKnowledgeState from './useKnowledgeState';
import s from './knowledge.module.css';

export default function KnowledgeTab({ projectId, characters }) {
    const {
        records, loading, filter, showForm, form, saving,
        setShowForm, updateFilter, updateForm, handleCreate, handleDelete, loadRecords,
    } = useKnowledgeState(projectId, characters);

    const entityNameMap = new Map();
    for (const c of characters) entityNameMap.set(c.id, c._adapted?.name || c.name || c.id);

    const grouped = new Map();
    for (const r of records) {
        const key = r.factText || r.factId;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(r);
    }

    return (
        <div className="cyber-card">
            <div className="ec-flex ec-justify-between ec-items-center ec-mb-16">
                <h3 className="ec-section-title">限知认知管理</h3>
                <button className="cyber-btn cyber-btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? '取消' : '+ 新增限知'}
                </button>
            </div>

            <div className="ec-flex ec-gap-10 ec-mb-12 ec-flex-wrap">
                <input className="cyber-input" placeholder="按事实ID筛选" value={filter.factId}
                    onChange={e => updateFilter('factId', e.target.value)} />
                <select className="cyber-select" value={filter.entityId}
                    onChange={e => updateFilter('entityId', e.target.value)}>
                    <option value="">全部角色</option>
                    {characters.map(c => (
                        <option key={c.id} value={c.id}>{c._adapted?.name || c.id}</option>
                    ))}
                </select>
                <button className="cyber-btn" onClick={loadRecords}>刷新</button>
            </div>

            {showForm && (
                <div className={`cyber-card ec-mb-16 ${s.formCard}`}>
                    <h4 className="ec-mb-8">新增限知记录</h4>
                    <div className="ec-grid ec-grid-2 ec-gap-10">
                        <input className="cyber-input" placeholder="事实ID（如：秘密关系:角色A-角色B）"
                            value={form.factId} onChange={e => updateForm('factId', e.target.value)} />
                        <select className="cyber-select" value={form.entityName}
                            onChange={e => updateForm('entityName', e.target.value)}>
                            <option value="">选择角色</option>
                            {characters.map(c => (
                                <option key={c.id} value={c._adapted?.name || c.id}>
                                    {c._adapted?.name || c.id}
                                </option>
                            ))}
                        </select>
                        <select className="cyber-select" value={form.confidence}
                            onChange={e => updateForm('confidence', e.target.value)}>
                            {Object.entries(CONFIDENCE_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                        <select className="cyber-select" value={form.sourceHow}
                            onChange={e => updateForm('sourceHow', e.target.value)}>
                            {Object.entries(SOURCE_HOW_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </div>
                    <input className="cyber-input ec-mt-10" placeholder="备注" value={form.notes}
                        onChange={e => updateForm('notes', e.target.value)} />
                    <button className="cyber-btn cyber-btn-primary ec-mt-10"
                        disabled={saving || !form.factId || !form.entityName} onClick={handleCreate}>
                        {saving ? '保存中...' : '保存'}
                    </button>
                </div>
            )}

            {loading ? <div className="ec-p-20 ec-text-center">加载中...</div> : (
                grouped.size === 0 ? (
                    <div className={`ec-p-20 ec-text-center ${s.emptyHint}`}>
                        暂无限知记录。章节审批通过后会自动提取限知数据，也可手动新增。
                    </div>
                ) : (
                    <div className="ec-flex ec-flex-col ec-gap-12">
                        {Array.from(grouped.entries()).map(([factKey, recs]) => (
                            <FactGroup key={factKey} factKey={factKey} records={recs}
                                entityNameMap={entityNameMap} onDelete={handleDelete} />
                        ))}
                    </div>
                )
            )}
        </div>
    );
}

function FactGroup({ factKey, records, entityNameMap, onDelete }) {
    const [confirmId, setConfirmId] = useState(null);
    return (
        <div className={`cyber-card ${s.factCard}`}>
            <div className="ec-flex ec-justify-between ec-items-center">
                <h4 className={`ec-section-title ${s.factTitle}`}>{factKey}</h4>
                <span className={s.factCount}>{records.length} 条记录</span>
            </div>
            <div className="ec-flex ec-flex-col ec-gap-6 ec-mt-8">
                {records.map(r => (
                    <div key={r.id} className={`ec-flex ec-items-center ec-gap-8 ${s.factRow}`}>
                        <span className={s.factName}>{entityNameMap.get(r.entityId) || r.entityId}</span>
                        <ConfidenceBadge confidence={r.confidence} />
                        <SourceBadge sourceHow={r.sourceHow} />
                        {r.sinceChapter > 0 && <span className={s.factChapter}>Ch{r.sinceChapter}</span>}
                        {r.notes && <span className={s.factNotes}>{r.notes}</span>}
                        <button className={`cyber-btn ${s.factDelete}`}
                            onClick={() => confirmId === r.id ? onDelete(r.id) : setConfirmId(r.id)}
                            onBlur={() => setConfirmId(null)}>
                            {confirmId === r.id ? '确认?' : '×'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ConfidenceBadge({ confidence }) {
    const color = CONFIDENCE_COLORS[confidence] || '#888';
    const label = CONFIDENCE_LABELS[confidence] || confidence;
    return <span className={s.confidenceBadge} style={{ color }}>[{label}]</span>;
}

function SourceBadge({ sourceHow }) {
    const label = SOURCE_HOW_LABELS[sourceHow] || sourceHow;
    return <span className={s.sourceBadge}>({label})</span>;
}
