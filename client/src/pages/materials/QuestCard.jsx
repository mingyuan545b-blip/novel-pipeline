import { QUEST_STATUS_LABELS, QUEST_STATUS_COLORS, QUEST_STATUS_BADGE, QUEST_PRIORITY_LABELS, QUEST_PRIORITY_COLORS } from './materialConstants';
import { questApi } from '../../services/api';

export function QuestCard({ quest, children, isExpanded, toggleQuestExpand, setEditingQuest, setQuestForm, setShowQuestForm, loadQuests, deleteQuest }) {
    return (
        <div className="cyber-card quest-card" style={{
            borderLeft: `4px solid ${QUEST_STATUS_COLORS[quest.status] || 'var(--neon-blue)'}`,
            opacity: quest.status === 'abandoned' ? 0.6 : 1
        }}>
            <div className="quest-card-header">
                <div className="quest-card-title">
                    <div className="quest-card-title-row">
                        {children.length > 0 && (
                            <button className="cyber-btn cyber-btn-sm quest-expand-btn" onClick={() => toggleQuestExpand(quest.id)}>
                                {isExpanded ? '▼' : '▶'} {children.length}
                            </button>
                        )}
                        <h4 className="quest-title">{quest.title}</h4>
                        <span className={`cyber-badge ${QUEST_STATUS_BADGE[quest.status] || 'cyber-badge-blue'}`}>
                            {QUEST_STATUS_LABELS[quest.status] || quest.status}
                        </span>
                        {quest.priority !== 'normal' && (
                            <span className="cyber-badge quest-priority-badge" style={{
                                background: 'rgba(255,170,0,0.1)',
                                color: QUEST_PRIORITY_COLORS[quest.priority],
                                border: `1px solid ${QUEST_PRIORITY_COLORS[quest.priority]}40`
                            }}>
                                {QUEST_PRIORITY_LABELS[quest.priority] || quest.priority}
                            </span>
                        )}
                    </div>
                    {quest.description && (
                        <div className="quest-description">{quest.description.length > 200 ? quest.description.substring(0, 200) + '...' : quest.description}</div>
                    )}
                </div>
                <QuestActions quest={quest} setEditingQuest={setEditingQuest} setQuestForm={setQuestForm} setShowQuestForm={setShowQuestForm} loadQuests={loadQuests} deleteQuest={deleteQuest} />
            </div>
            <QuestProgress quest={quest} />
            {quest.tags?.length > 0 && (
                <div className="quest-tags">{quest.tags.map((tag, i) => <span key={i} className="cyber-tag">{tag}</span>)}</div>
            )}
        </div>
    );
}

export function SubQuestCard({ sub, setEditingQuest, setQuestForm, setShowQuestForm, loadQuests, deleteQuest }) {
    return (
        <div className="cyber-card sub-quest-card" style={{
            borderLeft: `3px solid ${QUEST_STATUS_COLORS[sub.status] || 'var(--neon-blue)'}`,
            opacity: sub.status === 'abandoned' ? 0.6 : 1
        }}>
            <div className="sub-quest-header">
                <div className="sub-quest-title-row">
                    <span className="sub-quest-prefix">└</span>
                    <h5 className="sub-quest-title">{sub.title}</h5>
                    <span className={`cyber-badge ${QUEST_STATUS_BADGE[sub.status] || 'cyber-badge-blue'} sub-quest-badge`}>
                        {QUEST_STATUS_LABELS[sub.status] || sub.status}
                    </span>
                    {sub.priority !== 'normal' && (
                        <span className="sub-quest-priority" style={{ color: QUEST_PRIORITY_COLORS[sub.priority] }}>
                            [{QUEST_PRIORITY_LABELS[sub.priority]}]
                        </span>
                    )}
                </div>
                <SubQuestActions sub={sub} setEditingQuest={setEditingQuest} setQuestForm={setQuestForm} setShowQuestForm={setShowQuestForm} loadQuests={loadQuests} deleteQuest={deleteQuest} />
            </div>
            {sub.description && (
                <div className="sub-quest-description">{sub.description.length > 150 ? sub.description.substring(0, 150) + '...' : sub.description}</div>
            )}
            {sub.progress > 0 && sub.status !== 'completed' && (
                <div className="sub-quest-progress"><div className="cyber-progress"><div className="cyber-progress-bar" style={{ width: `${sub.progress}%` }} /></div></div>
            )}
        </div>
    );
}

function QuestActions({ quest, setEditingQuest, setQuestForm, setShowQuestForm, loadQuests, deleteQuest }) {
    return (
        <div className="quest-actions">
            {quest.status === 'planned' && (
                <button className="cyber-btn cyber-btn-sm quest-action-start" onClick={async () => { await questApi.updateQuest(quest.id, { status: 'active' }); loadQuests(); }}>开始</button>
            )}
            {quest.status === 'active' && (
                <button className="cyber-btn cyber-btn-sm quest-action-complete" onClick={async () => { await questApi.updateQuest(quest.id, { status: 'completed' }); loadQuests(); }}>完成</button>
            )}
            <button className="cyber-btn cyber-btn-sm" onClick={() => { setEditingQuest(quest.id); setQuestForm({ title: quest.title, description: quest.description || '', status: quest.status, priority: quest.priority, parentId: quest.parentId, notes: quest.notes || '', tags: quest.tags || [] }); setShowQuestForm(true); }}>编辑</button>
            <button className="cyber-btn cyber-btn-sm quest-action-sub" onClick={() => { setEditingQuest(null); setQuestForm({ title: '', description: '', status: 'planned', priority: 'normal', parentId: quest.id, notes: '', tags: [] }); setShowQuestForm(true); }}>+ 子任务</button>
            <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={() => deleteQuest(quest.id)}>删除</button>
        </div>
    );
}

function SubQuestActions({ sub, setEditingQuest, setQuestForm, setShowQuestForm, loadQuests, deleteQuest }) {
    return (
        <div className="sub-quest-actions">
            {sub.status === 'planned' && (
                <button className="cyber-btn cyber-btn-sm sub-action-start" onClick={async () => { await questApi.updateQuest(sub.id, { status: 'active' }); loadQuests(); }}>开始</button>
            )}
            {sub.status === 'active' && (
                <button className="cyber-btn cyber-btn-sm sub-action-complete" onClick={async () => { await questApi.updateQuest(sub.id, { status: 'completed' }); loadQuests(); }}>完成</button>
            )}
            <button className="cyber-btn cyber-btn-sm sub-action-edit" onClick={() => { setEditingQuest(sub.id); setQuestForm({ title: sub.title, description: sub.description || '', status: sub.status, priority: sub.priority, parentId: sub.parentId, notes: sub.notes || '', tags: sub.tags || [] }); setShowQuestForm(true); }}>编辑</button>
            <button className="cyber-btn cyber-btn-danger cyber-btn-sm sub-action-delete" onClick={() => deleteQuest(sub.id)}>删除</button>
        </div>
    );
}

function QuestProgress({ quest }) {
    if (quest.progress <= 0 || quest.status === 'completed') {
        if (quest.status === 'completed' && quest.completedAt) {
            return <div className="quest-completed-at">✅ 完成于 {new Date(quest.completedAt).toLocaleString('zh-CN')}</div>;
        }
        return null;
    }
    return (
        <div className="quest-progress-section">
            <div className="quest-progress-label"><span>进度</span><span>{quest.progress}%</span></div>
            <div className="cyber-progress"><div className="cyber-progress-bar" style={{ width: `${quest.progress}%` }} /></div>
        </div>
    );
}
