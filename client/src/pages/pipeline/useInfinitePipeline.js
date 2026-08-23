import { useState, useEffect, useRef, useCallback } from 'react';
import logger from '../../shared/logger';
import { pipelineApi, chaptersApi } from '../../services/api';
import { useWebSocketStatus } from '../../hooks/useWebSocket';
import { mapInfiniteLogs, useInfinitePipelineWs } from './useInfinitePipelineWs';

const WS_DISCONNECT_FALLBACK_MS = 10000;

export function useInfinitePipeline(currentProject, selectedChapter, refreshChapters, setSelectedChapter, setPipelineState) {
    const [infiniteStatus, setInfiniteStatus] = useState({ running: false });
    const [infiniteOptions, setInfiniteOptions] = useState({
        chaptersPerBatch: 30,
        maxSupplements: 999,
        stopAfterChapter: '',
        maxRounds: 5
    });
    const wsDisconnectedAtMs = useRef(0);
    const wsStatus = useWebSocketStatus();

    const [fallbackPollActive, setFallbackPollActive] = useState(false);

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (wsStatus !== 'connected') {
            if (!wsDisconnectedAtMs.current) wsDisconnectedAtMs.current = Date.now();
        } else {
            wsDisconnectedAtMs.current = 0;
        }
        const shouldPoll = infiniteStatus.running && (
            wsStatus !== 'connected' ||
            (wsDisconnectedAtMs.current > 0 && (Date.now() - wsDisconnectedAtMs.current > WS_DISCONNECT_FALLBACK_MS))
        );
        setFallbackPollActive(shouldPoll);
    }, [wsStatus, infiniteStatus.running]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const refreshChapterData = useCallback(async () => {
        if (!currentProject) return;
        try {
            refreshChapters();
            const res = await chaptersApi.list({ projectId: currentProject.id });
            const list = res.data || [];
            if (selectedChapter?.id) {
                const updated = list.find(c => c.id === selectedChapter.id);
                if (updated) setSelectedChapter(updated);
            }
        } catch (err) {
            logger.warn('useInfinitePipeline', 'chapters refresh error:', err.message);
        }
    }, [currentProject, selectedChapter, refreshChapters, setSelectedChapter]);

    useInfinitePipelineWs(currentProject, setInfiniteStatus, setPipelineState, refreshChapterData);

    useEffect(() => {
        if (currentProject) {
            pipelineApi.getInfiniteStatus(currentProject.id).then(res => setInfiniteStatus(res.data || {})).catch(e => logger.warn('InfinitePipeline', 'Status fetch failed:', e.message));
        }
    }, [currentProject]);

    useEffect(() => {
        if (!fallbackPollActive || !currentProject) return;
        const pollInterval = setInterval(async () => {
            try {
                const res = await pipelineApi.getInfiniteStatus(currentProject.id);
                const data = res.data || {};
                setInfiniteStatus(data);
                if (data.logs?.length > 0) {
                    const syncLogs = mapInfiniteLogs(data.logs);
                    setPipelineState(prev => ({ ...prev, logs: syncLogs, running: data.running, currentStep: data.phase || prev.currentStep }));
                }
                if (!data.running) {
                    refreshChapterData();
                }
            } catch (e) {
                logger.warn('useInfinitePipeline', 'POLL error:', e.message);
            }
        }, 5000);
        return () => clearInterval(pollInterval);
    }, [fallbackPollActive, currentProject, refreshChapterData, setPipelineState]);

    const startInfinitePipeline = async () => {
        if (!currentProject) { alert('请先选择一个项目'); return; }
        try {
            const statusRes = await pipelineApi.getInfiniteStatus(currentProject.id);
            if (statusRes.data?.running) {
                const doReset = confirm('检测到流水线状态异常（显示运行中但可能已中断），是否强制重置后重新启动？');
                if (doReset) {
                    await pipelineApi.resetInfinite({ projectId: currentProject.id });
                    setInfiniteStatus({ running: false });
                } else { return; }
            }
            setInfiniteStatus({ running: true, currentChapter: null, completedChapters: 0, logs: [{ time: new Date().toISOString(), msg: '正在启动无限流水线...' }] });
            const res = await pipelineApi.startInfinite({
                projectId: currentProject.id,
                chaptersPerBatch: infiniteOptions.chaptersPerBatch,
                maxSupplements: infiniteOptions.maxSupplements,
                maxRounds: infiniteOptions.maxRounds,
                stopAfterChapter: infiniteOptions.stopAfterChapter ? parseInt(infiniteOptions.stopAfterChapter) : null
            });
            if (res.data?.success || res.success) {
                setInfiniteStatus(prev => ({ ...prev, running: true, logs: [...(prev.logs || []), { time: new Date().toISOString(), msg: '✅无限流水线已启动' }] }));
            } else {
                const errMsg = res.data?.error || res.error || res.data?.message || '服务端未返回成功标识';
                setInfiniteStatus({ running: false });
                alert('启动失败：' + errMsg);
            }
        } catch (e) {
            logger.error('useInfinitePipeline', 'startInfinitePipeline error:', e.message);
            setInfiniteStatus({ running: false });
            alert('启动无限流水线失败: ' + (e.response?.data?.error || e.response?.data?.message || e.message || '网络请求失败'));
        }
    };

    const stopInfinitePipeline = async () => {
        if (!currentProject) return;
        try {
            await pipelineApi.stopInfinite({ projectId: currentProject.id });
            setInfiniteStatus({ running: false, stopped: true });
        } catch (e) {
            logger.error('useInfinitePipeline', 'stopInfinitePipeline error:', e.message);
            setInfiniteStatus({ running: false, stopped: true });
        }
    };

    const forceResetPipeline = async () => {
        if (!currentProject) return;
        if (!confirm('确定强制重置流水线状态？这会清除所有运行中的状态')) return;
        try {
            await pipelineApi.resetInfinite({ projectId: currentProject.id });
            setInfiniteStatus({ running: false });
            alert('流水线状态已重置');
        } catch (e) {
            alert('重置失败: ' + e.message);
        }
    };

    return {
        infiniteStatus, setInfiniteStatus, infiniteOptions, setInfiniteOptions,
        startInfinitePipeline, stopInfinitePipeline, forceResetPipeline,
        fallbackPollActive, wsStatus
    };
}
