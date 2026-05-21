import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../store/useAppStore';
import { questApi, chaptersApi } from '../services/api';
import '../styles/timeline.css';

const EVENT_CFG = {
    plot: { label: '📖 剧情', color: 'var(--neon-blue)', badge: 'cyber-badge-blue' },
    character: { label: '👤 人物', color: 'var(--neon-pink)', badge: 'cyber-badge-pink' },
    world: { label: '🌍 世界', color: 'var(--neon-green)', badge: 'cyber-badge-green' },
    conflict: { label: '⚔ 冲突', color: 'var(--neon-red)', badge: 'cyber-badge-red' },
    revelation: { label: '💡 揭示', color: 'var(--neon-orange)', badge: 'cyber-badge-orange' },
    foreshadow: { label: '🔮 伏笔', color: 'var(--neon-purple)', badge: 'cyber-badge-purple' },
    resolution: { label: '🎯 解决', color: 'var(--neon-green)', badge: 'cyber-badge-green' }
};

const QUEST_CFG = {
    planned: { label: '📋 计划中', color: 'var(--text-muted)', badge: 'cyber-badge-blue' },
    active: { label: '⚡ 进行中', color: 'var(--neon-blue)', badge: 'cyber-badge-orange' },
    completed: { label: '✅ 已完成', color: 'var(--neon-green)', badge: 'cyber-badge-green' },
    abandoned: { label: '❌ 已放弃', color: 'var(--neon-red)', badge: 'cyber-badge-red' }
};

function groupByStoryTime(events) {
    const groups = {};
    const noTime = [];
    events.forEach(ev => {
        const timeKey = ev.storyTime ? ev.storyTime.split(/[,，;；]/)[0].trim() : '';
        if (!timeKey) { noTime.push(ev); return; }
        if (!groups[timeKey]) groups[timeKey] = [];
        groups[timeKey].push(ev);
    });
    const sorted = Object.entries(groups).sort((a, b) => {
        const oa = a[1][0].storyOrder || 0;
        const ob = b[1][0].storyOrder || 0;
        return oa - ob;
    });
    if (noTime.length) sorted.push(['未标注时间', noTime]);
    return sorted;
}

