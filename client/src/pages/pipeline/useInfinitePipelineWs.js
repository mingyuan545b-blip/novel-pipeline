import { useEffect } from 'react';
import { pipelineApi } from '../../services/api';
import { useProjectEvents } from '../../hooks/useWebSocket';
import logger from '../../shared/logger';

const mapInfiniteLogs = (logs) => logs.map(e => ({
    step: e.step,
    status: e.passed ? 'done' : (e.passed === false ? 'error' : 'running'),
    result: e.passed !== undefined ? { passed: e.passed, feedback: e.feedback } : undefined,
    error: e.error,
    timestamp: e.time || e.timestamp,
    round: e.round,
    chapterNumber: e.chapterNumber,
    msg: e.msg,
    affectedChapter: e.affectedChapter
}));

export { mapInfiniteLogs };

export function useInfinitePipelineWs(currentProject, setInfiniteStatus, setPipelineState, refreshChapterData) {
    const wsEvent = useProjectEvents(currentProject?.id);

    useEffect(() => {
        if (!wsEvent) return;
        const { event, data } = wsEvent;

        if (event === 'pipeline:log') {
            const entry = data;
            const mapped = mapInfiniteLogs([entry]);
            if (mapped.length > 0) {
                setPipelineState(prev => ({
                    ...prev,
                    logs: [...(prev.logs || []), mapped[0]],
                    currentStep: entry.step
                }));
            }
            setInfiniteStatus(prev => {
                if (prev.running) return prev;
                return { ...prev, running: true, currentChapter: entry.chapterNumber || prev.currentChapter };
            });
        }

        if (event === 'pipeline:chapter-complete') {
            refreshChapterData();
        }

        if (event === 'pipeline:status') {
            if (data.running) {
                setInfiniteStatus(prev => ({ ...prev, ...data, running: true }));
                setPipelineState(prev => ({ ...prev, running: true }));
            } else {
                setInfiniteStatus(prev => ({ ...prev, running: false }));
                setPipelineState(prev => ({ ...prev, running: false, currentStep: null }));
                refreshChapterData();
                pipelineApi.getInfiniteStatus(currentProject.id).then(res => {
                    const fullData = res.data || {};
                    if (fullData.logs?.length > 0) {
                        const syncLogs = mapInfiniteLogs(fullData.logs);
                        setPipelineState({ logs: syncLogs, running: false, currentStep: null });
                    }
                }).catch(e => logger.warn('InfinitePipelineWs', 'Status sync failed:', e.message));
            }
        }
    }, [wsEvent, currentProject?.id, refreshChapterData, setPipelineState, setInfiniteStatus]);
}
