import { useState, useCallback, useEffect } from 'react';
import { pipelineApi } from '../../services/api';
import logger from '../../shared/logger';

const DEFAULT_WORLDS = [
    { id: 'main-world', name: '主世界', color: '#00c8ff', isDefault: true }
];

/**
 * 世界域数据加载与状态管理 hook
 * 文件位置：client/src/pages/entitycenter/useWorldScope.js
 */
function useWorldScope(projectId, scopeLevel) {
    const [scopeData, setScopeData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [extracting, setExtracting] = useState(false);

    const fetchScope = useCallback(async () => {
        if (!projectId || scopeLevel === 'off') { setScopeData(null); setError(null); return; }
        try {
            setLoading(true);
            setError(null);
            const res = await pipelineApi.getWorldScope(projectId);
            const rawItems = Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || []);
            const worldsMap = new Map();
            const worldEntities = {};
            const worldInfosMap = new Map();
            const events = [];
            for (const it of rawItems) {
                const t = it.type || '';
                if (t === 'world-info') {
                    worldInfosMap.set(it.worldId || 'main-world', it);
                    if (it.worldName && !worldsMap.has(it.worldId)) {
                        worldsMap.set(it.worldId || it.worldName, { id: it.worldId || it.worldName, name: it.worldName, color: it.color || '#00c8ff' });
                    }
                } else if (t === 'world-scope' || t === 'world') {
                    worldsMap.set(it.id || it.name, { id: it.id || it.name, name: it.name, color: it.color, ...it });
                } else if (t.includes('transition') || t.includes('event')) {
                    events.push(it);
                    if (it.worldName && !worldsMap.has(it.worldName)) {
                        worldsMap.set(it.worldName, { id: it.worldName, name: it.worldName, color: '#00c8ff' });
                    }
                } else if (t.includes('entity') || it.entityType) {
                    const wid = it.worldId || it.worldName || 'main-world';
                    if (!worldEntities[wid]) worldEntities[wid] = [];
                    worldEntities[wid].push(it);
                    if (it.worldName && !worldsMap.has(it.worldName)) {
                        worldsMap.set(it.worldName, { id: it.worldName, name: it.worldName, color: '#00c8ff' });
                    }
                }
            }
            if (worldsMap.size === 0) worldsMap.set('main-world', DEFAULT_WORLDS[0]);
            const mergedWorlds = [...worldsMap.values()].map(w => {
                const info = worldInfosMap.get(w.id);
                return info ? { ...w, ...info, powerSystem: info.powerSystem || [], culture: info.culture || '', techLevel: info.techLevel || '', rules: info.rules || '', dangerLevel: info.dangerLevel || '', description: info.description || '' } : w;
            });
            setScopeData({
                worlds: mergedWorlds, worldEntities, worldInfos: [...worldInfosMap.values()],
                factionsByWorld: res.data?.factionsByWorld || {}, events
            });
        } catch (err) {
            setError(err.response?.data?.error || err.message || '加载世界域数据失败');
        } finally {
            setLoading(false);
        }
    }, [projectId, scopeLevel]);

    useEffect(() => { fetchScope(); }, [fetchScope]);

    const handleExtract = async () => {
        if (!projectId || extracting) return;
        try {
            setExtracting(true);
            const res = await pipelineApi.extractWorldScope(projectId, { level: scopeLevel });
            if (res.data?.success) {
                alert(`提取完成: ${res.data.results.length}章已处理`);
                fetchScope();
            }
        } catch (err) {
            logger.error('WorldScope', 'Extract failed:', err.message);
        } finally {
            setExtracting(false);
        }
    };

    return { scopeData, loading, error, extracting, fetchScope, handleExtract, DEFAULT_WORLDS };
}

export default useWorldScope;
