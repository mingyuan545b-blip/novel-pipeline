import { useState, useEffect, useCallback, useMemo } from 'react';
import useAppStore from '../../store/useAppStore';
import { libraryApi } from '../../services/api';
import logger from '../../shared/logger';
import {
    DEPT_DEPTH, resolveDepth, buildTrees, countByCompleteness, filterEntries, collectExpandKeys, groupBySource,
} from './libraryTreeBuild';

export const DEPT_ICONS = {
    '00_叙事之魂部': '🔮', '01_顶层设计部': '🏗️', '02_情节引擎部': '⚙️',
    '03_人物熔炉部': '🎭', '04_对白艺术部': '💬', '05_文笔滤镜部': '🎨', '06_世界构建部': '🌍'
};
export const DEPT_COLORS = {
    '00_叙事之魂部': '#9b59b6', '01_顶层设计部': '#3498db', '02_情节引擎部': '#e74c3c',
    '03_人物熔炉部': '#e67e22', '04_对白艺术部': '#2ecc71', '05_文笔滤镜部': '#1abc9c', '06_世界构建部': '#f39c12'
};
export const SLOT_LABELS = { L0: '核心层', L1: '活跃层', L2: '近期层', L3: '工作层', L4: '归档层' };
export const INJECTION_LABELS = { 'intent-planner': '意图规划', writer: '执笔人', polisher: '润色师', 'material-manager': '素材管理' };
export const DEPTH_LABELS = { macro: '宏观·叙事骨架', meso: '中观·情节肌理', micro: '微观·文笔细节' };
export const DEPTH_COLORS = { macro: '#9b59b6', meso: '#3498db', micro: '#1abc9c' };
export const cleanName = (name) => (name || '').replace(/^\d+_/, '');
// 兼容旧引用：深度判定已抽到 libraryTreeBuild（纯函数可测），此处透传
export { DEPT_DEPTH, resolveDepth };

/**
 * useLibraryState — 藏经阁状态与数据
 *
 * 2026-10-01 重构：一次拉全量条目，筛选/分组改在客户端（useMemo），
 * 原因是需要"完整度计数"和"按来源筛选"——每次切筛都打服务端既慢又会让计数抖动。
 */
