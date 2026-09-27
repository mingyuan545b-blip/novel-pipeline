/**
 * RelationGraphView.jsx — 人物关系网络图（自研 SVG，无第三方图库）
 *
 * 可读性要点（解决"标签互相覆盖"）：
 *   1. 一对人物只画**一条**连接线（多条关系合并为一个标签，用 · 分隔），不再并排多线；
 *   2. 边标签**沿径向旋转**（不再横向堆叠），左右半区自动翻转避免倒字；
 *   3. 中心人物名放进圆内，避免被上方连线/标签穿过；
 *   4. 节点名沿径向外移，放大画布，降低相邻节点名互压。
 * 点击任一人物即以他为中心重新展开。
 */
import { useMemo } from 'react';
import { groupByType, ringLayout, typeColor, typeLabel } from './relationGraphLayout';
import './relationGraph.css';

const TYPES = ['family', 'lover', 'master', 'subordinate', 'mentor', 'ally', 'rival', 'enemy', 'other'];
const W = 1120, H = 720, CX = W / 2, CY = H / 2, R = 250;
const ARROW_GAP = 40;   // 连线终点留出节点半径

const initials = (name) => (name || '?').replace(/[（(].*?[)）]/g, '').slice(0, 2);
const bundleLabel = (edges) => edges
    .map(e => e.rel.relLabel || typeLabel(e.rel.relType))
    .filter(Boolean).join(' · ');
const primaryType = (edges) => edges[0]?.rel?.relType || 'other';

function EdgeLabel({ node }) {
    const label = bundleLabel(node.edges);
    if (!label) return null;
    const d = R * 0.52;
    const x = CX + d * Math.cos(node.angle);
    const y = CY + d * Math.sin(node.angle);
    const flip = Math.cos(node.angle) < 0;
    const deg = (node.angle * 180) / Math.PI + (flip ? 180 : 0);
    return (
        <text className="rg-edge-label" x={x} y={y} fill={typeColor(primaryType(node.edges))}
            transform={`rotate(${deg} ${x} ${y})`} textAnchor={flip ? 'end' : 'start'} dominantBaseline="middle">
            {label.length > 16 ? label.slice(0, 15) + '…' : label}
        </text>
    );
}

export default function RelationGraphView({ center, direct, onPick }) {
    const groups = useMemo(() => groupByType(direct), [direct]);
    const nodes = useMemo(() => ringLayout(groups, { cx: CX, cy: CY, r: R }), [groups]);

    if (!nodes.length) return <div className="cb-empty">该角色暂无可展示的关系；换一个人试试</div>;

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

                {nodes.map(n => {
                    const t = primaryType(n.edges);
                    const sx = CX + ARROW_GAP * Math.cos(n.angle), sy = CY + ARROW_GAP * Math.sin(n.angle);
                    const ex = CX + (n.radius - ARROW_GAP * 0.6) * Math.cos(n.angle);
                    const ey = CY + (n.radius - ARROW_GAP * 0.6) * Math.sin(n.angle);
                    return (
                        <line key={n.other.id} x1={sx} y1={sy} x2={ex} y2={ey} className="rg-edge"
                            stroke={typeColor(t)} markerEnd={`url(#rg-arrow-${t})`} />
                    );
                })}
                {nodes.map(n => <EdgeLabel key={'l-' + n.other.id} node={n} />)}

                <g className="rg-node rg-node-center">
                    <circle cx={CX} cy={CY} r={42} fill="#111a2b" stroke="var(--neon-cyan)" strokeWidth="2.5" />
                    <text className="rg-initial" x={CX} y={CY - 2} textAnchor="middle">{initials(center.name)}</text>
                    <text className="rg-name-center" x={CX} y={CY + 20} textAnchor="middle">{center.name}</text>
                </g>

                {nodes.map(n => {
                    const outX = n.x + (n.radius > 0 ? 0 : 0) + 34 * Math.cos(n.angle);
                    const outY = n.y + 34 * Math.sin(n.angle);
                    const flip = Math.cos(n.angle) < 0;
                    return (
                        <g key={n.other.id} className="rg-node" role="button" tabIndex={0}
                            onClick={() => onPick(n.other.id, n.other.name)}
                            onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick(n.other.id, n.other.name); } }}>
                            <title>{n.other.name + '：' + bundleLabel(n.edges)}</title>
                            <circle cx={n.x} cy={n.y} r={n.compound ? 26 : 22} fill="#0f1626" stroke={n.color} strokeWidth="2" />
                            <text className="rg-initial" x={n.x} y={n.y + 5} textAnchor="middle">{initials(n.other.name)}</text>
                            {n.compound && <text className="rg-compound" x={n.x + 22} y={n.y - 20} textAnchor="middle">{n.edges.length}</text>}
                            <text className="rg-name" x={outX} y={outY + 4} textAnchor={flip ? 'end' : 'start'}>{n.other.name}</text>
                        </g>
                    );
                })}
            </svg>

            <div className="rg-legend">
                {groups.map(g => (
                    <span key={g.key} className="rg-legend-item">
                        <span className="rg-legend-dot" style={{ background: g.color }} />{g.label} {g.items.length}
                    </span>
                ))}
            </div>
            <div className="rg-hint">点击任一人物 → 以他为中心展开关系；一对人物只画一条线，标签沿连线方向排布（多条关系合并显示）</div>
        </div>
    );
}
