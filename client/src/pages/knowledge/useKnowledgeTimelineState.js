import { useState, useCallback } from 'react';
import { knowledgeApi } from '../../services/api';
import logger from '../../shared/logger';

export function useKnowledgeTimelineState(projectId) {
    const [timelineEvents, setTimelineEvents] = useState([]);
    const [timelineStats, setTimelineStats] = useState(null);
    const [timelineFilter, setTimelineFilter] = useState('all');
    const [selectedCharId, setSelectedCharId] = useState(null);
    const [charTimeline, setCharTimeline] = useState([]);
    const [snapshotDiff, setSnapshotDiff] = useState(null);

    const loadTimeline = useCallback(async () => {
        if (!projectId) return;
        try {
            const [eventsRes, statsRes] = await Promise.all([
                knowledgeApi.getTimelineEvents(projectId),
                knowledgeApi.getTimelineStats(projectId)
            ]);
            // 后端返回 { events: [...] }，需要提取数组
            const eventsData = eventsRes.data || eventsRes;
            const eventsList = Array.isArray(eventsData) ? eventsData : (eventsData?.events || []);
            setTimelineEvents(eventsList);
            // 后端返回 { stats: {...} }
            const statsData = statsRes.data || statsRes;
            setTimelineStats(statsData?.stats || statsData || null);
        } catch (e) { logger.warn('Knowledge', 'Timeline load failed:', e.message); }
    }, [projectId]);

    const handleCharTimeline = useCallback(async (charId) => {
        if (!projectId) return;
        setSelectedCharId(charId);
        try {
            const res = await knowledgeApi.getCharacterTimeline(projectId, charId);
            setCharTimeline(res.data || res || []);
        } catch (e) { logger.warn('Knowledge', 'Char timeline failed:', e.message); }
    }, [projectId]);

    const handleSnapshotDiff = useCallback(async (chA, chB) => {
        if (!projectId) return;
        try {
            const res = await knowledgeApi.getSnapshotDiff(projectId, { chapterA: chA, chapterB: chB });
            setSnapshotDiff(res.data || res);
        } catch (e) { alert('对比失败: ' + e.message); }
    }, [projectId]);

    return {
        timelineEvents, timelineStats, timelineFilter, setTimelineFilter,
        selectedCharId, charTimeline, snapshotDiff,
        loadTimeline, handleCharTimeline, handleSnapshotDiff,
    };
}
