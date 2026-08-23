import { useState, useEffect, useCallback } from 'react';
import { questApi } from '../../services/api';
import logger from '../../shared/logger';

const INITIAL_QUEST_FORM = {
    title: '', description: '', status: 'planned',
    priority: 'normal', parentId: null, notes: '', tags: [],
};

export default function useQuestState(currentProject, activeTab) {
    const [quests, setQuests] = useState([]);
    const [questMeta, setQuestMeta] = useState(null);
    const [showQuestForm, setShowQuestForm] = useState(false);
    const [editingQuest, setEditingQuest] = useState(null);
    const [questForm, setQuestForm] = useState(INITIAL_QUEST_FORM);
    const [expandedQuests, setExpandedQuests] = useState(new Set());
    const [questStatusFilter, setQuestStatusFilter] = useState('all');

    const loadQuests = useCallback(() => {
        if (!currentProject) return;
        questApi.listQuests({ projectId: currentProject.id })
            .then(res => setQuests(res.data || []))
            .catch(e => logger.error('Quest', 'Load quests failed:', e.message));
    }, [currentProject]);

    useEffect(() => {
        if (!questMeta) questApi.getMeta().then(res => setQuestMeta(res.data)).catch(() => {});
    }, [questMeta]);

    useEffect(() => {
        if (activeTab === 'quests') loadQuests();
    }, [activeTab, loadQuests]);

    const saveQuest = async () => {
        if (!currentProject) return;
        try {
            const data = { ...questForm, projectId: currentProject.id };
            if (editingQuest) {
                await questApi.updateQuest(editingQuest, data);
            } else {
                await questApi.createQuest(data);
            }
            loadQuests();
            setShowQuestForm(false);
            setEditingQuest(null);
            setQuestForm(INITIAL_QUEST_FORM);
        } catch (e) {
            logger.error('Quest', 'Save quest error:', e.message);
        }
    };

    const deleteQuest = async (id) => {
        if (!confirm('确定删除此任务？')) return;
        try {
            await questApi.deleteQuest(id);
            loadQuests();
        } catch (e) {
            alert(e.response?.data?.error || e.message);
        }
    };

    const toggleQuestExpand = (id) => {
        setExpandedQuests(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const filterQuestsByStatus = (status) => {
        setQuestStatusFilter(status);
        if (status === 'all') {
            loadQuests();
        } else {
            questApi.listQuests({ projectId: currentProject.id, status })
                .then(res => setQuests(res.data || []))
                .catch(e => logger.error('Quest', 'Load quests failed:', e.message));
        }
    };

    return {
        quests, showQuestForm, setShowQuestForm,
        editingQuest, setEditingQuest, questForm, setQuestForm,
        expandedQuests, toggleQuestExpand,
        questStatusFilter, filterQuestsByStatus,
        loadQuests, saveQuest, deleteQuest, INITIAL_QUEST_FORM,
    };
}
