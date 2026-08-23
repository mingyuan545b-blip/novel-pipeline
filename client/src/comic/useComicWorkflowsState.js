import { useState, useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import { comicApi } from '../services/api';

const INITIAL_WORKFLOW = {
    name: '', type: 'character', description: '',
    jsonContent: '', file: null, params: {}
};

export default function useComicWorkflowsState() {
    const { currentProject } = useAppStore();
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showUpload, setShowUpload] = useState(false);
    const [newWorkflow, setNewWorkflow] = useState({ ...INITIAL_WORKFLOW });

    useEffect(() => { loadWorkflows(); }, [currentProject]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadWorkflows = async () => {
        setLoading(true);
        try {
            const projectId = currentProject?.id || 'default';
            const res = await comicApi.getWorkflows(projectId);
            setWorkflows(res.data || []);
        } catch {
            setWorkflows([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWorkflow = async () => {
        if (!newWorkflow.name.trim()) { alert('请输入工作流名称'); return; }
        setLoading(true);
        try {
            const projectId = currentProject?.id || 'default';
            if (newWorkflow.file) {
                const formData = new FormData();
                formData.append('name', newWorkflow.name);
                formData.append('type', newWorkflow.type);
                formData.append('description', newWorkflow.description);
                formData.append('projectId', projectId);
                formData.append('file', newWorkflow.file);
                await comicApi.uploadWorkflow(formData);
            } else {
                await comicApi.createWorkflow({ ...newWorkflow, projectId });
            }
            setNewWorkflow({ ...INITIAL_WORKFLOW });
            setShowUpload(false);
            await loadWorkflows();
        } catch (e) {
            alert('创建失败: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteWorkflow = async (id) => {
        if (!confirm('确定删除此工作流？')) return;
        try {
            await comicApi.deleteWorkflow(id);
            await loadWorkflows();
        } catch (e) {
            alert('删除失败: ' + e.message);
        }
    };

    const handleImportJson = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target.result);
                setNewWorkflow(prev => ({ ...prev, jsonContent: JSON.stringify(json, null, 2) }));
            } catch {
                setNewWorkflow(prev => ({ ...prev, jsonContent: ev.target.result }));
            }
        };
        reader.readAsText(file);
    };

    return {
        currentProject, workflows, loading, editing, setEditing,
        showUpload, setShowUpload, newWorkflow, setNewWorkflow,
        handleCreateWorkflow, handleDeleteWorkflow, handleImportJson
    };
}
