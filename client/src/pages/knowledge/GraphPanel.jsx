import { useState } from 'react';
import { GraphSvgCanvas, GraphSidebar } from './GraphSubComponents';
import useGraphDragInteraction from './useGraphDragInteraction';
import './knowledge.css';

const VIEW_TABS = [
    { key: 'all', label: '🌐 全部关系', color: '#00f0ff', filter: () => true },
    { key: 'org-member', label: '👥 组织人物依附', color: '#1e90ff', filter: e => e.category === 'org-member' || e.category === 'org-hierarchy' },
    { key: 'org-hierarchy', label: '🏛 组织结构', color: '#ffa502', filter: e => e.category === 'org-hierarchy' },
    { key: 'char-hostile', label: '⚔ 人物对抗', color: '#ff6348', filter: e => e.category === 'char-hostile' },
    { key: 'char-friendly', label: '🤝 人物结盟', color: '#7bed9f', filter: e => e.category === 'char-friendly' },
    { key: 'org-hostile', label: '⚔ 组织对抗', color: '#ff4757', filter: e => e.category === 'org-hostile' },
    { key: 'org-friendly', label: '🤝 组织结盟', color: '#2ed573', filter: e => e.category === 'org-friendly' },
    { key: 'family', label: '❤ 亲属好友师徒', color: '#ff6b9d', filter: e => e.category === 'family' },
    { key: 'hierarchy', label: '📎 隶属关系', color: '#eccc68', filter: e => e.category === 'hierarchy' },
    { key: 'other', label: '○ 其他', color: '#555', filter: e => e.category === 'other' }
];

export default function GraphPanel({ graph, onRefresh }) {
    const [viewMode, setViewMode] = useState('all');
    const [selectedNode, setSelectedNode] = useState(null);
    const [hoveredEdge, setHoveredEdge] = useState(null);

    // 防御性处理：确保 nodes 和 edges 是数组
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph?.edges) ? graph.edges : [];

    const filteredEdges = edges.filter(e => {
        const tab = VIEW_TABS.find(t => t.key === viewMode);
        return tab ? tab.filter(e) : true;
    });
    const activeNodeIds = new Set();
    filteredEdges.forEach(e => { activeNodeIds.add(e.source); activeNodeIds.add(e.target); });
    const filteredNodes = nodes.filter(n => activeNodeIds.has(n.id));
    const filteredCount = filteredNodes.length;
    const filteredEdgeCount = filteredEdges.length;

    const { svgRef, positions, dragging, handleMouseDown, handleMouseMove, handleMouseUp } = useGraphDragInteraction({
        graph, filteredNodes, filteredEdges, filteredCount, filteredEdgeCount, viewMode
    });

    if (!graph) return <div className="knowledge-loading-placeholder">加载中...</div>;

    return (
        <div>
            <div className="graph-toolbar">
                <div className="graph-stats-badge">
                    节点: <strong>{filteredNodes.length}</strong> | 连线: <strong>{filteredEdges.length}</strong>
                </div>
                <div className="cyber-tabs" style={{ flexWrap: 'wrap' }}>
                    {VIEW_TABS.map(tab => {
                        const count = edges.filter(e => tab.filter(e)).length;
                        return (
                            <button key={tab.key} className={`cyber-tab ${viewMode === tab.key ? 'cyber-tab-active' : ''}`}
                                onClick={() => setViewMode(tab.key)}
                                style={viewMode === tab.key ? { borderColor: tab.color, color: tab.color } : { opacity: count > 0 ? 1 : 0.5 }}>
                                {tab.label}
                                <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>({count})</span>
                            </button>
                        );
                    })}
                </div>
                <button className="cyber-btn cyber-btn-sm" onClick={onRefresh}>刷新</button>
            </div>

            <div className="graph-main-grid">
                <GraphSvgCanvas svgRef={svgRef} dragging={dragging} positions={positions}
                    filteredEdges={filteredEdges} filteredNodes={filteredNodes}
                    selectedNode={selectedNode} hoveredEdge={hoveredEdge}
                    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
                    onEdgeHover={setHoveredEdge} onNodeSelect={setSelectedNode} />
                <GraphSidebar filteredNodes={filteredNodes} filteredEdges={filteredEdges}
                    selectedNode={selectedNode} />
            </div>
        </div>
    );
}
