import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import useAppStore from '../../store/useAppStore';
import logger from '../../shared/logger';
import {
    useChapters, usePipelineStatus, useStartPipeline, useStopPipeline,
    useResetPipeline, useMaterials, useSupplementOutlines, useRerunMaterialManager,
    useToggleMaterialLock, useSetVolumeSubplane, useGenerateSubplaneMaterials,
    useClearChaptersAfter, useResetChapterContent,
    useResetChaptersBulk, useSaveProjectTargets, useSyncHookBudget, useExtractRuleStack, useRegisterHook,
} from '../../hooks/queries';
import { pipelineApi, genreDebugApi } from '../../services/api';
import { PIPELINE_STEPS, OUTPUT_TABS, buildPipelineSteps, buildOutputTabs } from './pipelineConstants';
import { useInfinitePipeline } from './useInfinitePipeline';
import { useAuditState } from './useAuditState';
import { useToolsState } from './useToolsState';
import { useAgentConfigState } from './useAgentConfigState';
import { useOutputState } from './useOutputState';
import { useFullPipelineHandler } from './useFullPipelineHandler';

const mapInfiniteLogs = (logs) => logs.map(e => ({
    step: e.step,
    status: e.passed ? 'done' : (e.passed === false ? 'error' : 'running'),
    result: e.passed !== undefined ? { passed: e.passed, feedback: e.feedback } : undefined,
    error: e.error, timestamp: e.time || e.timestamp, round: e.round,
    chapterNumber: e.chapterNumber, msg: e.msg, affectedChapter: e.affectedChapter,
}));

