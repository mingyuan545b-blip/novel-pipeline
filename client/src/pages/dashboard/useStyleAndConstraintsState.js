import { useState, useCallback } from 'react';
import { projectsApi, styleTemplateApi, promptConfigApi } from '../../services/api';
import { useStyleCleanupState } from './useStyleCleanupState';

export default function useStyleAndConstraintsState({ currentProject, setProjects, showError }) {
    const [editingConstraints, setEditingConstraints] = useState(false);
    const [editConstraints, setEditConstraints] = useState([]);
    const [constraintPresets, setConstraintPresets] = useState([]);
    const [styleSuggestion, setStyleSuggestion] = useState('');
    const [analyzingStyle, setAnalyzingStyle] = useState(false);
    const [reviewText, setReviewText] = useState('');
    const [remediating, setRemediating] = useState(false);
    const [remediationResult, setRemediationResult] = useState(null);
    const [styleTemplate, setStyleTemplate] = useState(null);
    const [editingStyle, setEditingStyle] = useState(false);
    const [styleEditForm, setStyleEditForm] = useState({ rules: {}, example: '' });

    const cleanupState = useStyleCleanupState(setProjects, showError);

    const loadConstraintPresets = useCallback(() => {
        promptConfigApi.listConstraintPresets().then(res => setConstraintPresets(res.data || [])).catch(() => {});
    }, []);

    const loadStyleTemplate = useCallback(() => {
        if (currentProject?.styleTemplateId) {
            styleTemplateApi.getTemplate(currentProject.styleTemplateId)
                .then(res => setStyleTemplate(res.data))
                .catch(() => setStyleTemplate(null));
        } else { setStyleTemplate(null); }
    }, [currentProject?.styleTemplateId]);

    const startEditConstraints = useCallback(() => {
        setEditConstraints(currentProject?.constraints || []);
        setEditingConstraints(true);
    }, [currentProject]);

    const toggleEditConstraint = useCallback((id) => {
        setEditConstraints(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    }, []);

    const saveConstraints = useCallback(async () => {
        try {
            await projectsApi.update(currentProject.id, { constraints: editConstraints });
            setProjects(await projectsApi.list().then(r => r.data));
            setEditingConstraints(false);
        } catch { showError('保存约束失败', 3000); }
    }, [currentProject, editConstraints, setProjects, showError]);

    const startEditingStyle = useCallback(() => {
        setStyleEditForm({ rules: styleTemplate?.rules || {}, example: styleTemplate?.example || '' });
        setEditingStyle(true);
    }, [styleTemplate]);

    const saveStyleEdits = useCallback(async () => {
        try {
            if (styleTemplate?.id) {
                await styleTemplateApi.updateTemplate(styleTemplate.id, styleEditForm);
                const res = await styleTemplateApi.getTemplate(styleTemplate.id);
                setStyleTemplate(res.data);
            } else if (currentProject) {
                const newStyle = { ...styleEditForm, name: currentProject.name + '风格', projectId: currentProject.id };
                const createRes = await styleTemplateApi.createTemplate(newStyle);
                await projectsApi.update(currentProject.id, { styleTemplateId: createRes.data.id });
                setStyleTemplate(createRes.data);
            }
            setEditingStyle(false);
        } catch { showError('保存风格失败', 3000); }
    }, [styleTemplate, styleEditForm, currentProject, showError]);

    const handleRemediate = useCallback(async () => {
        if (!currentProject || !reviewText.trim()) return;
        setRemediating(true); setRemediationResult(null);
        try {
            const res = await projectsApi.remediate(currentProject.id, reviewText);
            setRemediationResult(res.data);
            const projRes = await projectsApi.list();
            setProjects(projRes.data);
        } catch (e) { alert('整改失败: ' + e.message); }
        finally { setRemediating(false); }
    }, [currentProject, reviewText, setProjects]);

    const handleAnalyzeStyle = useCallback(async () => {
        if (!currentProject) return;
        setAnalyzingStyle(true);
        try {
            const res = await projectsApi.analyzeStyle(currentProject.id, styleSuggestion);
            if (res.data?.success) {
                const projRes = await projectsApi.list();
                setProjects(projRes.data);
                setStyleSuggestion('');
            } else { alert('分析失败: ' + (res.data?.error || '未知错误')); }
        } catch (e) { alert('分析失败: ' + e.message); }
        finally { setAnalyzingStyle(false); }
    }, [currentProject, styleSuggestion, setProjects]);

    const handleClearStyleGuidance = useCallback(async () => {
        if (!confirm('确定清除风格指导？')) return;
        await projectsApi.updateStyleGuidance(currentProject.id, '');
        const projRes = await projectsApi.list();
        setProjects(projRes.data);
    }, [currentProject, setProjects]);

    const projectConstraints = (currentProject?.constraints || []).map(id => constraintPresets.find(c => c.id === id)).filter(Boolean);

    return {
        editingConstraints, editConstraints, constraintPresets, projectConstraints,
        startEditConstraints, toggleEditConstraint, saveConstraints,
        styleSuggestion, setStyleSuggestion, analyzingStyle, handleAnalyzeStyle,
        handleClearStyleGuidance,
        reviewText, setReviewText, remediating, remediationResult, handleRemediate,
        styleTemplate, editingStyle, styleEditForm, setStyleEditForm,
        startEditingStyle, saveStyleEdits,
        ...cleanupState,
        loadConstraintPresets, loadStyleTemplate
    };
}
