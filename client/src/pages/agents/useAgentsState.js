import { useState } from 'react';
import useAppStore from '../../store/useAppStore';
import { useAgentsList, useUpdateAgentPrompt, useAgentConstraints, useAgentProfiles } from '../../hooks/queries';
import { useProject, useUpdateProject } from '../../hooks/queries';
import { agentsApi, promptConfigApi } from '../../services/api';
import logger from '../../shared/logger';
import { useAgentTemplateState } from './useAgentTemplateState';

export default function useAgentsState() {
    const { currentProject } = useAppStore();
    const [activeTab, setActiveTab] = useState('agents');
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [editPrompt, setEditPrompt] = useState('');
    const [saving, setSaving] = useState(false);
    const [originalPrompt, setOriginalPrompt] = useState('');
    const [selectedConstraint, setSelectedConstraint] = useState(null);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [applying, setApplying] = useState(false);
    const [showResolvedPrompt, setShowResolvedPrompt] = useState(false);
    const [resolvedPrompt, setResolvedPrompt] = useState(null);
    const [resolvedPromptLoading, setResolvedPromptLoading] = useState(false);

    const mode = currentProject?.mode || 'novel';
    const projectId = currentProject?.id || '';
    const agentsQuery = useAgentsList(mode);
    const agents = agentsQuery.data || [];
    const constraintsQuery = useAgentConstraints();
    const constraints = constraintsQuery.data || [];
    const profilesQuery = useAgentProfiles();
    const profiles = profilesQuery.data || [];
    const updateAgentPrompt = useUpdateAgentPrompt();
    const projectQuery = useProject(projectId);
    const updateProject = useUpdateProject(projectId);

    const templateState = useAgentTemplateState();

    const hasChanges = editPrompt !== originalPrompt;

    const loadAgentDetail = async (type) => {
        try {
            const res = await agentsApi.get(type, { mode, projectId });
            const agent = res.data;
            if (!agent) { logger.warn('AgentsPage', 'loadAgentDetail: no data for', type); return; }
            setSelectedAgent(agent);
            const currentPrompt = agent.systemPrompt || agent.system || '';
            setEditPrompt(currentPrompt); setOriginalPrompt(currentPrompt);
        } catch (e) { logger.error('AgentsPage', 'loadAgentDetail failed:', e?.response?.status, e?.message); }
    };

    const savePrompt = async () => {
        if (!selectedAgent) return;
        setSaving(true);
        try {
            await updateAgentPrompt.mutateAsync({ type: selectedAgent.type, data: { systemPrompt: editPrompt, projectId: currentProject?.id || null } });
            setOriginalPrompt(editPrompt);
            alert(currentProject?.id ? '项目级Agent提示词已保存' : '全局Agent提示词已更新');
            loadAgentDetail(selectedAgent.type);
        } catch (e) {
            logger.error('AgentsPage', 'savePrompt failed:', e?.response?.status, e?.response?.data, e?.message);
            alert('保存失败: ' + (e?.response?.data?.error || e?.message || '未知错误'));
        } finally { setSaving(false); }
    };

    const resetPrompt = () => setEditPrompt(originalPrompt);

    const applyConstraintsToProject = async (constraintIds) => {
        if (!currentProject?.id) { alert('请先选择一个项目'); return; }
        setApplying(true);
        try {
            const project = projectQuery.data;
            const merged = [...new Set([...(project?.constraints || []), ...constraintIds])];
            await updateProject.mutateAsync({ constraints: merged, _invalidateList: true });
            alert(`已将 ${constraintIds.length} 个约束应用到项目（共 ${merged.length} 个）`);
        } catch (e) { alert('应用失败: ' + e.message); }
        finally { setApplying(false); }
    };

    const applyProfileToProject = async (profileKey) => {
        if (!currentProject?.id) { alert('请先选择一个项目'); return; }
        setApplying(true);
        try { await updateProject.mutateAsync({ styleProfile: profileKey, _invalidateList: true }); alert(`风格配置「${profileKey}」已应用到项目`); }
        catch (e) { alert('应用失败: ' + e.message); }
        finally { setApplying(false); }
    };

    const toggleResolvedPrompt = async () => {
        if (showResolvedPrompt) { setShowResolvedPrompt(false); return; }
        setResolvedPromptLoading(true); setShowResolvedPrompt(true);
        try { const res = await promptConfigApi.getResolvedPrompt({ agentType: selectedAgent.type, mode, projectId }); setResolvedPrompt(res.data || null); }
        catch (e) { logger.error('AgentsPage', 'Resolved prompt fetch error:', e.message); setResolvedPrompt({ error: true, message: e.message || '加载失败' }); }
        setResolvedPromptLoading(false);
    };

    return {
        currentProject, activeTab, setActiveTab, selectedAgent, editPrompt, setEditPrompt,
        saving, hasChanges, selectedConstraint, setSelectedConstraint,
        selectedProfile, setSelectedProfile, applying, showResolvedPrompt, resolvedPrompt,
        resolvedPromptLoading, agents, constraints, profiles, mode, projectId,
        loadAgentDetail, savePrompt, resetPrompt,
        applyConstraintsToProject, applyProfileToProject, toggleResolvedPrompt,
        ...templateState,
    };
}
