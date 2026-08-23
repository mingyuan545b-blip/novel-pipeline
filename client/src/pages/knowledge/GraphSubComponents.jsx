import './knowledge.css';

const CATEGORY_COLORS = {
    'org-hierarchy': '#ffa502', 'org-member': '#1e90ff',
    'org-hostile': '#ff4757', 'org-friendly': '#2ed573',
    'char-hostile': '#ff6348', 'char-friendly': '#7bed9f',
    'family': '#ff6b9d', 'hierarchy': '#eccc68',
    'other': '#555'
};
const TYPE_COLORS = { character: '#00f0ff', organization: '#ffa502', worldview: '#a55eea' };
const TYPE_LABELS = { character: '👤 人物', organization: '🏛 组织', worldview: '🌍 世界观' };
const CATEGORY_LABELS = {
    'org-hierarchy': '🏛 组织架构', 'org-member': '👥 组织人员',
    'org-hostile': '⚔ 组织对抗', 'org-friendly': '🤝 组织结盟',
    'char-hostile': '⚔ 人物对抗', 'char-friendly': '🤝 人物结盟',
    'family': '❤ 亲属', 'hierarchy': '📎 隶属',
    'other': '○ 其他'
};

export { CATEGORY_COLORS, TYPE_COLORS, TYPE_LABELS, CATEGORY_LABELS };

