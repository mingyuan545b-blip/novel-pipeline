import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../../store/useAppStore';
import { knowledgeApi, projectsApi, materialsApi } from '../../services/api';
import logger from '../../shared/logger';
import { useKnowledgeTimelineState } from './useKnowledgeTimelineState';

const TAB_LOADERS = {
    memory: 'loadMemory',
    graph: 'loadGraph',
    power: 'loadPower',
    timeline: 'loadTimeline',
    foreshadowing: 'loadForeshadowing',
    consistency: 'loadConsistencyReports',
    snapshots: 'loadSnapshots'
};

export default function useKnowledgeState(initialTab) {
    const { currentProject } = useAppStore();
    const projectId = currentProject?.id;

    const validTabs = ['overview', 'memory', 'graph', 'power', 'timeline', 'foreshadowing', 'consistency', 'snapshots'];
    const safeInitial = initialTab && validTabs.includes(initialTab) ? initialTab : 'overview';
    const [activeTab, setActiveTab] = useState(safeInitial);
    const [overview, setOverview] = useState(null);
    const [memoryLayers, setMemoryLayers] = useState(null);
    const [graph, setGraph] = useState(null);
    const [powerData, setPowerData] = useState(null);
    const [foreshadowings, setForeshadowings] = useState([]);
    const [consistencyResult, setConsistencyResult] = useState(null);
    const [consistencyReports, setConsistencyReports] = useState([]);
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [checkChapter, setCheckChapter] = useState('');

    const timelineState = useKnowledgeTimelineState(projectId);

    const loadOverview = useCallback(async () => {
        if (!projectId) return;
        try { const res = await knowledgeApi.getOverview(projectId); setOverview(res.data || res); }
        catch (e) { logger.warn('Knowledge', 'Overview load failed:', e.message); }
    }, [projectId]);

    const loadMemory = useCallback(async () => {
        if (!projectId) return;
        try { const res = await knowledgeApi.getMemoryLayers(projectId); setMemoryLayers(res.data || res); }
        catch (e) { logger.warn('Knowledge', 'Memory load failed:', e.message); }
    }, [projectId]);

    const loadGraph = useCallback(async () => {
        if (!projectId) return;
        try { const res = await projectsApi.getRelationshipGraph(projectId); setGraph(res.data || res); }
        catch {
            try { const res = await knowledgeApi.getRelationshipGraph(projectId); setGraph(res.data || res); }
            catch (e2) { logger.warn('Knowledge', 'Graph load failed:', e2.message); }
        }
    }, [projectId]);

    const loadPower = useCallback(async () => {
        if (!projectId) return;
        try { const res = await knowledgeApi.getPowerTracker(projectId); setPowerData(res.data || res); }
        catch (e) { logger.warn('Knowledge', 'Power load failed:', e.message); }
    }, [projectId]);

    const loadForeshadowing = useCallback(async () => {
        if (!projectId) return;
        try { const res = await materialsApi.list({ projectId, type: 'foreshadowing' }); setForeshadowings(res.data || []); }
        catch {
            try { const res = await knowledgeApi.getForeshadowingTracker(projectId); setForeshadowings(res.data || res || []); }
            catch (e2) { logger.warn('Knowledge', 'Foreshadowing load failed:', e2.message); }
        }
    }, [projectId]);

    const loadConsistencyReports = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await knowledgeApi.getConsistencyReports(projectId);
            // 后端返回 { reports: [...] }，需要提取数组
            const data = res.data || res;
            const reportsList = Array.isArray(data) ? data : (data?.reports || []);
            setConsistencyReports(reportsList);
        } catch (e) { logger.warn('Knowledge', 'Reports load failed:', e.message); }
    }, [projectId]);

    const loadSnapshots = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await knowledgeApi.getSnapshots(projectId);
            // 后端返回 { snapshots: [...] }，需要提取数组
            const data = res.data || res;
            const snapshotsList = Array.isArray(data) ? data : (data?.snapshots || []);
            setSnapshots(snapshotsList);
        } catch (e) { logger.warn('Knowledge', 'Snapshots load failed:', e.message); }
    }, [projectId]);

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => { if (projectId) loadOverview(); }, [projectId, loadOverview]);
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        if (!projectId) return;
        const loaderMap = {
            loadMemory, loadGraph, loadPower, loadTimeline: timelineState.loadTimeline,
            loadForeshadowing, loadConsistencyReports, loadSnapshots
        };
        const loaderName = TAB_LOADERS[activeTab];
        if (loaderName && loaderMap[loaderName]) loaderMap[loaderName]();
    }, [activeTab, projectId, loadMemory, loadGraph, loadPower, loadForeshadowing, loadConsistencyReports, loadSnapshots, timelineState.loadTimeline]);

    const handleBuildMemory = async (layer) => {
        if (!projectId) return;
        setLoading(true);
        try { await knowledgeApi.buildMemoryLayer(projectId, layer, { chapterNumber: overview?.totalChapters || 1 }); await loadMemory(); }
        catch (e) { alert('构建失败: ' + e.message); }
        setLoading(false);
    };

    const handleConsistencyCheck = async () => {
        if (!projectId || !checkChapter) return;
        setLoading(true);
        try {
            const chapters = useAppStore.getState().chapters;
            const chapter = chapters?.find(c => c.chapterNumber === parseInt(checkChapter));
            const res = await knowledgeApi.runQuickCheck(projectId, { chapterNumber: parseInt(checkChapter), chapterContent: chapter?.content || '' });
            setConsistencyResult(res.data || res);
        } catch (e) { alert('校验失败: ' + e.message); }
        setLoading(false);
    };

    const handleAiCheck = async () => {
        if (!projectId || !checkChapter) return;
        setLoading(true);
        try {
            const chapters = useAppStore.getState().chapters;
            const chapter = chapters?.find(c => c.chapterNumber === parseInt(checkChapter));
            const res = await knowledgeApi.runAiCheck(projectId, { chapterNumber: parseInt(checkChapter), chapterContent: chapter?.content || '' });
            setConsistencyResult(res.data || res);
        } catch (e) { alert('AI校验失败: ' + e.message); }
        setLoading(false);
    };

    return {
        currentProject, projectId, activeTab, setActiveTab,
        overview, memoryLayers, graph, powerData, foreshadowings,
        consistencyResult, consistencyReports, snapshots,
        loading, checkChapter, setCheckChapter,
        loadOverview, loadMemory, loadGraph, loadPower,
        loadForeshadowing, handleBuildMemory, handleConsistencyCheck, handleAiCheck,
        ...timelineState,
    };
}
