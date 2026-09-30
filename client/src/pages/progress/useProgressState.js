/**
 * useProgressState — 运行看板数据（含轮询）
 *
 * 轮询策略：运行中 10s 一次；空闲时 30s 一次（省请求，但仍能反映状态变化）。
 * 数据源单点：GET /api/pipeline/progress/:projectId（服务端已把五处数据合成一份）。
 * 文件位置：client/src/pages/progress/useProgressState.js
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import useAppStore from '../../store/useAppStore';
import { pipelineApi } from '../../services/api';
import logger from '../../shared/logger';

const RUNNING_INTERVAL_MS = 10000;
const IDLE_INTERVAL_MS = 30000;

export default function useProgressState() {
    const { currentProject } = useAppStore();
    const projectId = currentProject?.id || null;
    const [view, setView] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [updatedAt, setUpdatedAt] = useState(null);
    const timerRef = useRef(null);

    const load = useCallback(async () => {
        if (!projectId) { setView(null); return; }
        try {
            const res = await pipelineApi.getProgress(projectId);
            setView(res.data || res);
            setUpdatedAt(Date.now());
            setError('');
        } catch (e) {
            logger.warn('Progress', 'load failed:', e.message);
            setError(e.message || '加载失败');
        }
    }, [projectId]);

    const refresh = useCallback(async () => {
        setLoading(true);
        await load();
        setLoading(false);
    }, [load]);

    useEffect(() => {
        if (!projectId) return undefined;
        let cancelled = false;
        const tick = async () => {
            if (cancelled) return;
            await load();
            if (cancelled) return;
            const interval = view && view.running ? RUNNING_INTERVAL_MS : IDLE_INTERVAL_MS;
            timerRef.current = setTimeout(tick, interval);
        };
        tick();
        return () => { cancelled = true; if (timerRef.current) clearTimeout(timerRef.current); };
        // 只依赖 projectId：interval 由每轮自行决定，避免 view 变化导致重建定时器
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, load]);

    return { projectId, currentProject, view, error, loading, updatedAt, refresh };
}