export function GraphSvgCanvas({ svgRef, dragging, positions, filteredEdges, filteredNodes, selectedNode, hoveredEdge, onMouseDown, onMouseMove, onMouseUp, onEdgeHover, onNodeSelect }) {
    return (
        <div className="graph-svg-container">
            <svg ref={svgRef} width="100%" viewBox="0 0 900 600" className="graph-svg"
                style={{ cursor: dragging ? 'grabbing' : 'default' }}
                onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
                <defs>
                    {Object.entries(CATEGORY_COLORS).map(([k, c]) => (
                        <marker key={k} id={`arrow-${k}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                            <path d="M0,0 L8,3 L0,6" fill={c} />
                        </marker>
                    ))}
                </defs>
                {filteredEdges.map(e => <GraphEdge key={e.id} edge={e} positions={positions} selectedNode={selectedNode} hoveredEdge={hoveredEdge} onHover={onEdgeHover} />)}
                {filteredNodes.map(n => <GraphNode key={n.id} node={n} positions={positions} selectedNode={selectedNode} filteredEdges={filteredEdges} onMouseDown={onMouseDown} onSelect={onNodeSelect} />)}
            </svg>
        </div>
    );
}

function GraphEdge({ edge, positions, selectedNode, hoveredEdge, onHover }) {
    const s = positions[edge.source], t = positions[edge.target];
    if (!s || !t) return null;
    const color = CATEGORY_COLORS[edge.category] || CATEGORY_COLORS.neutral;
    const isHovered = hoveredEdge === edge.id;
    const isSelected = selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
    const opacity = (selectedNode && !isSelected) ? 0.15 : (isHovered ? 1 : 0.6);
    const width = isHovered || isSelected ? 2.5 : 1.5;
    const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;

    return (
        <g>
            <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={color} strokeWidth={width} opacity={opacity}
                strokeDasharray={edge.category === 'hostile' ? '8,4' : (edge.category === 'hierarchy' ? '4,2' : 'none')}
                markerEnd={`url(#arrow-${edge.category})`}
                onMouseEnter={() => onHover(edge.id)}
                onMouseLeave={() => onHover(null)}
                style={{ cursor: 'pointer' }} />
            {(isHovered || isSelected) && (
                <text x={mx} y={my - 6} textAnchor="middle" fill={color} fontSize="10" fontWeight="600"
                    style={{ pointerEvents: 'none', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
                    {edge.label}
                </text>
            )}
        </g>
    );
}

function GraphNode({ node, positions, selectedNode, filteredEdges, onMouseDown, onSelect }) {
    const p = positions[node.id];
    if (!p) return null;
    const color = TYPE_COLORS[node.type] || '#888';
    const isSelected = selectedNode === node.id;
    const isConnected = selectedNode && filteredEdges.some(e =>
        (e.source === selectedNode && e.target === node.id) || (e.target === selectedNode && e.source === node.id)
    );
    const opacity = (selectedNode && !isSelected && !isConnected) ? 0.25 : 1;
    const r = node.type === 'organization' ? 24 : (node.type === 'worldview' ? 20 : 18);

    return (
        <g style={{ cursor: 'grab', opacity }}
            onMouseDown={() => onMouseDown(node.id)}
            onClick={() => onSelect(isSelected ? null : node.id)}>
            {node.type === 'organization' ? (
                <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx={4}
                    fill={color + '22'} stroke={color} strokeWidth={isSelected ? 3 : 1.5} />
            ) : (
                <circle cx={p.x} cy={p.y} r={r}
                    fill={color + '22'} stroke={color} strokeWidth={isSelected ? 3 : 1.5} />
            )}
            <text x={p.x} y={p.y + 4} textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="600"
                style={{ pointerEvents: 'none', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
                {node.label.length > 4 ? node.label.substring(0, 4) : node.label}
            </text>
            <text x={p.x} y={p.y + r + 14} textAnchor="middle" fill={color} fontSize="9"
                style={{ pointerEvents: 'none' }}>
                {TYPE_LABELS[node.type] || node.type}
            </text>
        </g>
    );
}

export function GraphSidebar({ filteredNodes, filteredEdges, selectedNode }) {
    return (
        <div className="graph-sidebar">
            <div className="graph-legend-card">
                <h4 className="graph-legend-title">图例</h4>
                <div className="graph-legend-list">
                    {Object.entries(TYPE_LABELS).map(([k, l]) => (
                        <div key={k} className="graph-legend-item">
                            <div className="graph-legend-dot" style={{ borderRadius: k === 'organization' ? 2 : '50%', background: TYPE_COLORS[k] + '44', border: `1.5px solid ${TYPE_COLORS[k]}` }} />
                            <span>{l}</span>
                        </div>
                    ))}
                    <div className="graph-legend-divider" />
                    {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
                        <div key={k} className="graph-legend-item">
                            <div className="graph-legend-line" style={{ background: CATEGORY_COLORS[k] }} />
                            <span>{l}</span>
                        </div>
                    ))}
                </div>
            </div>
            {selectedNode && <GraphNodeDetail filteredNodes={filteredNodes} filteredEdges={filteredEdges} selectedNode={selectedNode} />}
        </div>
    );
}

function GraphNodeDetail({ filteredNodes, filteredEdges, selectedNode }) {
    const node = filteredNodes.find(n => n.id === selectedNode);
    if (!node) return null;
    const relEdges = filteredEdges.filter(e => e.source === selectedNode || e.target === selectedNode);

    return (
        <div className="graph-node-detail">
            <h4 className="graph-node-detail-name" style={{ color: TYPE_COLORS[node.type] || 'var(--text-primary)' }}>{node.label}</h4>
            {node.faction && <div className="graph-node-detail-meta">阵营: {node.faction}</div>}
            {node.role && <div className="graph-node-detail-meta">身份: {node.role}</div>}
            {node.description && <div className="graph-node-detail-desc">{node.description}</div>}
            {relEdges.length > 0 && (
                <div>
                    <div className="graph-node-rel-title">关系 ({relEdges.length})</div>
                    {relEdges.map(e => {
                        const otherId = e.source === selectedNode ? e.target : e.source;
                        const other = filteredNodes.find(n => n.id === otherId);
                        const color = CATEGORY_COLORS[e.category] || CATEGORY_COLORS.neutral;
                        return (
                            <div key={e.id} className="graph-node-rel-item" style={{ background: color + '11', borderLeft: `3px solid ${color}` }}>
                                <div className="graph-node-rel-name">{other?.label || '?'} <span style={{ color }}>{e.label}</span></div>
                                {e.detail && <div className="graph-node-rel-detail">{e.detail.substring(0, 100)}</div>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