export default function usePipelinePageState() {
    const [searchParams] = useSearchParams();
    const { currentProject, chapters, pipelineState, setPipelineState, addPipelineLog, clearPipelineLogs } = useAppStore();
    const chaptersQuery = useChapters(currentProject?.id);
    const chaptersData = chaptersQuery.data || chapters;
    useMaterials({ projectId: currentProject?.id });
    const projectMode = currentProject?.mode || 'novel';
    const pipelineConfig = currentProject?.pipelineConfig || null;
    const pipelineSteps = buildPipelineSteps(pipelineConfig);
    const outputTabs = buildOutputTabs(pipelineConfig);

    const [selectedChapter, setSelectedChapter] = useState(null);
    const maxRounds = useMemo(() => (projectMode === 'shuangwen' || projectMode === 'tomato-short' ? 2 : 3), [projectMode]);
    const { data: pipelineStatusData } = usePipelineStatus(currentProject?.id, { refetchInterval: 5000 });

    const { infiniteStatus, infiniteOptions, setInfiniteOptions, startInfinitePipeline, stopInfinitePipeline, forceResetPipeline } =
        useInfinitePipeline(currentProject, selectedChapter, () => chaptersQuery.refetch(), setSelectedChapter, setPipelineState);

    const genreId = currentProject?.styleProfile?.genreId || currentProject?.genre || null;
    const { data: genreConstraintsData } = useQuery({
        queryKey: ['genre-constraints', genreId],
        queryFn: () => genreDebugApi.getConstraints(genreId).then(r => r.data?.data || r.data),
        enabled: !!genreId, staleTime: 30000,
    });
    const genreConstraints = genreConstraintsData?.constraints || [], genreStyleProfile = genreConstraintsData?.styleProfile || {};

    const projectTargets = useMemo(() => ({
        // Schema-First：统一使用标准字段名targetChapters（后端projectService同时输出两个字段兼容）
        targetChapters: (currentProject?.targetChapters ?? currentProject?.targetChapterCount) || '',
        targetWordCount: currentProject?.targetWordCount || '',
    }), [currentProject?.targetChapters, currentProject?.targetChapterCount, currentProject?.targetWordCount]);

    const [chapterFilter, setChapterFilter] = useState('all'), [chapterCollapsed, setChapterCollapsed] = useState(false);

    const audit = useAuditState(currentProject), tools = useToolsState(currentProject, selectedChapter);
    const agentConfig = useAgentConfigState(currentProject), output = useOutputState(currentProject, selectedChapter);
    const pollRef = useRef(null), buttonPollRefs = useRef([]);

    const startPipelineMut = useStartPipeline(), stopPipelineMut = useStopPipeline();
    const resetPipelineMut = useResetPipeline(), rerunMaterialManagerMut = useRerunMaterialManager();
    const generateSubplaneMaterialsMut = useGenerateSubplaneMaterials(), clearChaptersAfterMut = useClearChaptersAfter();
    const toggleMaterialLockMut = useToggleMaterialLock();
    const setVolumeSubplaneMut = useSetVolumeSubplane(), saveTargetsMut = useSaveProjectTargets(currentProject?.id);
    const supplementOutlinesMut = useSupplementOutlines(), resetChapterContentMut = useResetChapterContent();
    const resetChaptersBulkMut = useResetChaptersBulk();
    const syncHookBudgetMut = useSyncHookBudget(currentProject?.id), extractRuleStackMut = useExtractRuleStack(currentProject?.id);
    const registerHookMut = useRegisterHook(currentProject?.id);

    const {
        runStep, runFullPipeline, fullPipelineTaskId, fullPipelinePolling, fullPipelinePollErrors,
        runStepMut, runFullPipelineMut,
    } = useFullPipelineHandler(currentProject, selectedChapter);

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!currentProject) return;
        const cid = searchParams.get('chapterId'), cnum = searchParams.get('chapter');
        if (cid && chaptersData) { const f = chaptersData.find(c => c.id === cid); if (f) setSelectedChapter(f); }
        else if (cnum && chaptersData) { const f = chaptersData.find(c => c.chapterNumber === parseInt(cnum)); if (f) setSelectedChapter(f); }
    }, [currentProject, chaptersData]); // eslint-disable-line react-hooks/exhaustive-deps
    /* eslint-enable react-hooks/set-state-in-effect */

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!currentProject || !pipelineStatusData) return;
        if (pipelineStatusData.logs?.length > 0)
            setPipelineState({ logs: mapInfiniteLogs(pipelineStatusData.logs), running: pipelineStatusData.running, currentStep: pipelineStatusData.phase });
        if (!pipelineStatusData.running) {
            pipelineStatusData.logs?.length > 0
                ? setPipelineState({ logs: mapInfiniteLogs(pipelineStatusData.logs), running: false, currentStep: null })
                : setPipelineState({ running: false, currentStep: null });
            if (selectedChapter?.id && chaptersData) { const u = chaptersData.find(c => c.id === selectedChapter.id); if (u) setSelectedChapter(u); }
        } else if (selectedChapter?.id && chaptersData) { const u = chaptersData.find(c => c.id === selectedChapter.id); if (u) setSelectedChapter(u); }
    }, [currentProject, pipelineStatusData, selectedChapter?.id, chaptersData, setPipelineState]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const supplementOutlines = async () => {
        if (!currentProject) return;
        try { const res = await supplementOutlinesMut.mutateAsync({ projectId: currentProject.id, supplementCount: infiniteOptions.chaptersPerBatch }); addPipelineLog({ step: 'supplement-outlines', status: 'done', result: res, timestamp: new Date().toISOString() }); }
        catch (e) { addPipelineLog({ step: 'supplement-outlines', status: 'error', error: e.message, timestamp: new Date().toISOString() }); }
    };
    const loadPipelineLogs = async (projectId, chapterId) => {
        try {
            const res = await pipelineApi.getPipelineLogs(projectId, chapterId); const entries = res.data?.entries || [];
            if (entries.length > 0 && pipelineState.logs.length === 0)
                setPipelineState({ logs: entries.map(e => ({ step: e.step, status: e.passed ? 'done' : 'error', result: e.passed !== undefined ? { passed: e.passed, feedback: e.feedback } : undefined, error: e.error, timestamp: e.timestamp, round: e.round })) });
        } catch (e) { logger.error('PipelinePage', 'Load pipeline logs failed:', e.message); }
    };
    const resetChapterContent = async (chapterId, chapterNumber) => {
        if (!currentProject) return; if (!confirm(`确定删除第${chapterNumber}章的正文？大纲将保留。`)) return;
        try { const res = await resetChapterContentMut.mutateAsync({ projectId: currentProject.id, chapterId }); if (res?.success) alert(res.message); } catch (e) { alert('重置失败: ' + e.message); }
    };
    const resetChaptersBulk = async () => {
        if (!currentProject) return;
        const from = prompt('从第几章开始删除正文？'), to = prompt('到第几章结束删除正文？');
        if (!from || !to) return; if (!confirm(`确定删除第${from}-${to}章的正文？大纲将保留。`)) return;
        try { const res = await resetChaptersBulkMut.mutateAsync({ projectId: currentProject.id, fromChapter: parseInt(from), toChapter: parseInt(to) }); if (res?.success) alert(res.message); } catch (e) { alert('批量重置失败: ' + e.message); }
    };
    const clearChaptersAfter = async (afterChapter) => {
        if (!currentProject) return;
        try { return await clearChaptersAfterMut.mutateAsync({ projectId: currentProject.id, afterChapter }); } catch (e) { alert('清理失败: ' + e.message); }
    };

    const selectChapter = (ch) => {
        setSelectedChapter(ch);
        output.setViewVersion(null);
        if (ch.intentPlannerOutput) {
            tools.chapterIntentQuery.refetch().then(res => { tools.setChapterIntentInfo(res.data); }).catch(() => { tools.setChapterIntentInfo(null); });
        } else { tools.setChapterIntentInfo(null); }
    };

    const rerunMaterialManager = async () => {
        if (!currentProject) return;
        const emptyMatChapters = (chaptersData || []).filter(ch => (ch.status === STATUS_VALUES.APPROVED || ch.status === STATUS_VALUES.MATERIAL_UPDATED) && ch.content && (!ch.materialManagerOutput || ch.materialManagerOutput === ''));
        if (emptyMatChapters.length === 0) { alert('所有已通过章节都有素材管理输出，无需补跑'); return; }
        if (!confirm(`将为 ${emptyMatChapters.length} 个缺少素材输出的章节重新运行素材管理员，确认？`)) return;
        try {
            const res = await rerunMaterialManagerMut.mutateAsync({ projectId: currentProject.id });
            addPipelineLog({ step: 'rerun-material-manager', status: 'started', result: res, timestamp: new Date().toISOString() });
            alert(`已启动素材管理员补跑，共 ${emptyMatChapters.length} 章`);
        } catch (e) { addPipelineLog({ step: 'rerun-material-manager', status: 'error', error: e.message, timestamp: new Date().toISOString() }); }
    };

    const generateSubplaneMaterials = async () => {
        if (!currentProject) return;
        const name = prompt('次位面名称（如：锈蚀王庭）');
        if (!name) return;
        const type = prompt('类型（规则怪谈类/文明类/动漫类/抽象概念类）', '规则怪谈类');
        if (!type) return;
        const ip = prompt('IP参考（可选，如：寂静岭/黑客帝国）', '');
        const vol = prompt('分配到第几卷？', '1');
        if (!confirm(`确认生成次位面「${name}」(${type})的素材包？`)) return;
        try {
            const res = await generateSubplaneMaterialsMut.mutateAsync({
                projectId: currentProject.id, subplaneName: name, subplaneType: type,
                ipReference: ip || '', volumeNumber: parseInt(vol) || 1
            });
            alert(`生成成功！共${res?.count || 0}个素材\n` + (res?.createdMaterials || []).map(m => `[${m.type}] ${m.name}`).join('\n'));
            const mapRes = await tools.injectionMapQuery.refetch();
            tools.setInjectionMapInfo(mapRes.data);
        } catch (e) { alert('生成失败: ' + (e.response?.data?.error || e.message)); }
    };

    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); buttonPollRefs.current.forEach(id => clearInterval(id)); buttonPollRefs.current = []; }, []);
    useEffect(() => { if (selectedChapter && currentProject) loadPipelineLogs(currentProject.id, selectedChapter.id); }, [selectedChapter?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const completedChapters = (chaptersData || []).filter(ch => ch.content).length;

    return {
        currentProject, chaptersData, projectMode, pipelineSteps, outputTabs,
        pipelineState, pipelineStatusData, selectedChapter, setSelectedChapter, maxRounds,
        infinite: { infiniteStatus, infiniteOptions, setInfiniteOptions, startInfinitePipeline, stopInfinitePipeline, forceResetPipeline },
        chapterActions: { runStep, runFullPipeline, resetChapterContent, resetChaptersBulk, supplementOutlines, loadPipelineLogs, clearChaptersAfter, selectChapter, rerunMaterialManager, generateSubplaneMaterials },
        audit, agentConfig, tools, output,
        chapterList: { chapterFilter, setChapterFilter, chapterCollapsed, setChapterCollapsed },
        fullPipeline: { fullPipelineTaskId, fullPipelinePolling, fullPipelinePollErrors },
        genre: { genreId, genreConstraintsData, genreConstraints, genreStyleProfile },
        projectTargets, setProjectTargets: () => {}, completedChapters, pollRef, buttonPollRefs,
        startPipelineMut, stopPipelineMut, resetPipelineMut, rerunMaterialManagerMut, generateSubplaneMaterialsMut,
        toggleMaterialLockMut, setVolumeSubplaneMut, saveTargetsMut, supplementOutlinesMut, resetChapterContentMut,
        resetChaptersBulkMut, runStepMut, runFullPipelineMut, clearChaptersAfterMut,
        syncHookBudgetMut, extractRuleStackMut, registerHookMut,
        addPipelineLog, clearPipelineLogs, setPipelineState,
    };
}
