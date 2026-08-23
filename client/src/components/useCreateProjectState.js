import { useState, useRef, useEffect } from 'react';
import logger from '../shared/logger';
import useAppStore from '../store/useAppStore';
import { projectsApi, pipelineApi, materialsApi, chaptersApi, styleTemplateApi, promptConfigApi, flavorsApi } from '../services/api';
import { ELEMENT_PRESETS, NOVEL_DEFAULT_CONSTRAINTS } from './createProjectConstants';

/* eslint-disable max-lines-per-function */

const POLL_INTERVAL = 3000;
const MAX_POLL_TIME = 600000;

export default function useCreateProjectState({ onClose, onCreated }) {
    const { setProjects, setMaterials, setChapters } = useAppStore();
    const [mode, setMode] = useState('template');
    const [projectMode, setProjectMode] = useState('novel');
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [selectedElements, setSelectedElements] = useState([]);
    const [selectedConstraints, setSelectedConstraints] = useState(NOVEL_DEFAULT_CONSTRAINTS);
    const [form, setForm] = useState({
        name: '', genre: '', elements: '', targetChapters: 100, targetWords: '',
        style: '', tone: '', pov: '', setting: '', conflict: '', themes: '',
        description: '', styleTemplateId: '', subGenre: '', season: null,
        parentProjectId: null, settings: { autoPipeline: false, chapterRounds: 3 }
    });
    const [styleTemplates, setStyleTemplates] = useState([]);
    const [constraintPresets, setConstraintPresets] = useState([]);
    const [namingStyles, setNamingStyles] = useState([]);
    const [inferredNaming, setInferredNaming] = useState(null);
    const [selectedNamingStyle, setSelectedNamingStyle] = useState('');
    const [genreFullConfig, setGenreFullConfig] = useState(null);
    const mountedRef = useRef(true);

    useEffect(() => { return () => { mountedRef.current = false; }; }, []);
    const isShuangwen = false; // 爽文/番茄模式已移除，统一长篇模式

    useEffect(() => {
        styleTemplateApi.listTemplates().then(res => setStyleTemplates(res.data || [])).catch(() => {});
        promptConfigApi.listConstraintPresets().then(res => setConstraintPresets(res.data || [])).catch(() => {});
        flavorsApi.getNamingStyles().then(res => setNamingStyles(res.data || [])).catch(() => {});
    }, []);

    const handleGenreSelect = (genre) => {
        setForm(f => ({ ...f, genre }));
        setSelectedElements([]);
        setSelectedNamingStyle('');
        setGenreFullConfig(null);
        if (genre) {
            flavorsApi.inferNamingStyle(genre).then(res => setInferredNaming(res.data?.inferred || null)).catch(() => setInferredNaming(null));
            flavorsApi.resolveGenreProfile(genre).then(res => {
                const cfg = res.data?.fullConfig;
                if (cfg) {
                    setGenreFullConfig(cfg);
                    if (cfg.styleHints?.style) setForm(f => ({ ...f, style: f.style || cfg.styleHints.style }));
                    if (cfg.styleHints?.tone) setForm(f => ({ ...f, tone: f.tone || cfg.styleHints.tone }));
                    if (cfg.styleHints?.pov) setForm(f => ({ ...f, pov: f.pov || cfg.styleHints.pov }));
                    if (cfg.defaultMode) setProjectMode(cfg.defaultMode);
                    if (cfg.wordConfig) setForm(f => ({ ...f, targetWords: f.targetWords || String(cfg.wordConfig.targetWords) }));
                }
            }).catch(() => setGenreFullConfig(null));
        } else { setInferredNaming(null); }
    };

    const handleCustomGenreInput = (value) => {
        setForm(f => ({ ...f, genre: value }));
        if (value) {
            flavorsApi.inferNamingStyle(value).then(res => setInferredNaming(res.data?.inferred || null)).catch(() => setInferredNaming(null));
        } else { setInferredNaming(null); }
    };

    const toggleElement = (element) => {
        setSelectedElements(prev => {
            const next = prev.includes(element) ? prev.filter(e => e !== element) : prev.length >= 5 ? prev : [...prev, element];
            setForm(f => ({ ...f, elements: next.join('、') }));
            return next;
        });
    };

    const toggleConstraint = (id) => setSelectedConstraints(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

    const handleProjectModeChange = (_newMode) => {
        setProjectMode('novel');
        setSelectedConstraints(NOVEL_DEFAULT_CONSTRAINTS);
    };

    const loadProjectData = async (projectId) => {
        setProgress('生成完成，加载数据...');
        const projRes = await projectsApi.list();
        setProjects(projRes.data);
        try { setMaterials((await materialsApi.list({ projectId })).data || []); } catch { /* materials optional */ }
        try { setChapters((await chaptersApi.list({ projectId })).data || []); } catch { /* chapters optional */ }
        const project = projRes.data?.find(p => p.id === projectId);
        if (project) onCreated?.(project);
    };

    const pollTask = async (taskId, progressPrefix) => {
        const pollStart = Date.now();
        let projectId = null;
        while (true) {
            if (!mountedRef.current || Date.now() - pollStart > MAX_POLL_TIME) {
                if (Date.now() - pollStart > MAX_POLL_TIME) alert('生成超时(10分钟)，请稍后在项目列表中查看');
                break;
            }
            await new Promise(r => setTimeout(r, POLL_INTERVAL));
            if (!mountedRef.current) break;
            const task = (await pipelineApi.getTaskStatus(taskId)).data;
            if (task.status === 'completed') { projectId = task.result?.projectId; break; }
            if (task.status === 'failed') {
                alert('生成失败: ' + (task.error || task.result?.error || '未知错误'));
                setLoading(false); setProgress(''); return null;
            }
            const elapsed = Math.round((Date.now() - task.startedAt) / 1000);
            setProgress(`${progressPrefix} 已用时${elapsed}秒`);
        }
        return projectId;
    };

    const handleShuangwenOneClick = async (params) => {
        setProgress('⚡ 搜索热梗 + AI构思爽文设定...');
        const res = await pipelineApi.shuangwenOneClick(params);
        const taskId = res.data?.taskId;
        if (!taskId) { alert('启动爽文一键成型任务失败'); setLoading(false); return null; }
        const projectId = await pollTask(taskId, '⚡ AI正在生成中...');
        if (projectId) await loadProjectData(projectId);
        return projectId;
    };

    const handleTemplateGenerate = async (templateParams) => {
        setProgress('AI正在构思世界观、人物、任务、时间线和大纲...');
        const res = await pipelineApi.generateFromTemplate(templateParams);
        const taskId = res.data?.taskId;
        if (!taskId) { alert('启动生成任务失败'); setLoading(false); return null; }
        const projectId = await pollTask(taskId, 'AI正在生成中...');
        if (projectId) await loadProjectData(projectId);
        return projectId;
    };

    const getNamingStyleValue = () => selectedNamingStyle || (inferredNaming?.id || '') || (genreFullConfig?.namingStyle || '');
    const getGenreProfileValue = () => form.subGenre || genreFullConfig?.genreProfile || '';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setLoading(true);
        try {
            const ns = getNamingStyleValue();
            const gp = getGenreProfileValue();
            const base = { name: form.name, genre: form.genre, elements: form.elements, targetChapters: form.targetChapters, style: form.style, tone: form.tone, pov: form.pov, setting: form.setting, conflict: form.conflict, themes: form.themes, styleTemplateId: form.styleTemplateId, constraints: selectedConstraints, namingStyle: ns, worldviewTemplate: genreFullConfig?.worldviewTemplate || '', systemPersona: genreFullConfig?.defaultSystemPersona || '', genreProfile: gp, subGenre: form.subGenre || undefined, season: form.season || undefined, parentProjectId: form.parentProjectId || undefined };
            if (mode === 'template' && isShuangwen) {
                await handleShuangwenOneClick(base);
            } else if (mode === 'template') {
                await handleTemplateGenerate({ ...base, targetWords: form.targetWords, mode: projectMode });
            } else if (form.autoSupplement && form.genre) {
                await handleTemplateGenerate({ ...base, tone: form.tone || '', pov: form.pov || '', setting: form.description || '', conflict: '', themes: '', mode: projectMode });
            } else {
                const res = await projectsApi.create({ name: form.name, description: form.description, genre: form.genre, mode: projectMode, subGenre: form.subGenre || undefined, season: form.season || undefined, parentProjectId: form.parentProjectId || undefined, targetChapters: form.targetChapters, styleTemplateId: form.styleTemplateId, constraints: selectedConstraints, settings: form.settings, styleProfile: { namingStyle: ns, namingStyleIntensity: genreFullConfig?.namingStyleIntensity || 'medium', worldviewTemplate: genreFullConfig?.worldviewTemplate || '', systemPersona: genreFullConfig?.defaultSystemPersona || '', genreProfile: gp, reviewFocus: genreFullConfig?.reviewFocus?.join('；') || '', materialFocus: genreFullConfig?.materialFocus?.join('、') || '', constraintOverrides: genreFullConfig?.constraintOverrides || [] }, wordConfig: genreFullConfig?.wordConfig || undefined });
                const listRes = await projectsApi.list();
                setProjects(listRes.data);
                onCreated?.(res.data);
            }
            onClose();
        } catch (err) {
            logger.error('useCreateProjectState', 'Create project error:', err.message);
            alert('创建失败: ' + (err.response?.data?.error || err.message));
        } finally { setLoading(false); setProgress(''); }
    };

    const currentElementPresets = ELEMENT_PRESETS[form.genre] || [];

    return {
        mode, setMode, projectMode, loading, progress, selectedElements, setSelectedElements, selectedConstraints, setSelectedConstraints,
        form, setForm, styleTemplates, constraintPresets, namingStyles, inferredNaming,
        selectedNamingStyle, setSelectedNamingStyle, genreFullConfig, isShuangwen,
        currentElementPresets, handleGenreSelect, handleCustomGenreInput, toggleElement,
        toggleConstraint, handleProjectModeChange, handleSubmit
    };
}
