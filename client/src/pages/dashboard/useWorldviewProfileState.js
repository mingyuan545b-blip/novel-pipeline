import { useState, useCallback, useEffect } from 'react';
import { worldviewProfileApi } from '../../services/api';

export default function useWorldviewProfileState({ currentProject, setProjects, showError }) {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveForm, setSaveForm] = useState({ name: '', description: '' });
    const [saving, setSaving] = useState(false);
    const [applyingId, setApplyingId] = useState(null);

    const loadProfiles = useCallback(async () => {
        setLoading(true);
        try {
            const res = await worldviewProfileApi.list();
            setProfiles(res.data || []);
        } catch {
            showError('加载世界观模板失败');
        } finally { setLoading(false); }
    }, [showError]);

    useEffect(() => { loadProfiles(); }, [loadProfiles]);

    const saveFromProject = useCallback(async () => {
        if (!currentProject) return;
        setSaving(true);
        try {
            await worldviewProfileApi.saveFromProject(currentProject.id, {
                name: saveForm.name || currentProject.name,
                description: saveForm.description || `从项目 ${currentProject.name} 提取`
            });
            setShowSaveModal(false);
            setSaveForm({ name: '', description: '' });
            await loadProfiles();
        } catch (e) {
            showError('保存世界观模板失败: ' + (e.message || ''));
        } finally { setSaving(false); }
    }, [currentProject, saveForm, showError, loadProfiles]);

    const applyToProject = useCallback(async (profileId) => {
        if (!currentProject) return;
        setApplyingId(profileId);
        try {
            await worldviewProfileApi.apply(profileId, currentProject.id);
            const projRes = await worldviewProfileApi.list();
            setProfiles(projRes.data || []);
            if (setProjects) {
                const projectsRes = await (await import('../../services/api')).projectsApi.list();
                setProjects(projectsRes.data || []);
            }
        } catch (e) {
            showError('应用世界观模板失败: ' + (e.message || ''));
        } finally { setApplyingId(null); }
    }, [currentProject, setProjects, showError]);

    const deleteProfile = useCallback(async (profileId) => {
        try {
            await worldviewProfileApi.delete(profileId);
            await loadProfiles();
        } catch (e) {
            showError('删除模板失败: ' + (e.message || ''));
        }
    }, [showError, loadProfiles]);

    return {
        profiles, loading, showSaveModal, setShowSaveModal, saveForm, setSaveForm,
        saving, applyingId, saveFromProject, applyToProject, deleteProfile, loadProfiles
    };
}
