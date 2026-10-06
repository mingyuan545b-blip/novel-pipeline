import { useState, useCallback, useEffect } from 'react';
import { pipelineApi } from '../../services/api';
import { buildWorlds, buildEntityIndex } from './worldScopeUtils';
import logger from '../../shared/logger';

const DEFAULT_WORLDS = [{ id: 'main-world', name: '主世界', color: '#00c8ff', isDefault: true }];

/**
 * 世界域数据加载与状态管理 hook。
 * 聚合统一走 worldScopeUtils（按 worldName 归一去重，修复"worldId 恒为 main-world 导致 0 归属"）。
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
            const body = res.data || {};
            const rawItems = Array.isArray(body) ? body : (body.items || body.data || []);
            // 优先用后端组装的事件（含 transitions + 带出违规 violations），退回原始记录过滤
            const events = Array.isArray(body.events) && body.events.length
                ? body.events
                : rawItems.filter(it => /transition|event/.test(String(it.type || '')));
            setScopeData({
                worlds: buildWorlds(rawItems, DEFAULT_WORLDS),
                // 项目世界配置（含 carryOutPolicy/channelTag/exitMethod，通行契约以它为准）
                projectWorlds: Array.isArray(body.worlds) ? body.worlds : [],
                worldEntities: buildEntityIndex(rawItems),
                worldInfos: rawItems.filter(it => it.type === 'world-info'),
                factionsByWorld: body.factionsByWorld || {},
                events,
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
