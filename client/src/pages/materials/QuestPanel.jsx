import { useState } from 'react';
import { QUEST_STATUS_LABELS } from './materialConstants';
import { questApi } from '../../services/api';
import logger from '../../shared/logger';
import { QuestCard, SubQuestCard } from './QuestCard';

const INITIAL_QUEST_FORM = { title: '', description: '', status: 'planned', priority: 'normal', parentId: null, notes: '', tags: [] };

export default function QuestPanel({
    quests, questStatusFilter, setQuestStatusFilter, currentProject,
    showQuestForm: _showQuestForm, setShowQuestForm, editingQuest: _editingQuest, setEditingQuest,
    questForm: _questForm, setQuestForm, expandedQuests, toggleQuestExpand,
    loadQuests, saveQuest: _saveQuest, deleteQuest
}) {
    const rootQuests = quests.filter(q => !q.parentId);
    const [autoIniting, setAutoIniting] = useState(false);

    // 修复陷阱#59/#60：空数据时提供"自动初始化"入口
    // autoInitProject会创建长期主线+阶段任务+支线+时间线
    const handleAutoInit = async () => {
        if (!currentProject?.id || autoIniting) return;
        setAutoIniting(true);
        try {
            await questApi.autoInit(currentProject.id);
            await loadQuests();
        } catch (err) {
            logger.error('Quest', '自动初始化主线任务失败:', err.message);
        } finally {
            setAutoIniting(false);
        }
    };

    return (
        <>
            <div className="quest-panel-toolbar">
                <button className="cyber-btn cyber-btn-primary" onClick={() => {
                    setEditingQuest(null);
                    setQuestForm(INITIAL_QUEST_FORM);
                    setShowQuestForm(true);
                }}>+ 新建任务</button>
                <select className="cyber-select quest-filter-select" value={questStatusFilter} onChange={e => {
                    const v = e.target.value;
                    setQuestStatusFilter(v);
                    if (v === 'all') loadQuests();
                    else questApi.listQuests({ projectId: currentProject.id, status: v }).then(() => {}).catch(e => logger.error('Quest', 'Filter failed:', e.message));
                }}>
                    <option value="all">全部状态</option>
                    {Object.entries(QUEST_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <div className="quest-count-label">共 {quests.length} 个任务</div>
            </div>

            {rootQuests.length === 0 ? (
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon">⚔</div>
                    <div>暂无主线任务</div>
                    <button className="cyber-btn cyber-btn-primary" onClick={handleAutoInit} disabled={autoIniting}>
                        {autoIniting ? '初始化中...' : '⚡ 自动初始化主线任务'}
                    </button>
                </div>
            ) : (
                <div className="quest-list">
                    {rootQuests.map(quest => {
                        const children = quests.filter(q => q.parentId === quest.id);
                        const isExpanded = expandedQuests.has(quest.id);
                        return (
                            <div key={quest.id}>
                                <QuestCard quest={quest} children={children} isExpanded={isExpanded}
                                    toggleQuestExpand={toggleQuestExpand} setEditingQuest={setEditingQuest}
                                    setQuestForm={setQuestForm} setShowQuestForm={setShowQuestForm}
                                    loadQuests={loadQuests} deleteQuest={deleteQuest} />
                                {isExpanded && children.length > 0 && (
                                    <div className="sub-quest-list">
                                        {children.map(sub => (
                                            <SubQuestCard key={sub.id} sub={sub}
                                                setEditingQuest={setEditingQuest} setQuestForm={setQuestForm}
                                                setShowQuestForm={setShowQuestForm} loadQuests={loadQuests} deleteQuest={deleteQuest} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}
