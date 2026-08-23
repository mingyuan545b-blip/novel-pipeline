import { useMemo, useCallback } from 'react';
import useContextMapState from './useContextMapState';
import { computeLayout, curvePath } from './mindMapLayout';
import MapNode from './MapNode';
import s from './ContextMapPage.module.css';

const STATUS_COLORS = { healthy: '#22c55e', warning: '#f59e0b', error: '#ef4444', empty: '#475569' };
const LINE_STATUS = { healthy: s.connectionLineHealthy, warning: s.connectionLineWarning, error: s.connectionLineError, empty: s.connectionLineEmpty };

/** 类别开关标签(顶部工具栏) */
const GROUP_FILTERS = [
    { key: 'worldview', label: '🌍 世界观', branchKeys: ['worldview-macro', 'worldview-meso', 'worldview-micro'] },
    { key: 'character', label: '👤 角色', branchKeys: ['character-protagonist', 'character-supporting', 'character-relationship'] },
    { key: 'bindable', label: '🗡 装备/功法', branchKeys: ['equipment', 'technique'] },
    { key: 'foreshadowing', label: '🪝 伏笔', branchKeys: ['foreshadowing'] },
    { key: 'knowledge', label: '📚 知识库', branchKeys: ['knowledge-access'] },
];

export default function ContextMapPage() {
    const state = useContextMapState();
    const {
        currentProject, mapData, loading, error,
        expandedBranches, selectedNode, chapterNumber, categoryFilters,
        loadMap, toggleBranch, setSelectedNode, setChapterNumber,
        toggleCategoryFilter, setBranchDepth, setItemDepth: _setItemDepth, removeOverride: _removeOverride,
    } = state;

    const layout = useMemo(() => {
        if (!mapData?.root) return { nodes: [], connections: [], canvasSize: { w: 1200, h: 800 } };
        return computeLayout(mapData.root, expandedBranches, categoryFilters);
    }, [mapData, expandedBranches, categoryFilters]);

    const handleSelectNode = useCallback((node) => {
        setSelectedNode(node.type === 'group' ? node : node);
    }, [setSelectedNode]);

    const handleSetDepth = useCallback((branchId, depth) => {
        setBranchDepth(branchId, depth);
    }, [setBranchDepth]);

    if (!currentProject) {
        return <div className={s.emptyState}><div className={s.emptyIcon}>🗺</div><div>请先选择项目</div></div>;
    }

    const summary = mapData?.summary;

    return (
        <div className={s.pageContainer}>
            <div className={s.pageHeader}>
                <div>
                    <h1 className={s.pageTitle}>🗺 上下文电路图</h1>
                    <p className={s.pageSubtitle}>可视化素材加载状态，一眼定位数据缺失和深度问题</p>
                </div>
                <div className={s.headerControls}>
                    <div className={s.chapterSelector}>
                        <span className={s.chapterLabel}>章节</span>
                        <input className={s.chapterInput} type="number" value={chapterNumber}
                            onChange={e => setChapterNumber(parseInt(e.target.value) || 1)} min={1} />
                    </div>
                    <button className={`${s.refreshBtn} ${loading ? s.refreshBtnDisabled : ''}`}
                        onClick={loadMap} disabled={loading}>
                        {loading ? '⏳' : '🔄'} 刷新
                    </button>
                </div>
            </div>

            {summary && <SummaryBar summary={summary} colors={STATUS_COLORS} />}

            {/* 类别开关工具栏 */}
            <div className={s.filterBar}>
                {GROUP_FILTERS.map(gf => {
                    const allOn = gf.branchKeys.every(k => categoryFilters[k]);
                    const someOn = gf.branchKeys.some(k => categoryFilters[k]);
                    return (
                        <button key={gf.key}
                            className={`${s.filterChip} ${allOn ? s.filterChipOn : someOn ? s.filterChipPartial : s.filterChipOff}`}
                            onClick={() => gf.branchKeys.forEach(k => { if (categoryFilters[k] !== !allOn) toggleCategoryFilter(k); })}>
                            {gf.label}
                        </button>
                    );
                })}
            </div>

            {error && <div className={s.errorMessage}>错误: {error}</div>}

            <div className={s.mapCanvas}>
                <div className={s.mapInner} style={{ width: layout.canvasSize.w, height: layout.canvasSize.h }}>
                    <svg className={s.svgLayer} width={layout.canvasSize.w} height={layout.canvasSize.h}>
                        {layout.connections.map((conn, i) => (
                            <path key={i} d={curvePath(conn.from, conn.to)}
                                className={`${s.connectionLine} ${LINE_STATUS[conn.status] || LINE_STATUS.empty}`} />
                        ))}
                    </svg>
                    {layout.nodes.map(node => (
                        <MapNode key={node.id} node={node}
                            isSelected={selectedNode?.id === node.id}
                            isExpanded={expandedBranches.has(node.id)}
                            onSelect={() => handleSelectNode(node)}
                            onToggle={() => node.type === 'group' && toggleBranch(node.id)}
                            onSetDepth={handleSetDepth} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function SummaryBar({ summary, colors }) {
    const items = [
        { status: 'healthy', count: summary.healthy, label: '正常' },
        { status: 'warning', count: summary.warning, label: '深度不足' },
        { status: 'error', count: summary.error, label: '缺失' },
        { status: 'empty', count: summary.empty, label: '无数据' },
    ];
    return (
        <div className={s.summaryBar}>
            {items.map(item => (
                <div key={item.status} className={s.summaryItem}>
                    <span className={s.summaryDot} style={{ background: colors[item.status] }} />
                    <span className={s.summaryCount} style={{ color: colors[item.status] }}>{item.count}</span>
                    {item.label}
                </div>
            ))}
        </div>
    );
}
