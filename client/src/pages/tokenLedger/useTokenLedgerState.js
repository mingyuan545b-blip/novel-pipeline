/**
 * useTokenLedgerState.js — Token 去向面板状态
 * 状态：数据/加载/错误/视图（场景+指标）/单章明细。筛选在本地重算，切换即时生效。
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import useAppStore from '../../store/useAppStore';
import { pipelineApi } from '../../services/api';
import { applySceneFilter } from './tokenLedgerFilter';

export default function useTokenLedgerState() {
    const { currentProject } = useAppStore();
    const [raw, setRaw] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [view, setView] = useState({ sceneKey: '', metric: 'total' });
    const [detail, setDetail] = useState({ chapter: null, calls: [], loading: false });

    const load = useCallback(async () => {
        if (!currentProject?.id) return;
        setLoading(true);
        setError(null);
        try {
            const res = await pipelineApi.getTokenLedger(currentProject.id);
            setRaw(res.data);
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    }, [currentProject]);

    useEffect(() => { load(); }, [load]);

    const data = useMemo(() => applySceneFilter(raw, view.sceneKey), [raw, view.sceneKey]);

    const setSceneKey = useCallback((key) => setView(v => ({ ...v, sceneKey: key })), []);
    const setMetric = useCallback((metric) => setView(v => ({ ...v, metric })), []);
    const resetScene = useCallback(() => setView(v => ({ ...v, sceneKey: '' })), []);

    /** 展开某章的每次调用明细（按需请求，避免首屏过大） */
    const toggleChapter = useCallback(async (chapterNumber) => {
        if (detail.chapter === chapterNumber) { setDetail({ chapter: null, calls: [], loading: false }); return; }
        setDetail({ chapter: chapterNumber, calls: [], loading: true });
        try {
            const res = await pipelineApi.getTokenLedgerChapter(currentProject.id, chapterNumber);
            setDetail({ chapter: chapterNumber, calls: res.data.calls || [], loading: false });
        } catch (e) {
            setDetail({ chapter: chapterNumber, calls: [], loading: false });
            setError(e.response?.data?.error || e.message);
        }
    }, [currentProject, detail.chapter]);

    return {
        currentProject, data, loading, error, load,
        sceneKey: view.sceneKey, metric: view.metric,
        setSceneKey, setMetric, resetScene,
        detail, toggleChapter,
    };
}
