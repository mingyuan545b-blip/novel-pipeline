import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../../store/useAppStore';
import { libraryApi } from '../../services/api';
import logger from '../../shared/logger';

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
export const cleanName = (s) => (s || '').replace(/^\d+_/, '');

export default function useLibraryState() {
    const { currentProject } = useAppStore();
    const [treeData, setTreeData] = useState({});
    const [stats, setStats] = useState(null);
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [selectedTech, setSelectedTech] = useState(null);
    const [techDetail, setTechDetail] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [modeFilter, setModeFilter] = useState('');
    const [editingField, setEditingField] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [viewMode, setViewMode] = useState('department');
    const [feedbackData, setFeedbackData] = useState(null);

    const mode = currentProject?.mode || 'novel';

    const toggleNode = (key) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const loadTree = useCallback(async () => {
        try {
            const res = await libraryApi.getIndex({ mode: modeFilter || undefined });
            const entries = (res.data || res).entries || [];
            const tree = {};
            for (const e of entries) {
                const dept = e.department;
                const sub = e.subcategory || '其他';
                if (!tree[dept]) tree[dept] = {};
                if (!tree[dept][sub]) tree[dept][sub] = [];
                tree[dept][sub].push(e);
            }
            setTreeData(tree);
        } catch (e) { logger.warn('Library', 'Tree load failed:', e.message); }
    }, [modeFilter]);

    const loadStats = useCallback(async () => {
        try { const res = await libraryApi.getStats(); setStats(res.data || res); }
        catch (e) { logger.warn('Library', 'Stats load failed:', e.message); }
    }, []);

    const loadTechnique = useCallback(async (id) => {
        try { const res = await libraryApi.getTechnique(id); setTechDetail(res.data || res); }
        catch (e) { logger.warn('Library', 'Technique load failed:', e.message); }
    }, []);

    const doSearch = useCallback(async () => {
        if (!searchQuery.trim()) { setSearchResults([]); return; }
        try {
            const res = await libraryApi.search({ q: searchQuery, mode: modeFilter || undefined, topK: 30 });
            setSearchResults(res.data || res || []); setShowSearch(true);
        } catch (e) { logger.warn('Library', 'Search failed:', e.message); }
    }, [searchQuery, modeFilter]);

    const loadFeedback = useCallback(async () => {
        if (!currentProject?.id) return;
        try {
            const res = await libraryApi.getFeedback(currentProject.id);
            setFeedbackData(res.data || res);
        } catch (e) { logger.warn('Library', 'Feedback load failed:', e.message); }
    }, [currentProject?.id]);

    useEffect(() => { loadTree(); loadStats(); loadFeedback(); }, [loadTree, loadStats, loadFeedback]);

    /** 提取入库/编辑后刷新技法树与统计 */
    const reload = useCallback(async () => {
        await loadTree();
        await loadStats();
    }, [loadTree, loadStats]);

    const handleSelectTech = async (id) => { setSelectedTech(id); await loadTechnique(id); };

    const handleSaveField = async (field, value) => {
        if (!selectedTech) return;
        try { await libraryApi.updateTechnique(selectedTech, { [field]: Array.isArray(value) ? value : value }); await loadTechnique(selectedTech); setEditingField(null); }
        catch (e) { logger.warn('Library', 'Save failed:', e.message); }
    };

    const handleToggleDisabled = async (id, current) => {
        try { await libraryApi.updateMeta(id, { auto_disabled: !current }); await loadTechnique(id); loadStats(); loadTree(); }
        catch (e) { logger.warn('Library', 'Toggle failed:', e.message); }
    };

    const handleResetMeta = async (id) => {
        try { await libraryApi.resetMeta(id); await loadTechnique(id); loadStats(); }
        catch (e) { logger.warn('Library', 'Reset failed:', e.message); }
    };

    const expandAll = () => {
        const all = new Set();
        for (const [dept, subs] of Object.entries(treeData)) { all.add(dept); for (const sub of Object.keys(subs)) all.add(`${dept}/${sub}`); }
        setExpandedNodes(all);
    };
    const collapseAll = () => setExpandedNodes(new Set());
    const closeSearch = () => { setShowSearch(false); setSearchResults([]); };

    const depthTree = Object.entries(treeData).reduce((acc, [dept, subs]) => {
        const depth = Object.entries(DEPTH_COLORS).find(([_, depts]) => depts === dept) ? 'micro' :
            ['00_叙事之魂部', '01_顶层设计部', '06_世界构建部'].includes(dept) ? 'macro' : 'meso';
        if (!acc[depth]) acc[depth] = {};
        acc[depth][dept] = subs;
        return acc;
    }, {});

    return {
        currentProject, treeData, stats, expandedNodes, selectedTech, techDetail,
        searchQuery, setSearchQuery, searchResults, modeFilter, setModeFilter,
        editingField, setEditingField, editValue, setEditValue, showSearch,
        mode, viewMode, setViewMode, depthTree, feedbackData, loadFeedback,
        toggleNode, loadTree, handleSelectTech, handleSaveField,
        handleToggleDisabled, handleResetMeta, expandAll, collapseAll, doSearch, closeSearch, reload,
    };
}
