import { useState, useRef, useCallback } from 'react';
import useAppStore from '../../store/useAppStore';
import { workshopApi, materialsApi, chaptersApi } from '../../services/api';
import { INITIAL_IMPORT_STATE, INITIAL_FUSION_STATE, INITIAL_TEMPLATE_STATE, buildErrorMessage } from './constants';
import logger from '../../shared/logger';

function useWorkshopImport(currentProject, importState, refreshData) {
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState('');
    const [result, setResult] = useState(null);

    const handleImportText = useCallback(async () => {
        if (!currentProject) { alert('请先选择项目'); return; }
        if (!importState.settingText.trim()) { alert('请输入世界观设定文本'); return; }
        setLoading(true);
        setResult(null);
        try {
            if (importState.generateMaterials && importState.generateOutlines) {
                setLoadingStep('正在生成素材库和大纲...');
                const res = await workshopApi.importSettingText({
                    projectId: currentProject.id, settingText: importState.settingText,
                    generateMaterials: true, generateOutlines: true, chapterCount: importState.chapterCount
                });
                setResult(res.data);
            } else if (importState.generateMaterials) {
                setLoadingStep('正在生成素材库...');
                const res = await workshopApi.generateMaterials({
                    projectId: currentProject.id, settingText: importState.settingText
                });
                setResult({ materials: res.data });
            } else if (importState.generateOutlines) {
                setLoadingStep('正在生成章节大纲...');
                const res = await workshopApi.generateOutlines({
                    projectId: currentProject.id, settingText: importState.settingText,
                    chapterCount: importState.chapterCount
                });
                setResult({ outlines: res.data });
            }
            await refreshData();
        } catch (e) {
            setResult({ error: buildErrorMessage(e, 'AI请求超时，请尝试：1) 缩短设定文本 2) 只勾选"生成素材库"单独生成 3) 稍后重试') });
        } finally { setLoading(false); setLoadingStep(''); }
    }, [currentProject, importState, refreshData]);

    const handleImportFiles = useCallback(async () => {
        if (!currentProject) { alert('请先选择项目'); return; }
        if (importState.files.length === 0 && !importState.settingText.trim()) { alert('请上传文件或输入文本'); return; }
        setLoading(true); setResult(null); setLoadingStep('正在处理文件并生成...');
        try {
            const formData = new FormData();
            formData.append('projectId', currentProject.id);
            formData.append('generateMaterials', importState.generateMaterials);
            formData.append('generateOutlines', importState.generateOutlines);
            formData.append('chapterCount', importState.chapterCount);
            if (importState.settingText.trim()) formData.append('settingText', importState.settingText);
            for (const file of importState.files) formData.append('files', file);
            const res = await workshopApi.importSettingFiles(formData);
            setResult(res.data);
            await refreshData();
        } catch (e) {
            setResult({ error: buildErrorMessage(e, 'AI请求超时，请尝试缩短设定文本或分步生成') });
        } finally { setLoading(false); setLoadingStep(''); }
    }, [currentProject, importState, refreshData]);

    return { loading, setLoading, loadingStep, result, setResult, handleImportText, handleImportFiles };
}

