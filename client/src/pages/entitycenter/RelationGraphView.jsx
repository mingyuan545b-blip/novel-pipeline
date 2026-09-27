/**
 * RelationGraphView.jsx — 人物关系网络图（自研 SVG，无第三方图库）
 * 中心人物居中，直接关系按类型成簇放射；点击任一人物即以他为中心重新展开。
 */
import { useMemo } from 'react';
import { groupByType, ringLayout, edgeGeometry, typeColor } from './relationGraphLayout';
import './relationGraph.css';

const TYPES = ['family', 'lover', 'master', 'subordinate', 'mentor', 'ally', 'rival', 'enemy', 'other'];
const W = 960, H = 640, CX = W / 2, CY = 288, R = 218;

const initials = (name) => (name || '?').replace(/[（(].*?[)）]/g, '').slice(0, 2);

export default function RelationGraphView({ center, direct, onPick }) {
    const groups = useMemo(() => groupByType(direct), [direct]);
    const nodes = useMemo(() => ringLayout(groups, { cx: CX, cy: CY, r: R }), [groups]);
    const centerPt = { x: CX, y: CY };

    if (!nodes.length) {
        return <div className="cb-empty">该角色暂无可展示的关系；换一个人试试</div>;
    }

    return (
        <div className="rg-wrap">
            <svg className="rg-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="人物关系图">
                <defs>
                    {TYPES.map(t => (
                        <marker key={t} id={`rg-arrow-${t}`} viewBox="0 0 10 10" refX="9" refY="5"
                            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                            <path d="M 0 1 L 9 5 L 0 9 z" fill={typeColor(t)} />
                        </marker>
                    ))}
                </defs>

                {nodes.map((n) => n.edges.map((e, i) => {
                    const t = e.rel.relType || 'other';
                    const g = edgeGeometry(centerPt, n, i, n.edges.length);
                    const sx = CX + 36 * Math.cos(n.angle), sy = CY + 36 * Math.sin(n.angle);
                    return (
                        <g key={n.other.id + '-' + e.rel.id}>
                            <line x1={sx} y1={sy} x2={g.x2} y2={g.y2} className="rg-edge"
                                stroke={typeColor(t)} strokeDasharray={e.outgoing ? 'none' : '5 4'}
                                markerEnd={`url(#rg-arrow-${t})`} />
                            <text className="rg-edge-label" x={g.midX} y={g.midY} textAnchor="middle"
                                fill={typeColor(t)}>{e.rel.relLabel || ''}</text>
                        </g>
                    );
                }))}

                <g className="rg-node rg-node-center">
                    <circle cx={CX} cy={CY} r={38} fill="#111a2b" stroke="var(--neon-cyan)" strokeWidth="2.5" />
                    <text className="rg-initial" x={CX} y={CY + 5} textAnchor="middle">{initials(center.name)}</text>
                    <text className="rg-name-center" x={CX} y={CY - 50} textAnchor="middle">{center.name}</text>
                </g>

                {nodes.map(n => (
                    <g key={n.other.id} className="rg-node" role="button" tabIndex={0}
                        onClick={() => onPick(n.other.id, n.other.name)}
                        onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick(n.other.id, n.other.name); } }}>
                        <circle cx={n.x} cy={n.y} r={n.compound ? 26 : 22} fill="#0f1626" stroke={n.color} strokeWidth="2" />
                        <text className="rg-initial" x={n.x} y={n.y + 5} textAnchor="middle">{initials(n.other.name)}</text>
                        <text className="rg-name" x={n.x} y={n.y + 40} textAnchor="middle">{n.other.name}</text>
                        {n.compound && (
                            <text className="rg-compound" x={n.x} y={n.y - 30} textAnchor="middle">{n.edges.length} 条</text>
                        )}
                    </g>
                ))}
            </svg>

            <div className="rg-legend">
                {groups.map(g => (
                    <span key={g.key} className="rg-legend-item">
                        <span className="rg-legend-dot" style={{ background: g.color }} />{g.label} {g.items.length}
                    </span>
                ))}
            </div>
            <div className="rg-hint">点击任一人物 → 以他为中心展开关系；虚线=对方指向中心</div>
        </div>
    );
}
