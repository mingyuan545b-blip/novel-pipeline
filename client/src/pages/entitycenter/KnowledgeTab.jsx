import { useCallback, useMemo, useState } from 'react';
import { CONFIDENCE_LABELS, SOURCE_HOW_LABELS } from './constants';
import useKnowledgeState from './useKnowledgeState';
import KnowledgeRecordRow from './KnowledgeRecordRow';
import KnowledgeTree from './KnowledgeTree';
import { presentCategories, chapterOptionsOf, filterKnowledge } from './knowledgeUtils';
import { TREE_AXES, buildKnowledgeTree } from './knowledgeTreeBuild';
import s from './knowledge.module.css';
import './categoryBrowser.css';

export default function KnowledgeTab({ projectId, characters }) {
    const {
        records, loading, filter, showForm, form, saving,
        setShowForm, updateFilter, updateForm, handleCreate, handleDelete, loadRecords,
    } = useKnowledgeState(projectId, characters);

    const entityNameMap = useMemo(() => {
        const m = new Map();
        for (const c of characters) m.set(c.id, c._adapted?.name || c.name || c.id);
        return m;
    }, [characters]);
    const nameOf = useCallback((id) => entityNameMap.get(id) || id, [entityNameMap]);

    const [axis, setAxis] = useState('entity');
    const cats = useMemo(() => presentCategories(records), [records]);
    const chapters = useMemo(() => chapterOptionsOf(records), [records]);
    const shown = useMemo(() => filterKnowledge(records, filter, nameOf), [records, filter, nameOf]);
    const nodes = useMemo(() => buildKnowledgeTree(shown, axis, nameOf), [shown, axis, nameOf]);
    const factCount = useMemo(() => new Set(shown.map(r => r.factText || r.factId)).size, [shown]);
    const byEvent = axis === 'event';
    const renderLeaf = (r) => (
        <KnowledgeRecordRow key={r.id} record={r} nameOf={nameOf}
            showEntity={byEvent} showConfidence={byEvent} showSource={!byEvent}
            showCategory={!byEvent} showFact={!byEvent} onDelete={handleDelete} />
    );

    return (
        <div className="cyber-card">
            <div className="ec-flex ec-justify-between ec-items-center ec-mb-16">
                <h3 className="ec-section-title">限知认知管理</h3>
                <button className="cyber-btn cyber-btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? '取消' : '+ 新增限知'}
                </button>
            </div>

            <div className="cb-tools ec-mb-10">
                <input className="cb-search" placeholder="搜索事实 / 备注 / 角色…" value={filter.query}
                    onChange={e => updateFilter('query', e.target.value)} aria-label="搜索限知事实" />
                <select className="cyber-select ec-select-max-200" value={filter.entityId}
                    onChange={e => updateFilter('entityId', e.target.value)} aria-label="人物筛选">
                    <option value="">全部人物</option>
                    {characters.map(c => (
                        <option key={c.id} value={c.id}>{c._adapted?.name || c.id}</option>
                    ))}
                </select>
                <select className="cyber-select ec-select-max-150" value={filter.chapter}
                    onChange={e => updateFilter('chapter', e.target.value)} aria-label="章节筛选">
                    <option value="all">全部章节</option>
                    {chapters.map(n => <option key={n} value={String(n)}>{n > 0 ? `第${n}章` : '未标注'}</option>)}
                </select>
                <button className="cyber-btn" onClick={loadRecords}>刷新</button>
            </div>

            <div className="cb-chips ec-mb-10">
                <button className={`cb-chip ${filter.category === 'all' ? 'cb-chip-on' : ''}`}
                    onClick={() => updateFilter('category', 'all')}>全部分类 {records.length}</button>
                {cats.map(c => (
                    <button key={c.key} className={`cb-chip ${filter.category === c.key ? 'cb-chip-on' : ''}`}
                        onClick={() => updateFilter('category', c.key)}>
                        <span className="cb-chip-dot" style={{ background: c.color }} />{c.label} {c.count}
                    </button>
                ))}
            </div>

            <div className="ec-flex ec-items-center ec-gap-8 ec-mb-12">
                <span className="ec-text-11 ec-text-muted">视角：</span>
                {TREE_AXES.map(m => (
                    <button key={m.key} title={m.hint}
                        className={`cyber-btn cyber-btn-sm ec-text-11 ${axis === m.key ? 'cyber-btn-primary' : ''}`}
                        onClick={() => setAxis(m.key)}>{m.label}</button>
                ))}
                <span className="ec-text-11 ec-text-muted ec-ml-auto">
                    {cats.length} 个分类 · {factCount} 条事实 · {shown.length} 条认知记录
                </span>
            </div>

            {showForm && (
                <div className={`cyber-card ec-mb-16 ${s.formCard}`}>
                    <h4 className="ec-mb-8">新增限知记录</h4>
                    <div className="ec-grid ec-grid-2 ec-gap-10">
                        <input className="cyber-input" placeholder="事实ID（如：秘密:角色A-角色B）"
                            value={form.factId} onChange={e => updateForm('factId', e.target.value)} />
                        <select className="cyber-select" value={form.entityName}
                            onChange={e => updateForm('entityName', e.target.value)}>
                            <option value="">选择角色</option>
                            {characters.map(c => (
                                <option key={c.id} value={c._adapted?.name || c.id}>{c._adapted?.name || c.id}</option>
                            ))}
                        </select>
                        <select className="cyber-select" value={form.confidence}
                            onChange={e => updateForm('confidence', e.target.value)}>
                            {Object.entries(CONFIDENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <select className="cyber-select" value={form.sourceHow}
                            onChange={e => updateForm('sourceHow', e.target.value)}>
                            {Object.entries(SOURCE_HOW_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
                nodes.length === 0 ? (
                    <div className={`ec-p-20 ec-text-center ${s.emptyHint}`}>
                        {records.length === 0
                            ? '暂无限知记录。章节审批通过后会自动提取限知数据，也可手动新增。'
                            : '没有匹配的限知记录（试试清空筛选）。'}
                    </div>
                ) : (
                    <KnowledgeTree nodes={nodes} axis={axis} renderLeaf={renderLeaf} />
                )
            )}
        </div>
    );
}