export default function useWorkshopState() {
    const { currentProject, setMaterials, setChapters } = useAppStore();
    const [activeTab, setActiveTab] = useState('import');
    const [importState, setImportState] = useState(INITIAL_IMPORT_STATE);
    const [fusionState, setFusionState] = useState(INITIAL_FUSION_STATE);
    const [templateState, setTemplateState] = useState(INITIAL_TEMPLATE_STATE);
    const templateFileRef = useRef(null);

    const refreshData = useCallback(async () => {
        if (!currentProject) return;
        try {
            const matRes = await materialsApi.list({ projectId: currentProject.id });
            setMaterials(matRes.data || []);
            const chRes = await chaptersApi.list({ projectId: currentProject.id });
            setChapters(chRes.data || []);
        } catch (e) {
            logger.error('Workshop', 'Refresh data error:', e.message);
        }
    }, [currentProject, setMaterials, setChapters]);

    const imp = useWorkshopImport(currentProject, importState, refreshData);

    const handleFuseText = useCallback(async () => {
        const validNovels = fusionState.novels.filter(n => n.trim());
        if (validNovels.length < 2) { alert('请至少输入2本小说文本'); return; }
        imp.setLoading(true); imp.setResult(null); imp.setLoadingStep('正在分析小说...');
        try {
            const res = await workshopApi.fuseNovelsText({
                novels: validNovels, extractTechniques: fusionState.extractTechniques,
                extractElements: fusionState.extractElements, fusionAnalysis: fusionState.fusionAnalysis
            });
            imp.setResult(res.data);
        } catch (e) {
            imp.setResult({ error: buildErrorMessage(e, 'AI请求超时，请尝试：1) 减少小说文本长度 2) 只勾选一项分析 3) 稍后重试') });
        } finally { imp.setLoading(false); imp.setLoadingStep(''); }
    }, [fusionState, imp]);

    const handleFuseFiles = useCallback(async () => {
        if (fusionState.files.length < 2) { alert('请至少上传2个小说文件'); return; }
        imp.setLoading(true); imp.setResult(null); imp.setLoadingStep('正在处理文件并分析...');
        try {
            const formData = new FormData();
            formData.append('extractTechniques', fusionState.extractTechniques);
            formData.append('extractElements', fusionState.extractElements);
            formData.append('fusionAnalysis', fusionState.fusionAnalysis);
            for (const file of fusionState.files) formData.append('files', file);
            const res = await workshopApi.fuseNovelsFiles(formData);
            imp.setResult(res.data);
        } catch (e) {
            imp.setResult({ error: buildErrorMessage(e, e.message) });
        } finally { imp.setLoading(false); imp.setLoadingStep(''); }
    }, [fusionState, imp]);

    const addFusionNovel = useCallback(() => {
        setFusionState(prev => ({ ...prev, novels: [...prev.novels, ''] }));
    }, []);

    const removeFusionNovel = useCallback((index) => {
        setFusionState(prev => ({ ...prev, novels: prev.novels.filter((_, i) => i !== index) }));
    }, []);

    const updateFusionNovel = useCallback((index, value) => {
        setFusionState(prev => ({ ...prev, novels: prev.novels.map((n, i) => i === index ? value : n) }));
    }, []);

    const handleTemplateImport = useCallback(async () => {
        imp.setLoading(true);
        try {
            const res = await workshopApi.importTemplate(
                templateState.validationResult.template, { overwrite: templateState.overwrite }
            );
            setTemplateState(prev => ({ ...prev, importResult: res.data }));
            await refreshData();
        } catch (err) {
            setTemplateState(prev => ({ ...prev, importResult: { errors: [err.response?.data?.error || err.message] } }));
        } finally { imp.setLoading(false); }
    }, [templateState.validationResult, templateState.overwrite, refreshData, imp]);

    const handleTemplateValidate = useCallback(async (file) => {
        if (!file) return;
        try {
            const text = await file.text();
            const template = JSON.parse(text);
            const res = await workshopApi.validateTemplate(template);
            setTemplateState(prev => ({ ...prev, validationResult: { ...res.data, template }, importResult: null }));
        } catch (err) {
            setTemplateState(prev => ({
                ...prev,
                validationResult: { valid: false, errors: ['JSON解析失败: ' + err.message], warnings: [], summary: {} },
                importResult: null
            }));
        }
    }, []);

    const handleExportTemplate = useCallback(async () => {
        if (!currentProject) return;
        imp.setLoading(true);
        try {
            const res = await workshopApi.exportTemplate(currentProject.id);
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${currentProject.name || 'template'}_template.json`;
            a.click(); URL.revokeObjectURL(url);
        } catch (err) {
            alert('导出失败: ' + (err.response?.data?.error || err.message));
        } finally { imp.setLoading(false); }
    }, [currentProject, imp]);

    const switchTab = useCallback((tab) => { setActiveTab(tab); imp.setResult(null); }, [imp]);

    return {
        activeTab, switchTab, loading: imp.loading, loadingStep: imp.loadingStep, result: imp.result, setResult: imp.setResult,
        importState, setImportState, fusionState, setFusionState,
        templateState, setTemplateState, templateFileRef, currentProject,
        handleImportText: imp.handleImportText, handleImportFiles: imp.handleImportFiles,
        handleFuseText, handleFuseFiles,
        addFusionNovel, removeFusionNovel, updateFusionNovel,
        handleTemplateImport, handleTemplateValidate, handleExportTemplate
    };
}