export default function useLibraryState() {
    const { currentProject } = useAppStore();
    const [entries, setEntries] = useState([]);
    const [sources, setSources] = useState([]);
    const [sourcesLoading, setSourcesLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [selectedTech, setSelectedTech] = useState(null);
    const [techDetail, setTechDetail] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearch, setShowSearch] = useState(false);
    const [editingField, setEditingField] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [filters, setFilters] = useState({ completeness: '', source: '', mode: '' });
    const [viewMode, setViewMode] = useState('source');
    const [feedbackData, setFeedbackData] = useState(null);

    const mode = currentProject?.mode || 'novel';

    const filtered = useMemo(() => filterEntries(entries, filters), [entries, filters]);
    const { tree: treeData, byDepth: depthTree } = useMemo(() => buildTrees(filtered), [filtered]);
    const counts = useMemo(() => countByCompleteness(entries, filters.completeness), [entries, filters.completeness]);
    // 「按来源」视图展开某本书时列出的条目（跟随完整度/模式筛选，与卡片计数可能不等，UI 会标注）
    const sourceEntries = useMemo(() => groupBySource(filtered), [filtered]);

    const loadEntries = useCallback(async () => {
        try {
            // 不带 mode 参数：全量取回，模式筛选在客户端做（保证完整度计数稳定）
            const res = await libraryApi.getIndex();
            setEntries((res.data || res).entries || []);
        } catch (e) { logger.warn('Library', 'Index load failed:', e.message); }
    }, []);

    const loadSources = useCallback(async () => {
        setSourcesLoading(true);
        try {
            const res = await libraryApi.getSources();
            setSources((res.data || res).sources || []);
        } catch (e) { logger.warn('Library', 'Sources load failed:', e.message); }
        finally { setSourcesLoading(false); }
    }, []);

    const loadStats = useCallback(async () => {
        try { const res = await libraryApi.getStats(); setStats(res.data || res); }
        catch (e) { logger.warn('Library', 'Stats load failed:', e.message); }
    }, []);

    const loadTechnique = useCallback(async (id) => {
        try { const res = await libraryApi.getTechnique(id); setTechDetail(res.data || res); }
        catch (e) { logger.warn('Library', 'Technique load failed:', e.message); }
    }, []);

    const loadFeedback = useCallback(async () => {
        if (!currentProject?.id) return;
        try { const res = await libraryApi.getFeedback(currentProject.id); setFeedbackData(res.data || res); }
        catch (e) { logger.warn('Library', 'Feedback load failed:', e.message); }
    }, [currentProject?.id]);

    useEffect(() => { loadEntries(); loadSources(); loadStats(); loadFeedback(); }, [loadEntries, loadSources, loadStats, loadFeedback]);

    /** 提取入库/编辑后刷新 */
    const reload = useCallback(async () => { await Promise.all([loadEntries(), loadSources(), loadStats()]); },
        [loadEntries, loadSources, loadStats]);

    const doSearch = useCallback(async () => {
        if (!searchQuery.trim()) { setSearchResults([]); setShowSearch(false); return; }
        try {
            const res = await libraryApi.search({ q: searchQuery, mode: filters.mode || undefined, topK: 30 });
            setSearchResults(res.data || res || []); setShowSearch(true);
        } catch (e) { logger.warn('Library', 'Search failed:', e.message); }
    }, [searchQuery, filters.mode]);

    const toggleNode = (key) => setExpandedNodes(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });
    const expandAll = () => setExpandedNodes(collectExpandKeys(treeData, depthTree));
    const collapseAll = () => setExpandedNodes(new Set());
    const closeSearch = () => { setShowSearch(false); setSearchResults([]); };

    /**
     * 选中技法（id 为 null = 返回列表）。
     * 修复：此前 id=null 时仍去请求 /technique/null，404 被 catch 吞掉 →
     * techDetail 保留上一条，点「返回」右侧画面纹丝不动。
     */
    const handleSelectTech = async (id) => {
        setSelectedTech(id);
        setEditingField(null);
        if (!id) { setTechDetail(null); return; }
        await loadTechnique(id);
    };

    /**
     * 「按来源」点书卡：再点一次收起；展开时自动选中该书第一条技法
     * （服务端已按内容量优先排序）—— 让右侧立刻有内容可看，而不只是高亮一个边框。
     */
    const handlePickSource = useCallback((novel) => {
        const next = filters.source === novel ? '' : novel;
        setFilter('source', next);
        if (!next) return;
        const list = groupBySource(filterEntries(entries, { ...filters, source: next }))[next] || [];
        handleSelectTech(list.length ? list[0].id : null);
        // handleSelectTech 每次渲染重建，纳入依赖只会导致回调抖动，故此处有意省略
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, entries]);
    const handleSaveField = async (field, value) => {
        if (!selectedTech) return;
        try {
            await libraryApi.updateTechnique(selectedTech, { [field]: value });
            await loadTechnique(selectedTech); setEditingField(null); await loadEntries();
        } catch (e) { logger.warn('Library', 'Save failed:', e.message); }
    };
    const handleToggleDisabled = async (id, current) => {
        try { await libraryApi.updateMeta(id, { auto_disabled: !current }); await loadTechnique(id); await reload(); }
        catch (e) { logger.warn('Library', 'Toggle failed:', e.message); }
    };
    const handleResetMeta = async (id) => {
        try { await libraryApi.resetMeta(id); await loadTechnique(id); await loadStats(); }
        catch (e) { logger.warn('Library', 'Reset failed:', e.message); }
    };
    const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

    return {
        currentProject, mode, entries, sources, sourcesLoading, stats, counts, treeData, depthTree,
        expandedNodes, selectedTech, techDetail, searchQuery, setSearchQuery, searchResults, showSearch,
        editingField, setEditingField, editValue, setEditValue, filters, setFilter, viewMode, setViewMode,
        // 兼容别名：模式筛选并入 filters 后，保留旧接口名（既有调用点与测试依赖）
        modeFilter: filters.mode, setModeFilter: (v) => setFilter('mode', v),
        sourceEntries, activeSource: filters.source,
        feedbackData, loadFeedback, toggleNode, handleSelectTech, handlePickSource, handleSaveField,
        handleToggleDisabled, handleResetMeta, expandAll, collapseAll, doSearch, closeSearch, reload,
    };
}
