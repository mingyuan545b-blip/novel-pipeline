import { EVENT_TYPE_LABELS, SIGNIFICANCE_LABELS, STORYLINE_LABELS, INITIAL_FORM } from './timelineConstants';
import './knowledge.css';

export function TimelineToolbar({ showForm, setShowForm, filter, setFilter, onRefresh, stats, sortedChapters }) {
    return (
        <div className="flex flex-wrap gap-12 mb-20" style={{ alignItems: 'center' }}>
            <button className="cyber-btn cyber-btn-primary" onClick={() => setShowForm(!showForm)}>
                {showForm ? '取消' : '+ 新建事件'}
            </button>
            <select className="cyber-select" value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="all">全部类型</option>
                {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                ))}
            </select>
            <button className="cyber-btn" onClick={onRefresh}>刷新</button>
            {stats && (
                <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
                    共 {stats.total} 个事件 · {sortedChapters.length} 个章节
                </span>
            )}
        </div>
    );
}

export function TimelineForm({ form, setForm, onSubmit, onCancel }) {
    return (
        <div className="cyber-card mb-20 p-20">
            <h4 style={{ margin: '0 0 16px' }}>新建时间轴事件</h4>
            <form onSubmit={onSubmit}>
                <div className="flex flex-wrap gap-12">
                    <div className="flex-1" style={{ minWidth: 120 }}>
                        <label className="form-label">章节号 *</label>
                        <input className="cyber-input" type="number" value={form.chapterNumber} onChange={e => setForm({ ...form, chapterNumber: e.target.value })} required min={1} />
                    </div>
                    <div className="flex-1" style={{ minWidth: 120 }}>
                        <label className="form-label">事件类型</label>
                        <select className="cyber-select" value={form.eventType} onChange={e => setForm({ ...form, eventType: e.target.value })}>
                            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </div>
                    <div className="flex-1" style={{ minWidth: 120 }}>
                        <label className="form-label">重要程度</label>
                        <select className="cyber-select" value={form.significance} onChange={e => setForm({ ...form, significance: e.target.value })}>
                            {Object.entries(SIGNIFICANCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </div>
                    <div className="flex-1" style={{ minWidth: 120 }}>
                        <label className="form-label">主线/支线</label>
                        <select className="cyber-select" value={form.storyline || 'sub'} onChange={e => setForm({ ...form, storyline: e.target.value })}>
                            {Object.entries(STORYLINE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </div>
                    <div className="flex-1" style={{ minWidth: 120 }}>
                        <label className="form-label">故事时间</label>
                        <input className="cyber-input" value={form.eventTime} onChange={e => setForm({ ...form, eventTime: e.target.value })} placeholder="如：第三天清晨" />
                    </div>
                </div>
                <div className="mt-12">
                    <label className="form-label">事件描述 *</label>
                    <textarea className="cyber-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} required />
                </div>
                <div className="flex flex-wrap gap-12 mt-12">
                    <div className="flex-1" style={{ minWidth: 120 }}>
                        <label className="form-label">参与者ID(逗号分隔)</label>
                        <input className="cyber-input" value={form.actorIds} onChange={e => setForm({ ...form, actorIds: e.target.value })} />
                    </div>
                    <div className="flex-1" style={{ minWidth: 120 }}>
                        <label className="form-label">地点ID</label>
                        <input className="cyber-input" value={form.locationId} onChange={e => setForm({ ...form, locationId: e.target.value })} />
                    </div>
                    <div className="flex-1" style={{ minWidth: 120 }}>
                        <label className="form-label">持续时间</label>
                        <input className="cyber-input" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="如：3天" />
                    </div>
                </div>
                <div className="flex gap-8 mt-16" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="cyber-btn" onClick={onCancel}>取消</button>
                    <button type="submit" className="cyber-btn cyber-btn-primary">创建</button>
                </div>
            </form>
        </div>
    );
}

export function TimelineEventList({ sortedChapters, grouped, onDelete }) {
    return (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
            <div className="timeline-line" />
            {sortedChapters.map(chKey => (
                <TimelineChapterGroup key={chKey} chKey={chKey} events={grouped[chKey]} onDelete={onDelete} />
            ))}
        </div>
    );
}

function TimelineChapterGroup({ chKey, events, onDelete }) {
    return (
        <div className="mb-24">
            <div className="timeline-chapter-header">
                第{chKey}章 ({events.length}个事件)
            </div>
            {events.map((ev, idx) => (
                <TimelineEventItem key={ev.id} event={ev} index={idx} onDelete={onDelete} />
            ))}
        </div>
    );
}

function TimelineEventItem({ event, index, onDelete }) {
    const typeCfg = EVENT_TYPE_LABELS[event.eventType] || EVENT_TYPE_LABELS.event;
    const sigCfg = SIGNIFICANCE_LABELS[event.significance] || SIGNIFICANCE_LABELS.normal;
    const storylineKey = event.storyline || (event.significance === 'major' || event.significance === 'critical' ? 'main' : 'sub');
    const storylineCfg = STORYLINE_LABELS[storylineKey] || STORYLINE_LABELS.sub;
    return (
        <div style={{ position: 'relative', marginBottom: 12 }}>
            <div className="timeline-dot" style={{ background: typeCfg.color }} />
            <div className="cyber-card" style={{ borderLeft: `3px solid ${typeCfg.color}`, marginLeft: 8 }}>
                <div className="flex flex-between" style={{ alignItems: 'flex-start' }}>
                    <div className="flex-1">
                        <div className="flex flex-wrap gap-8 mb-4" style={{ alignItems: 'center' }}>
                            <span className="text-muted text-xs">#{index + 1}</span>
                            <span className="cyber-badge" style={{ background: `${typeCfg.color}20`, color: typeCfg.color, border: `1px solid ${typeCfg.color}40` }}>
                                {typeCfg.label}
                            </span>
                            <span className="cyber-badge" style={{ background: `${sigCfg.color}20`, color: sigCfg.color, border: `1px solid ${sigCfg.color}40`, fontSize: 11 }}>
                                {sigCfg.label}
                            </span>
                            <span className="cyber-badge timeline-storyline-badge" style={{ background: `${storylineCfg.color}20`, color: storylineCfg.color, border: `1px solid ${storylineCfg.color}40` }}>
                                {storylineCfg.label}
                            </span>
                        </div>
                        <div className="text-md lh-1-6 text-primary">{event.description}</div>
                        <div className="flex flex-wrap gap-12 mt-4 text-muted text-sm">
                            {event.eventTime && <span>🕐 {event.eventTime}</span>}
                            {event.duration && <span>⏱ {event.duration}</span>}
                            {(event.actorIds || []).length > 0 && <span>👥 {event.actorIds.length}人</span>}
                            {event.locationId && <span>📍 {event.locationId}</span>}
                        </div>
                    </div>
                    <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={() => onDelete(event.id)} style={{ marginLeft: 8, flexShrink: 0 }}>
                        删除
                    </button>
                </div>
            </div>
        </div>
    );
}
