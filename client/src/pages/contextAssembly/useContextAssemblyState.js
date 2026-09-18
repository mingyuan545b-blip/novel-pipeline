/**
 * useContextAssemblyState.js — 上下文装配图页面状态管理
 * 展示：本章各Agent实际装载了哪些提示词/资料、什么层级与信息密度、哪些数据未接入或丢失
 * 世界观3层：宏观·底层规则 / 中观·势力与地理 / 微观·细节补充
 * 角色3层：主角·核心设定 / 配角与反派 / 人物关系网
 */
import { useState, useCallback, useEffect } from 'react';
import useAppStore from '../../store/useAppStore';
import { pipelineApi } from '../../services/api';

const DEFAULT_FILTERS = {
    'worldview-macro': true, 'worldview-meso': true, 'worldview-micro': true,
    'character-protagonist': true, 'character-supporting': true, 'character-relationship': true,
    equipment: true, technique: true,
    foreshadowing: true, 'knowledge-access': true,
};

export default function useContextAssemblyState() {
    const { currentProject } = useAppStore();
    const [mapData, setMapData] = useState(null);
    const [agentType, setAgentType] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedBranches, setExpandedBranches] = useState(new Set());
    const [selectedNode, setSelectedNode] = useState(null);
    const [chapterNumber, setChapterNumber] = useState(1);
    const [categoryFilters, setCategoryFilters] = useState(DEFAULT_FILTERS);

    const loadMap = useCallback(async () => {
        if (!currentProject) return;
        setLoading(true);
        setError(null);
        try {
            const res = await pipelineApi.getContextAssembly(currentProject.id, chapterNumber, agentType);
            setMapData(res.data);
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    }, [currentProject, chapterNumber, agentType]);

    useEffect(() => {
        if (currentProject) loadMap();
    }, [currentProject, loadMap]);

    const toggleBranch = useCallback((branchKey) => {
        setExpandedBranches(prev => {
            const next = new Set(prev);
            if (next.has(branchKey)) next.delete(branchKey);
            else next.add(branchKey);
            return next;
        });
    }, []);

    const toggleCategoryFilter = useCallback((key) => {
        setCategoryFilters(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const setBranchDepth = useCallback(async (branchKey, depth) => {
        if (!currentProject || !mapData) return;
        const branch = mapData.root.children.find(c => c.id === branchKey);
        if (!branch || !branch.children || branch.children.length === 0) return;
        try {
            await pipelineApi.setContextOverride(currentProject.id, {
                materialId: branch.children[0].id,
                scope: 'chapter',
                targetDepth: depth,
                chapterNumber,
            });
            await loadMap();
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        }
    }, [currentProject, mapData, chapterNumber, loadMap]);

    const setItemDepth = useCallback(async (itemId, depth) => {
        if (!currentProject) return;
        try {
            await pipelineApi.setContextOverride(currentProject.id, {
                materialId: itemId, scope: 'chapter', targetDepth: depth, chapterNumber,
            });
            await loadMap();
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        }
    }, [currentProject, chapterNumber, loadMap]);

    const removeOverride = useCallback(async (overrideId) => {
        try {
            await pipelineApi.deleteContextOverride(overrideId);
            await loadMap();
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        }
    }, [loadMap]);

    return {
        currentProject, mapData, loading, error,
        expandedBranches, selectedNode, chapterNumber, categoryFilters, agentType,
        loadMap, toggleBranch, setSelectedNode, setChapterNumber,
        toggleCategoryFilter, setBranchDepth, setItemDepth, removeOverride, setAgentType,
    };
}