export default function TimelinePage() {
    const { currentProject } = useAppStore();
    const [activeTab, setActiveTab] = useState('timeline');
    const [timelines, setTimelines] = useState([]);
    const [quests, setQuests] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingEvent, setEditingEvent] = useState(null);
    const [editingQuest, setEditingQuest] = useState(null);
    const [showEventForm, setShowEventForm] = useState(false);
    const [showQuestForm, setShowQuestForm] = useState(false);
    const [filterType, setFilterType] = useState('all');
    const [filterChapter, setFilterChapter] = useState('all');
    const [completedCollapsed, setCompletedCollapsed] = useState(true);
    const [collapsedGroups, setCollapsedGroups] = useState({});

    const loadData = useCallback(async () => {
        if (!currentProject) { setLoading(false); return; }
        setLoading(true);
        try {
            const [tlRes, qRes, chRes] = await Promise.all([
                questApi.listTimelines({ projectId: currentProject.id }),
                questApi.listQuests({ projectId: currentProject.id }),
                chaptersApi.list({ projectId: currentProject.id })
            ]);
            setTimelines(Array.isArray(tlRes.data || tlRes) ? (tlRes.data || tlRes).sort((a, b) => (a.storyOrder || 0) - (b.storyOrder || 0)) : []);
            setQuests(Array.isArray(qRes.data || qRes) ? (qRes.data || qRes) : []);
            const chData = chRes.data || chRes;
            setChapters(Array.isArray(chData) ? chData : []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [currentProject]);

    useEffect(() => { loadData(); }, [loadData]);

    const chTitle = (id) => { const c = chapters.find(x => x.id === id); return c ? `第${c.chapterNumber}章` : ''; };

    const filtered = timelines.filter(t => {
        if (filterType !== 'all' && t.eventType !== filterType) return false;
        if (filterChapter !== 'all' && !(t.chapterIds || []).includes(filterChapter)) return false;
        return true;
    });

    const timeGroups = groupByStoryTime(filtered);
    const pending = quests.filter(q => q.status === 'planned' || q.status === 'active');
    const done = quests.filter(q => q.status === 'completed' || q.status === 'abandoned');

    const toggleGroup = (key) => setCollapsedGroups(p => ({ ...p, [key]: !p[key] }));

    const saveEvent = async (fd) => {
        try { editingEvent ? await questApi.updateTimeline(editingEvent.id, fd) : await questApi.createTimeline({ ...fd, projectId: currentProject.id }); setShowEventForm(false); setEditingEvent(null); loadData(); } catch (e) { console.error(e); }
    };
    const saveQuest = async (fd) => {
        try { editingQuest ? await questApi.updateQuest(editingQuest.id, fd) : await questApi.createQuest({ ...fd, projectId: currentProject.id }); setShowQuestForm(false); setEditingQuest(null); loadData(); } catch (e) { console.error(e); }
    };
    const delEvent = async (id) => { if (!window.confirm('确定删除？')) return; try { await questApi.deleteTimeline(id); loadData(); } catch (e) { console.error(e); } };
    const delQuest = async (id) => { if (!window.confirm('确定删除？')) return; try { await questApi.deleteQuest(id); loadData(); } catch (e) { console.error(e); } };
    const toggleStatus = async (q, s) => { try { await questApi.updateQuest(q.id, { status: s }); loadData(); } catch (e) { console.error(e); } };

    if (!currentProject) return <div className="cyber-card cyber-empty"><div className="cyber-empty-icon">📅</div><div>请先选择项目</div></div>;
    if (loading) return <div className="cyber-card cyber-empty"><div className="cyber-empty-icon">⏳</div><div>加载中...</div></div>;

    return (
        <div className="tl-page">
            <div className="tl-header">
                <h2>📅 时间轴 & 任务线</h2>
                <div className="tl-tabs">
                    <button className={`cyber-btn ${activeTab === 'timeline' ? 'cyber-btn-primary' : ''}`} onClick={() => setActiveTab('timeline')}>📅 时间线事件</button>
                    <button className={`cyber-btn ${activeTab === 'quests' ? 'cyber-btn-primary' : ''}`} onClick={() => setActiveTab('quests')}>⚔ 主线任务</button>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    {timelines.length === 0 && quests.length === 0 && (
                        <button className="cyber-btn" style={{ background: 'rgba(0,200,255,0.15)', borderColor: 'rgba(0,200,255,0.3)' }} onClick={async () => {
                            if (!window.confirm('将从章节大纲自动生成时间线事件和主线任务，确定？')) return;
                            try {
                                const res = await questApi.autoInit(currentProject.id);
                                const data = res.data;
                                alert(`初始化完成！\n生成 ${data.created.timelines} 个时间线事件\n生成 ${data.created.quests} 个任务\n主线: ${data.summary.mainQuest}`);
                                loadData();
                            } catch (e) { alert('初始化失败: ' + (e.response?.data?.error || e.message)); }
                        }}>🚀 一键初始化</button>
                    )}
                    {activeTab === 'timeline' && <button className="cyber-btn cyber-btn-primary" onClick={() => { setEditingEvent(null); setShowEventForm(true); }}>+ 新建事件</button>}
                    {activeTab === 'quests' && <button className="cyber-btn cyber-btn-primary" onClick={() => { setEditingQuest(null); setShowQuestForm(true); }}>+ 新建任务</button>}
                </div>
            </div>

            {activeTab === 'timeline' && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select className="cyber-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="all">全部类型</option>
                        {Object.entries(EVENT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <select className="cyber-select" value={filterChapter} onChange={e => setFilterChapter(e.target.value)}>
                        <option value="all">全部章节</option>
                        {chapters.sort((a, b) => a.chapterNumber - b.chapterNumber).map(ch => <option key={ch.id} value={ch.id}>第{ch.chapterNumber}章 {ch.title}</option>)}
                    </select>
                    <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>共 {filtered.length} 个事件 · {timeGroups.length} 个时间段</span>
                </div>
            )}

            {activeTab === 'timeline' && (
                <div className="tl-axis">
                    <div className="tl-axis-line" />
                    {filtered.length === 0 && <div className="cyber-card cyber-empty"><div className="cyber-empty-icon">📅</div><div>暂无时间线事件</div></div>}
                    {timeGroups.map(([timeKey, events], gIdx) => {
                        const isCollapsed = collapsedGroups[timeKey];
                        return (
                            <div key={timeKey} className="tl-group">
                                <div className="tl-group-marker" onClick={() => toggleGroup(timeKey)}>
                                    <div className="tl-group-dot" style={{ background: gIdx % 2 === 0 ? 'var(--neon-blue)' : 'var(--neon-purple)' }} />
                                    <div className="tl-group-label">
                                        <span className="tl-group-time">{timeKey}</span>
                                        <span className="tl-group-count">{events.length}事件</span>
                                        <span className="tl-group-toggle">{isCollapsed ? '▸' : '▾'}</span>
                                    </div>
                                </div>
                                {!isCollapsed && (
                                    <div className="tl-group-events">
                                        {events.map((ev, idx) => {
                                            const cfg = EVENT_CFG[ev.eventType] || EVENT_CFG.plot;
                                            const linkedCh = (ev.chapterIds || []).map(chTitle).filter(Boolean);
                                            const globalIdx = filtered.indexOf(ev);
                                            const isLeft = globalIdx % 2 === 0;
                                            return (
                                                <div key={ev.id} className={`tl-event ${isLeft ? 'tl-event-left' : 'tl-event-right'}`}>
                                                    <div className="tl-event-dot" style={{ background: cfg.color, boxShadow: `0 0 8px ${cfg.color}40` }} />
                                                    <div className="tl-event-connector" />
                                                    <div className="cyber-card tl-event-card" style={{ borderLeft: `3px solid ${cfg.color}` }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                                                    <h4 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{ev.title}</h4>
                                                                    <span className={`cyber-badge ${cfg.badge}`}>{cfg.label}</span>
                                                                    {ev.isKeyEvent && <span className="cyber-badge cyber-badge-red">🔑 关键</span>}
                                                                </div>
                                                                {ev.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 4 }}>{ev.description.length > 200 ? ev.description.substring(0, 200) + '...' : ev.description}</div>}
                                                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                                                                    {ev.storyTime && <span>🕐 {ev.storyTime}</span>}
                                                                    {ev.location && <span>📍 {ev.location}</span>}
                                                                </div>
                                                                {linkedCh.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>{linkedCh.map((c, i) => <span key={i} className="cyber-tag">{c}</span>)}</div>}
                                                                {(ev.tags || []).length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>{ev.tags.map((t, i) => <span key={i} className="cyber-tag">{t}</span>)}</div>}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 4, marginLeft: 12, flexShrink: 0 }}>
                                                                <button className="cyber-btn cyber-btn-sm" onClick={() => { setEditingEvent(ev); setShowEventForm(true); }}>编辑</button>
                                                                <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={() => delEvent(ev.id)}>删除</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {activeTab === 'quests' && (
                <div className="tl-quests">
                    <div className="tl-quest-section">
                        <h3 style={{ fontSize: 15, color: 'var(--text-primary)', margin: '0 0 12px', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            进行中的任务 ({pending.length})
                        </h3>
                        {pending.length === 0 && <div className="cyber-card cyber-empty"><div className="cyber-empty-icon">⚔</div><div>暂无进行中的任务</div></div>}
                        {pending.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(q => {
                            const cfg = QUEST_CFG[q.status] || QUEST_CFG.planned;
                            const linkedCh = (q.chapterIds || []).map(chTitle).filter(Boolean);
                            return (
                                <div key={q.id} className="cyber-card" style={{ borderLeft: `3px solid ${cfg.color}`, marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className={`cyber-badge ${cfg.badge}`}>{cfg.label}</span>
                                            <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{q.title}</h4>
                                        </div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="cyber-btn cyber-btn-sm" onClick={() => { setEditingQuest(q); setShowQuestForm(true); }}>编辑</button>
                                            {q.status === 'planned' && <button className="cyber-btn cyber-btn-sm" onClick={() => toggleStatus(q, 'active')}>▶ 开始</button>}
                                            {q.status === 'active' && <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-green)' }} onClick={() => toggleStatus(q, 'completed')}>✓ 完成</button>}
                                            <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={() => delQuest(q.id)}>删除</button>
                                        </div>
                                    </div>
                                    {q.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 4 }}>{q.description}</div>}
                                    {q.progress > 0 && (
                                        <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, margin: '8px 0 4px' }}>
                                            <div style={{ height: '100%', width: `${q.progress}%`, background: 'var(--neon-green)', borderRadius: 3, transition: 'width 0.3s' }} />
                                            <span style={{ position: 'absolute', right: 0, top: -16, fontSize: 11, color: 'var(--text-muted)' }}>{q.progress}%</span>
                                        </div>
                                    )}
                                    {linkedCh.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>{linkedCh.map((c, i) => <span key={i} className="cyber-tag">{c}</span>)}</div>}
                                    {(q.tags || []).length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>{q.tags.map((t, i) => <span key={i} className="cyber-tag">{t}</span>)}</div>}
                                </div>
                            );
                        })}
                    </div>
                    <div className="tl-quest-section">
                        <h3 style={{ fontSize: 15, color: 'var(--text-primary)', margin: '0 0 12px', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }} onClick={() => setCompletedCollapsed(!completedCollapsed)}>
                            已完成 ({done.length}) <span style={{ fontSize: 12 }}>{completedCollapsed ? '▸' : '▾'}</span>
                        </h3>
                        {!completedCollapsed && done.map(q => {
                            const cfg = QUEST_CFG[q.status] || QUEST_CFG.completed;
                            const linkedCh = (q.chapterIds || []).map(chTitle).filter(Boolean);
                            return (
                                <div key={q.id} className="cyber-card" style={{ borderLeft: `3px solid ${cfg.color}`, marginBottom: 10, opacity: 0.65 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className={`cyber-badge ${cfg.badge}`}>{cfg.label}</span>
                                            <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{q.title}</h4>
                                        </div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="cyber-btn cyber-btn-sm" onClick={() => { setEditingQuest(q); setShowQuestForm(true); }}>编辑</button>
                                            <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={() => delQuest(q.id)}>删除</button>
                                        </div>
                                    </div>
                                    {q.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{q.description}</div>}
                                    {linkedCh.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>{linkedCh.map((c, i) => <span key={i} className="cyber-tag">{c}</span>)}</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {showEventForm && <EventFormModal event={editingEvent} chapters={chapters} onSave={saveEvent} onClose={() => { setShowEventForm(false); setEditingEvent(null); }} />}
            {showQuestForm && <QuestFormModal quest={editingQuest} chapters={chapters} onSave={saveQuest} onClose={() => { setShowQuestForm(false); setEditingQuest(null); }} />}
        </div>
    );
}

function EventFormModal({ event, chapters, onSave, onClose }) {
    const [form, setForm] = useState({
        title: event?.title || '', description: event?.description || '', eventType: event?.eventType || 'plot',
        storyOrder: event?.storyOrder || 0, storyTime: event?.storyTime || '', location: event?.location || '',
        chapterIds: event?.chapterIds || [], isKeyEvent: event?.isKeyEvent || false, importance: event?.importance || 'normal',
        tags: event?.tags?.join(', ') || ''
    });
    const submit = (e) => { e.preventDefault(); onSave({ ...form, storyOrder: Number(form.storyOrder), tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] }); };
    const togCh = (id) => setForm(p => ({ ...p, chapterIds: p.chapterIds.includes(id) ? p.chapterIds.filter(x => x !== id) : [...p.chapterIds, id] }));
    return (
        <div className="tl-modal-overlay">
            <div className="tl-modal" onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px' }}>{event ? '编辑事件' : '新建事件'}</h3>
                <form onSubmit={submit}>
                    <div className="tl-form-group"><label>事件标题</label><input className="cyber-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div className="tl-form-group" style={{ flex: 1 }}><label>事件类型</label><select className="cyber-select" value={form.eventType} onChange={e => setForm({ ...form, eventType: e.target.value })}>{Object.entries(EVENT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                        <div className="tl-form-group" style={{ flex: 1 }}><label>故事顺序</label><input className="cyber-input" type="number" value={form.storyOrder} onChange={e => setForm({ ...form, storyOrder: e.target.value })} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div className="tl-form-group" style={{ flex: 1 }}><label>世界观时间</label><input className="cyber-input" value={form.storyTime} onChange={e => setForm({ ...form, storyTime: e.target.value })} placeholder="如：灵元纪年·三千年" /></div>
                        <div className="tl-form-group" style={{ flex: 1 }}><label>地点</label><input className="cyber-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
                    </div>
                    <div className="tl-form-group"><label>描述</label><textarea className="cyber-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                    <div className="tl-form-group"><label>关联章节</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{chapters.sort((a, b) => a.chapterNumber - b.chapterNumber).map(ch => <label key={ch.id} className={`cyber-tag ${form.chapterIds.includes(ch.id) ? 'cyber-tag-active' : ''}`} style={{ cursor: 'pointer' }}><input type="checkbox" checked={form.chapterIds.includes(ch.id)} onChange={() => togCh(ch.id)} style={{ display: 'none' }} />第{ch.chapterNumber}章</label>)}</div></div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div className="tl-form-group" style={{ flex: 1 }}><label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={form.isKeyEvent} onChange={e => setForm({ ...form, isKeyEvent: e.target.checked })} /> 关键事件</label></div>
                        <div className="tl-form-group" style={{ flex: 1 }}><label>标签（逗号分隔）</label><input className="cyber-input" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} /></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button type="button" className="cyber-btn" onClick={onClose}>取消</button>
                        <button type="submit" className="cyber-btn cyber-btn-primary">保存</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function QuestFormModal({ quest, chapters, onSave, onClose }) {
    const [form, setForm] = useState({
        title: quest?.title || '', description: quest?.description || '', status: quest?.status || 'planned',
        priority: quest?.priority || 'normal', progress: quest?.progress || 0, chapterIds: quest?.chapterIds || [],
        notes: quest?.notes || '', tags: quest?.tags?.join(', ') || ''
    });
    const submit = (e) => { e.preventDefault(); onSave({ ...form, progress: Number(form.progress), tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] }); };
    const togCh = (id) => setForm(p => ({ ...p, chapterIds: p.chapterIds.includes(id) ? p.chapterIds.filter(x => x !== id) : [...p.chapterIds, id] }));
    return (
        <div className="tl-modal-overlay">
            <div className="tl-modal" onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px' }}>{quest ? '编辑任务' : '新建任务'}</h3>
                <form onSubmit={submit}>
                    <div className="tl-form-group"><label>任务标题</label><input className="cyber-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div className="tl-form-group" style={{ flex: 1 }}><label>状态</label><select className="cyber-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{Object.entries(QUEST_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                        <div className="tl-form-group" style={{ flex: 1 }}><label>优先级</label><select className="cyber-select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option value="low">低</option><option value="normal">普通</option><option value="high">高</option><option value="critical">紧急</option></select></div>
                    </div>
                    <div className="tl-form-group"><label>进度 ({form.progress}%)</label><input type="range" min="0" max="100" value={form.progress} onChange={e => setForm({ ...form, progress: e.target.value })} style={{ width: '100%' }} /></div>
                    <div className="tl-form-group"><label>描述</label><textarea className="cyber-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                    <div className="tl-form-group"><label>关联章节</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{chapters.sort((a, b) => a.chapterNumber - b.chapterNumber).map(ch => <label key={ch.id} className={`cyber-tag ${form.chapterIds.includes(ch.id) ? 'cyber-tag-active' : ''}`} style={{ cursor: 'pointer' }}><input type="checkbox" checked={form.chapterIds.includes(ch.id)} onChange={() => togCh(ch.id)} style={{ display: 'none' }} />第{ch.chapterNumber}章</label>)}</div></div>
                    <div className="tl-form-group"><label>标签（逗号分隔）</label><input className="cyber-input" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} /></div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button type="button" className="cyber-btn" onClick={onClose}>取消</button>
                        <button type="submit" className="cyber-btn cyber-btn-primary">保存</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
