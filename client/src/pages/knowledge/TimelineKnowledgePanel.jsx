import { useState } from 'react';
import { knowledgeApi } from '../../services/api';
import { INITIAL_FORM } from './timelineConstants';
import { TimelineToolbar, TimelineForm, TimelineEventList } from './TimelineSubComponents';
import './knowledge.css';

export default function TimelineKnowledgePanel({ events, stats, filter, setFilter, projectId, onRefresh }) {
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(INITIAL_FORM);

    // 防御性处理：确保 events 是数组（API 可能返回 null/undefined/对象）
    const safeEvents = Array.isArray(events) ? events : [];
    const filtered = filter === 'all' ? safeEvents : safeEvents.filter(e => e && e.eventType === filter);
    const grouped = {};
    filtered.forEach(e => {
        const ch = e.chapterNumber || 0;
        if (!grouped[ch]) grouped[ch] = [];
        grouped[ch].push(e);
    });
    const sortedChapters = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const data = {
                ...form,
                chapterNumber: Number(form.chapterNumber),
                actorIds: form.actorIds ? form.actorIds.split(',').map(s => s.trim()).filter(Boolean) : [],
                precedingEventIds: form.precedingEventIds ? form.precedingEventIds.split(',').map(s => s.trim()).filter(Boolean) : [],
                storyline: form.storyline || 'sub'
            };
            await knowledgeApi.createTimelineEvent(projectId, data);
            setShowForm(false);
            setForm(INITIAL_FORM);
            onRefresh();
        } catch (err) {
            alert('创建失败: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDelete = async (eventId) => {
        if (!window.confirm('确定删除此事件？')) return;
        try {
            await knowledgeApi.deleteTimelineEvent(projectId, eventId);
            onRefresh();
        } catch (err) {
            alert('删除失败: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div>
            <TimelineToolbar showForm={showForm} setShowForm={setShowForm} filter={filter} setFilter={setFilter} onRefresh={onRefresh} stats={stats} sortedChapters={sortedChapters} />
            {showForm && <TimelineForm form={form} setForm={setForm} onSubmit={handleSave} onCancel={() => setShowForm(false)} />}
            {filtered.length === 0 ? (
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon">⏣</div>
                    <div>暂无时间轴事件</div>
                </div>
            ) : (
                <TimelineEventList sortedChapters={sortedChapters} grouped={grouped} onDelete={handleDelete} />
            )}
        </div>
    );
}
