import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../../store/useAppStore';
import { styleTemplateApi, projectsApi } from '../../services/api';
import logger from '../../shared/logger';

export const RULE_LABELS = {
    sentenceStyle: '句式风格', paragraphStyle: '段落风格', dialogueStyle: '对话风格',
    descriptionStyle: '描写风格', emotionStyle: '情感表达', pacing: '节奏控制', vocabulary: '词汇风格'
};

export const SOURCE_LABELS = {
    manual: '✏ 手动创建', analyze: '📥 AI分析', direct: '📄 直接导入',
    learn: '🧠 自动学习', default: '📋 系统预设'
};

const INITIAL_FORM = {
    name: '', description: '', tags: [],
    rules: {
        sentenceStyle: '', paragraphStyle: '', dialogueStyle: '',
        descriptionStyle: '', emotionStyle: '', pacing: '', vocabulary: '', forbidden: []
    },
    example: ''
};

export default function useStyleTemplatesState() {
    const { currentProject, setProjects } = useAppStore();
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [showAnalyze, setShowAnalyze] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [form, setForm] = useState(INITIAL_FORM);
    const [analyzeText, setAnalyzeText] = useState('');
    const [analyzeName, setAnalyzeName] = useState('');
    const [analyzeMode, setAnalyzeMode] = useState('ai');
    const [newForbidden, setNewForbidden] = useState('');
    const [newTag, setNewTag] = useState('');

    const loadTemplates = useCallback(async () => {
        try { const res = await styleTemplateApi.listTemplates(); setTemplates(res.data || []); }
        catch (e) { logger.error('StyleTemplates', 'Load templates failed:', e.message); }
    }, []);

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => { loadTemplates(); }, [loadTemplates]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setLoading(true);
        try {
            selectedTemplate
                ? await styleTemplateApi.updateTemplate(selectedTemplate.id, form)
                : await styleTemplateApi.createTemplate(form);
            setShowForm(false); setSelectedTemplate(null); loadTemplates();
        } catch (e) { alert('保存失败: ' + e.message); }
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (!confirm('确定删除此风格模板？')) return;
        try {
            await styleTemplateApi.deleteTemplate(id);
            if (selectedTemplate?.id === id) setSelectedTemplate(null);
            loadTemplates();
        } catch (e) { alert('删除失败: ' + (e.response?.data?.error || e.message)); }
    };

    const handleAnalyze = async () => {
        const minLen = analyzeMode === 'ai' ? 500 : 50;
        if (analyzeText.length < minLen) { alert(`文本至少需要${minLen}字`); return; }
        if (analyzeMode === 'direct' && !analyzeName.trim()) { alert('直接导入需要填写风格名称'); return; }
        setLoading(true);
        setProgress(analyzeMode === 'ai' ? 'AI正在分析写作风格...' : '正在导入文本...');
        try {
            analyzeMode === 'ai'
                ? await styleTemplateApi.analyze({ text: analyzeText, name: analyzeName })
                : await styleTemplateApi.importDirect({ text: analyzeText, name: analyzeName });
            setShowAnalyze(false); setAnalyzeText(''); setAnalyzeName(''); setAnalyzeMode('ai'); loadTemplates();
        } catch (e) { alert('操作失败: ' + (e.response?.data?.error || e.message)); }
        setLoading(false); setProgress('');
    };

    const handleLearnFromProject = async () => {
        if (!currentProject) { alert('请先选择项目'); return; }
        setLoading(true); setProgress('AI正在从已定稿章节中学习风格...');
        try { await styleTemplateApi.learnFromChapter({ projectId: currentProject.id }); loadTemplates(); }
        catch (e) { alert('学习失败: ' + (e.response?.data?.error || e.message)); }
        setLoading(false); setProgress('');
    };

    const handleApplyToProject = async (templateId) => {
        if (!currentProject) { alert('请先选择项目'); return; }
        try {
            await styleTemplateApi.applyToProject({ projectId: currentProject.id, templateId });
            const res = await projectsApi.list(); setProjects(res.data);
            alert('风格模板已应用到当前项目');
        } catch (e) { alert('应用失败: ' + e.message); }
    };

    const openEdit = (t) => {
        setSelectedTemplate(t);
        setForm({
            name: t.name, description: t.description || '', tags: t.tags || [],
            rules: {
                sentenceStyle: t.rules?.sentenceStyle || '', paragraphStyle: t.rules?.paragraphStyle || '',
                dialogueStyle: t.rules?.dialogueStyle || '', descriptionStyle: t.rules?.descriptionStyle || '',
                emotionStyle: t.rules?.emotionStyle || '', pacing: t.rules?.pacing || '',
                vocabulary: t.rules?.vocabulary || '', forbidden: t.rules?.forbidden || []
            },
            example: t.example || ''
        });
        setShowForm(true);
    };

    const openCreate = () => { setSelectedTemplate(null); setForm(INITIAL_FORM); setShowForm(true); };
    const addForbidden = () => {
        if (!newForbidden.trim()) return;
        setForm({ ...form, rules: { ...form.rules, forbidden: [...(form.rules.forbidden || []), newForbidden.trim()] } });
        setNewForbidden('');
    };
    const removeForbidden = (i) => setForm({ ...form, rules: { ...form.rules, forbidden: form.rules.forbidden.filter((_, j) => j !== i) } });
    const addTag = () => { if (!newTag.trim()) return; setForm({ ...form, tags: [...(form.tags || []), newTag.trim()] }); setNewTag(''); };
    const removeTag = (i) => setForm({ ...form, tags: form.tags.filter((_, j) => j !== i) });
    const closeForm = () => { setShowForm(false); setSelectedTemplate(null); };
    const closeAnalyze = () => setShowAnalyze(false);
    const currentStyleId = currentProject?.styleTemplateId;

    return {
        currentProject, templates, selectedTemplate, showForm, showAnalyze, setShowAnalyze, loading, progress,
        form, setForm, analyzeText, setAnalyzeText, analyzeName, setAnalyzeName,
        analyzeMode, setAnalyzeMode, newForbidden, setNewForbidden, newTag, setNewTag,
        currentStyleId, handleSave, handleDelete, handleAnalyze, handleLearnFromProject,
        handleApplyToProject, openEdit, openCreate, addForbidden, removeForbidden,
        addTag, removeTag, closeForm, closeAnalyze,
    };
}
