import { useState, useEffect, useCallback, useMemo } from 'react';
import logger from '../../shared/logger';
import { pipelineApi, entityRegistryApi } from '../../services/api';

export default function useChronicleState(projectId, project) {
    const [chronicleData, setChronicleData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [extracting, setExtracting] = useState(false);
    const [selectedEntityId, setSelectedEntityId] = useState(null);
    const [selectedWorldId, setSelectedWorldId] = useState(null);
    const [entities, setEntities] = useState([]);

    const chronicleLevel = project?.settings?.chronicleLevel || 'off';
    const worldScopeLevel = project?.settings?.worldScopeLevel || 'off';

    useEffect(() => {
        if (!projectId) return;
        entityRegistryApi.list({ projectId, entityType: 'character' })
            .then(res => setEntities(res.data?.data || res.data || []))
            .catch(() => setEntities([]));
    }, [projectId]);

    const fetchChronicle = useCallback(async () => {
        if (!projectId || chronicleLevel === 'off') { setChronicleData([]); setError(null); return; }
        try {
            setLoading(true); setError(null);
            const params = {};
            if (selectedEntityId) params.entityId = selectedEntityId;
            const res = await pipelineApi.getChronicle(projectId, params);
            setChronicleData(res.data?.data || []);
        } catch (err) {
            setError(err.response?.data?.error || err.message || '加载编年史数据失败');
        } finally { setLoading(false); }
    }, [projectId, chronicleLevel, selectedEntityId]);

    useEffect(() => { fetchChronicle(); }, [fetchChronicle]);

    const handleExtract = async () => {
        if (!projectId || extracting) return;
        try {
            setExtracting(true);
            const res = await pipelineApi.extractChronicle(projectId, { level: chronicleLevel });
            if (res.data.success) { alert(`提取完成: ${res.data.results.length}章已处理`); fetchChronicle(); }
        } catch (err) {
            logger.error('ChronicleTab', 'Extract failed:', err.message);
            alert('提取失败: ' + err.message);
        } finally { setExtracting(false); }
    };

    const filteredChronicleData = useMemo(() => {
        if (!selectedWorldId) return chronicleData;
        return chronicleData.filter(c => {
            const entity = entities.find(e => e.name === c.entityName);
            const scope = entity?.profile?.worldScope;
            if (!scope) return selectedWorldId === 'main-world';
            return scope.appearances?.some(a => a.worldId === selectedWorldId);
        });
    }, [chronicleData, selectedWorldId, entities]);

    return {
        chronicleData, loading, error, extracting, selectedEntityId, selectedWorldId,
        entities, chronicleLevel, worldScopeLevel, filteredChronicleData,
        setSelectedEntityId, setSelectedWorldId, fetchChronicle, handleExtract,
    };
}
