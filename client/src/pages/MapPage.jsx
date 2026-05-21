import { useState, useEffect, useRef, useCallback } from 'react';
import useAppStore from '../store/useAppStore';
import { mapApi } from '../services/api';

const LEVEL_CONFIG = {
    'universe': { label: '宇宙', icon: '🌌', bg: '#050510', regionFill: 'rgba(60,60,180,0.12)', regionStroke: 'rgba(80,80,200,0.4)', textColor: '#8888ff', w: 400, h: 300, steps: 16, variation: 0.25 },
    'star-domain': { label: '星域', icon: '✦', bg: '#080820', regionFill: 'rgba(80,80,200,0.15)', regionStroke: 'rgba(100,100,220,0.5)', textColor: '#aaaaff', w: 320, h: 240, steps: 14, variation: 0.28 },
    'planet': { label: '星球', icon: '🪐', bg: '#061020', regionFill: 'rgba(40,120,200,0.15)', regionStroke: 'rgba(60,140,220,0.5)', textColor: '#66bbff', w: 260, h: 200, steps: 12, variation: 0.22 },
    'continent': { label: '州/大陆', icon: '🏔', bg: '#061808', regionFill: 'rgba(40,160,60,0.15)', regionStroke: 'rgba(60,180,80,0.5)', textColor: '#66dd66', w: 220, h: 170, steps: 10, variation: 0.3 },
    'country': { label: '国/区域', icon: '🏰', bg: '#181208', regionFill: 'rgba(180,140,40,0.15)', regionStroke: 'rgba(200,160,60,0.5)', textColor: '#ddaa44', w: 180, h: 140, steps: 8, variation: 0.35 },
    'city': { label: '城市/地点', icon: '🏘', bg: '#180808', regionFill: 'rgba(180,60,40,0.15)', regionStroke: 'rgba(200,80,60,0.5)', textColor: '#dd6644', w: 140, h: 110, steps: 7, variation: 0.4 }
};

const FACTION_PALETTE = [
    { fill: 'rgba(255,60,60,0.2)', stroke: '#ff4444', text: '#ff6666' },
    { fill: 'rgba(60,180,60,0.2)', stroke: '#44cc44', text: '#66dd66' },
    { fill: 'rgba(60,100,255,0.2)', stroke: '#4466ff', text: '#6688ff' },
    { fill: 'rgba(255,200,40,0.2)', stroke: '#ddaa22', text: '#eebb44' },
    { fill: 'rgba(200,60,200,0.2)', stroke: '#cc44cc', text: '#dd66dd' },
    { fill: 'rgba(40,200,200,0.2)', stroke: '#22cccc', text: '#44dddd' },
];

function getFactionColorMap(factions) {
    const map = {};
    factions.forEach((name, i) => { map[name] = FACTION_PALETTE[i % FACTION_PALETTE.length]; });
    return map;
}

function generateRegionPath(cx, cy, w, h, seed, steps = 12, variation = 0.3) {
    const points = [];
    const rng = seed ? (s => { let x = Math.sin(s) * 10000; return x - Math.floor(x); }) : null;
    for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const baseR = Math.min(w, h) / 2;
        const v = rng ? (rng(seed + i * 7) * variation * 2 + (1 - variation)) : (1 - variation / 2 + Math.sin(i * 2.5) * variation / 2);
        const r = baseR * v;
        const x = cx + Math.cos(angle) * r * (w / Math.min(w, h));
        const y = cy + Math.sin(angle) * r * (h / Math.min(w, h));
        points.push({ x, y });
    }
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpx = (prev.x + curr.x) / 2;
        const cpy = (prev.y + curr.y) / 2;
        d += ` Q ${prev.x + (curr.x - prev.x) * 0.3} ${prev.y + (curr.y - prev.y) * 0.3} ${cpx} ${cpy}`;
    }
    d += ' Z';
    return d;
}

export default function MapPage() {
    const { currentProject } = useAppStore();
    const [tree, setTree] = useState(null);
    const [levels, setLevels] = useState([]);
    const [currentNode, setCurrentNode] = useState(null);
    const [children, setChildren] = useState([]);
    const [breadcrumb, setBreadcrumb] = useState([]);
    const [selectedChild, setSelectedChild] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [editNode, setEditNode] = useState(null);
    const [newNode, setNewNode] = useState({ name: '', description: '', level: '', color: '', factionName: '' });
    const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const svgRef = useRef(null);

    useEffect(() => {
        mapApi.getLevels().then(res => setLevels(res.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        if (currentProject) loadTree();
    }, [currentProject]);

    const loadTree = async () => {
        if (!currentProject) return null;
        try {
            const res = await mapApi.getTree(currentProject.id);
            if (res.data) {
                setTree(res.data);
                navigateToNode(res.data, [], res.data);
                return res.data;
            }
        } catch (e) { console.error(e); }
        return null;
    };

    const navigateToNode = (node, path, treeData) => {
        const t = treeData || tree;
        setCurrentNode(node);
        setBreadcrumb(path);
        setSelectedChild(null);
        setShowCreate(false);
        setShowEdit(false);
        if (t) {
            const childList = findChildren(t, node.id);
            setChildren(childList);
        }
    };

    const findChildren = (root, parentId) => {
        if (root.id === parentId) return root.children || [];
        for (const child of (root.children || [])) {
            const found = findChildren(child, parentId);
            if (found) return found;
        }
        return null;
    };

    const findNode = (root, nodeId) => {
        if (root.id === nodeId) return root;
        for (const child of (root.children || [])) {
            const found = findNode(child, nodeId);
            if (found) return found;
        }
        return null;
    };

    const [dragging, setDragging] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const handleNodeMouseDown = (e, child) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (!svgRect) return;
        const scaleX = 1200 / svgRect.width;
        const scaleY = 800 / svgRect.height;
        const mx = (e.clientX - svgRect.left) * scaleX;
        const my = (e.clientY - svgRect.top) * scaleY;
        const nodeX = child.x || 400;
        const nodeY = child.y || 300;
        const transformedX = (mx - viewTransform.x) / viewTransform.scale;
        const transformedY = (my - viewTransform.y) / viewTransform.scale;
        setDragging(child);
        setDragOffset({ x: transformedX - nodeX, y: transformedY - nodeY });
        setSelectedChild(child);
    };

    const handleSvgMouseMove = (e) => {
        if (dragging) {
            const svgRect = svgRef.current?.getBoundingClientRect();
            if (!svgRect) return;
            const scaleX = 1200 / svgRect.width;
            const scaleY = 800 / svgRect.height;
            const mx = (e.clientX - svgRect.left) * scaleX;
            const my = (e.clientY - svgRect.top) * scaleY;
            const transformedX = (mx - viewTransform.x) / viewTransform.scale;
            const transformedY = (my - viewTransform.y) / viewTransform.scale;
            const newX = Math.round(transformedX - dragOffset.x);
            const newY = Math.round(transformedY - dragOffset.y);
            setChildren(prev => prev.map(c => c.id === dragging.id ? { ...c, x: newX, y: newY } : c));
        } else if (isPanning) {
            setViewTransform(prev => ({ ...prev, x: e.clientX - panStart.x, y: e.clientY - panStart.y }));
        }
    };

    const handleSvgMouseUp = async () => {
        if (dragging) {
            const child = children.find(c => c.id === dragging.id);
            if (child && currentProject) {
                try {
                    await mapApi.updateNode(child.id, { projectId: currentProject.id, x: child.x, y: child.y });
                } catch (e) { console.error(e); }
            }
            setDragging(null);
        }
        setIsPanning(false);
    };

    const handleZoomIn = (child) => {
        const path = [...breadcrumb, { id: currentNode.id, name: currentNode.name, level: currentNode.level }];
        navigateToNode(child, path, tree);
        setViewTransform({ x: 0, y: 0, scale: 1 });
    };

    const handleZoomOut = () => {
        if (breadcrumb.length === 0) return;
        const targetId = breadcrumb[breadcrumb.length - 1].id;
        const newPath = breadcrumb.slice(0, -1);
        const node = findNode(tree, targetId);
        if (node) navigateToNode(node, newPath, tree);
        setViewTransform({ x: 0, y: 0, scale: 1 });
    };

    const handleBreadcrumbClick = (index) => {
        if (index === -1) {
            navigateToNode(tree, [], tree);
        } else {
            const targetId = breadcrumb[index].id;
            const newPath = breadcrumb.slice(0, index);
            const node = findNode(tree, targetId);
            if (node) navigateToNode(node, newPath, tree);
        }
        setViewTransform({ x: 0, y: 0, scale: 1 });
    };

    const handleCreateNode = async () => {
        if (!currentProject || !currentNode) return;
        try {
            const parentLevelIdx = levels.findIndex(l => l.key === currentNode.level);
            const childLevel = parentLevelIdx < levels.length - 1 ? levels[parentLevelIdx + 1].key : 'city';
            await mapApi.createNode({
                projectId: currentProject.id, parentId: currentNode.id,
                name: newNode.name || '未命名', description: newNode.description || '',
                level: newNode.level || childLevel, color: newNode.color || '', factionName: newNode.factionName || ''
            });
            setNewNode({ name: '', description: '', level: '', color: '', factionName: '' });
            setShowCreate(false);
            const newTree = await loadTree();
            if (newTree) {
                const updatedNode = findNode(newTree, currentNode.id);
                if (updatedNode) navigateToNode(updatedNode, breadcrumb, newTree);
            }
        } catch (e) { alert('创建失败: ' + e.message); }
    };

    const handleUpdateNode = async () => {
        if (!currentProject || !editNode) return;
        try {
            await mapApi.updateNode(editNode.id, {
                projectId: currentProject.id, name: editNode.name, description: editNode.description,
                color: editNode.color, factionName: editNode.factionName
            });
            setShowEdit(false); setEditNode(null);
            await loadTree();
        } catch (e) { alert('更新失败: ' + e.message); }
    };

    const handleDeleteNode = async (nodeId) => {
        if (!currentProject) return;
        if (!confirm('确定删除此区域及其所有子区域？')) return;
        try {
            await mapApi.deleteNode(nodeId, { params: { projectId: currentProject.id } });
            setSelectedChild(null);
            const newTree = await loadTree();
            if (newTree && currentNode) {
                const updatedNode = findNode(newTree, currentNode.id);
                if (updatedNode) navigateToNode(updatedNode, breadcrumb, newTree);
            }
        } catch (e) { alert('删除失败: ' + e.message); }
    };

    const handleImportMaterials = async () => {
        if (!currentProject || !currentNode) return;
        try {
            const res = await mapApi.importMaterials({ projectId: currentProject.id, parentId: currentNode.id });
            const { count, skipped, total } = res.data || {};
            let msg = '';
            if (count > 0 && skipped > 0) msg = `导入 ${count} 个新地点，${skipped} 个已存在跳过`;
            else if (count > 0) msg = `成功导入 ${count} 个地点`;
            else if (skipped > 0) msg = `${skipped} 个地点已存在于地图中，无新地点可导入`;
            else msg = '素材库中没有可导入的地点素材';
            alert(msg);
            const newTree = await loadTree();
            if (newTree) {
                const updatedNode = findNode(newTree, currentNode.id);
                if (updatedNode) navigateToNode(updatedNode, breadcrumb, newTree);
            }
        } catch (e) { alert('导入失败: ' + e.message); }
    };

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setViewTransform(prev => ({ ...prev, scale: Math.max(0.3, Math.min(3, prev.scale * delta)) }));
    }, []);

    const handleMouseDown = (e) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - viewTransform.x, y: e.clientY - viewTransform.y });
        }
    };

    const handleMouseUp = () => { handleSvgMouseUp(); };

    const getLevelLabel = (key) => levels.find(l => l.key === key)?.label || key;
    const getLevelIcon = (key) => levels.find(l => l.key === key)?.icon || '📍';

    const allFactions = [...new Set(children.map(c => c.factionName).filter(Boolean))];
    const factionColorMap = getFactionColorMap(allFactions);

    if (!currentProject) {
        return (
            <div>
                <div className="page-header"><h1 className="page-title">世界地图</h1><p className="page-subtitle">交互式世界观地图 | 层级缩放 | 势力版图</p></div>
                <div className="cyber-card cyber-empty"><div className="cyber-empty-icon">🗺</div><div>请先在仪表盘选择一个项目</div></div>
            </div>
        );
    }

    const cfg = currentNode ? (LEVEL_CONFIG[currentNode.level] || LEVEL_CONFIG['universe']) : LEVEL_CONFIG['universe'];

    return (
        <div>
            <div className="page-header"><h1 className="page-title">世界地图</h1><p className="page-subtitle">交互式世界观地图 | 拖拽移动节点 | 双击深入 | 滚轮缩放 | Alt+拖拽平移</p></div>

            <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 160px)' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div className="cyber-card" style={{ padding: '6px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <button className="cyber-btn cyber-btn-sm" onClick={() => handleBreadcrumbClick(-1)} style={{ color: breadcrumb.length === 0 ? cfg.textColor : 'var(--text-muted)', fontSize: 11 }}>🌌 宇宙</button>
                        {breadcrumb.map((b, i) => (
                            <span key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>›</span>
                                <button className="cyber-btn cyber-btn-sm" onClick={() => handleBreadcrumbClick(i)} style={{ color: i === breadcrumb.length - 1 ? cfg.textColor : 'var(--text-muted)', fontSize: 11 }}>{getLevelIcon(b.level)} {b.name}</button>
                            </span>
                        ))}
                        {currentNode && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>›</span>
                                <span style={{ color: cfg.textColor, fontWeight: 700, fontSize: 12 }}>{getLevelIcon(currentNode.level)} {currentNode.name}</span>
                            </span>
                        )}
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                            <button className="cyber-btn cyber-btn-sm" onClick={handleZoomOut} disabled={breadcrumb.length === 0} style={{ fontSize: 10 }}>↑ 上级</button>
                            <button className="cyber-btn cyber-btn-sm" onClick={() => setViewTransform(p => ({ ...p, scale: Math.min(3, p.scale * 1.2) }))} style={{ fontSize: 10 }}>＋</button>
                            <button className="cyber-btn cyber-btn-sm" onClick={() => setViewTransform(p => ({ ...p, scale: Math.max(0.3, p.scale * 0.8) }))} style={{ fontSize: 10 }}>－</button>
                            <button className="cyber-btn cyber-btn-sm" onClick={() => setViewTransform({ x: 0, y: 0, scale: 1 })} style={{ fontSize: 10 }}>⟲</button>
                        </div>
                    </div>

                    <div className="cyber-card" style={{ flex: 1, padding: 0, overflow: 'hidden', cursor: dragging ? 'grabbing' : (isPanning ? 'grabbing' : 'default') }}
                        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleSvgMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                        <svg ref={svgRef} viewBox="0 0 1200 800" width="100%" height="100%" style={{ background: cfg.bg }}>
                            <defs>
                                <pattern id="map-grid" width="80" height="80" patternUnits="userSpaceOnUse">
                                    <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
                                </pattern>
                                <filter id="glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                                <filter id="soft-glow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                                <filter id="core-glow"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                                <radialGradient id="galaxy-core" cx="50%" cy="50%"><stop offset="0%" stopColor="rgba(200,180,255,0.15)" /><stop offset="30%" stopColor="rgba(100,100,200,0.06)" /><stop offset="100%" stopColor="transparent" /></radialGradient>
                                <radialGradient id="nebula1" cx="30%" cy="40%"><stop offset="0%" stopColor="rgba(80,80,200,0.08)" /><stop offset="100%" stopColor="transparent" /></radialGradient>
                                <radialGradient id="nebula2" cx="70%" cy="60%"><stop offset="0%" stopColor="rgba(200,80,80,0.06)" /><stop offset="100%" stopColor="transparent" /></radialGradient>
                            </defs>
                            <rect width="1200" height="800" fill="url(#map-grid)" />
                            <rect width="1200" height="800" fill="url(#galaxy-core)" />
                            <rect width="1200" height="800" fill="url(#nebula1)" />
                            <rect width="1200" height="800" fill="url(#nebula2)" />

                            <g transform={`translate(${viewTransform.x},${viewTransform.y}) scale(${viewTransform.scale})`}>
                                {(() => {
                                    const connections = [];
                                    const childMap = {};
                                    children.forEach(c => { childMap[c.id] = c; });
                                    children.forEach(child => {
                                        const content = child.description || '';
                                        children.forEach(other => {
                                            if (child.id === other.id) return;
                                            if (content.includes(other.name) || content.includes(other.name.split(' - ')[0]) || content.includes(other.name.split('「')[0])) {
                                                const exists = connections.find(c =>
                                                    (c.from === child.id && c.to === other.id) || (c.from === other.id && c.to === child.id));
                                                if (!exists) connections.push({ from: child.id, to: other.id });
                                            }
                                        });
                                    });
                                    return connections.map((conn, i) => {
                                        const from = childMap[conn.from];
                                        const to = childMap[conn.to];
                                        if (!from || !to) return null;
                                        const x1 = from.x || 400, y1 = from.y || 300;
                                        const x2 = to.x || 400, y2 = to.y || 300;
                                        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
                                        const dx = x2 - x1, dy = y2 - y1;
                                        const cx1 = mx - dy * 0.15, cy1 = my + dx * 0.15;
                                        return (
                                            <path key={`conn-${i}`} d={`M ${x1} ${y1} Q ${cx1} ${cy1} ${x2} ${y2}`}
                                                fill="none" stroke="rgba(100,150,255,0.2)" strokeWidth="1"
                                                strokeDasharray="6,4" />
                                        );
                                    });
                                })()}

                                {children.map((child, idx) => {
                                    const cx = child.x || 400;
                                    const cy = child.y || 300;
                                    const childCfg = LEVEL_CONFIG[child.level] || LEVEL_CONFIG['country'];
                                    const w = child.width || childCfg.w;
                                    const h = child.height || childCfg.h;
                                    const isSelected = selectedChild?.id === child.id;
                                    const fColors = child.factionName ? factionColorMap[child.factionName] : null;
                                    const regionPath = generateRegionPath(cx, cy, w, h, child.id.charCodeAt(0) * 137 + idx * 53, childCfg.steps, childCfg.variation);
                                    const fill = fColors ? fColors.fill : childCfg.regionFill;
                                    const stroke = isSelected ? '#ffffff' : (fColors ? fColors.stroke : childCfg.regionStroke);
                                    const textFill = fColors ? fColors.text : childCfg.textColor;

                                    return (
                                        <g key={child.id}
                                            onMouseDown={(e) => handleNodeMouseDown(e, child)}
                                            onDoubleClick={(e) => { e.stopPropagation(); handleZoomIn(child); }}
                                            style={{ cursor: dragging?.id === child.id ? 'grabbing' : 'pointer' }}>

                                            <path d={regionPath}
                                                fill={fill}
                                                stroke={stroke}
                                                strokeWidth={isSelected ? 2.5 : 1.2}
                                                opacity={isSelected ? 1 : 0.85}
                                                filter={isSelected ? 'url(#glow)' : 'url(#soft-glow)'} />

                                            {fColors && (
                                                <path d={generateRegionPath(cx, cy, w + 16, h + 16, child.id.charCodeAt(0) * 137 + idx * 53 + 999, childCfg.steps, childCfg.variation)}
                                                    fill="none" stroke={fColors.stroke} strokeWidth="0.5"
                                                    strokeDasharray="8,4" opacity={0.3} />
                                            )}

                                            <text x={cx} y={cy - 8} textAnchor="middle" fill={textFill}
                                                fontSize={child.level === 'star-domain' || child.level === 'universe' ? 15 : (child.level === 'city' ? 11 : 13)}
                                                fontWeight={700} style={{ pointerEvents: 'none' }}>
                                                {getLevelIcon(child.level)} {child.name}
                                            </text>

                                            <text x={cx} y={cy + 10} textAnchor="middle" fill={childCfg.textColor + '88'}
                                                fontSize={8} style={{ pointerEvents: 'none' }}>
                                                {getLevelLabel(child.level)}
                                            </text>

                                            {child.factionName && (
                                                <g>
                                                    <rect x={cx - 40} y={cy + 18} width={80} height={16} rx={3}
                                                        fill={fColors ? `${fColors.stroke}33` : 'rgba(255,100,100,0.15)'}
                                                        stroke={fColors ? fColors.stroke : '#ff6666'} strokeWidth={0.5} />
                                                    <text x={cx} y={cy + 30} textAnchor="middle"
                                                        fill={fColors ? fColors.text : '#ff6666'} fontSize={9} style={{ pointerEvents: 'none' }}>
                                                        ⚔ {child.factionName}
                                                    </text>
                                                </g>
                                            )}

                                            {(child.children && child.children.length > 0) && (
                                                <g>
                                                    <circle cx={cx + w / 2 - 8} cy={cy - h / 2 + 8} r={9}
                                                        fill="rgba(0,180,255,0.2)" stroke="rgba(0,180,255,0.5)" strokeWidth={0.5} />
                                                    <text x={cx + w / 2 - 8} y={cy - h / 2 + 12} textAnchor="middle"
                                                        fill="rgba(0,180,255,0.9)" fontSize={9} style={{ pointerEvents: 'none' }}>
                                                        {child.children.length}
                                                    </text>
                                                </g>
                                            )}
                                        </g>
                                    );
                                })}

                                {children.length === 0 && (
                                    <text x="600" y="400" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize={16}>
                                        双击区域深入查看 · 点击右侧 + 添加子区域
                                    </text>
                                )}
                            </g>

                            {allFactions.length > 0 && (
                                <g transform={`translate(16, 16)`}>
                                    <rect width={140} height={allFactions.length * 22 + 28} rx={6} fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
                                    <text x={10} y={18} fill="rgba(255,255,255,0.5)" fontSize={10} fontWeight={700}>势力图例</text>
                                    {allFactions.map((name, i) => (
                                        <g key={name} transform={`translate(10, ${30 + i * 22})`}>
                                            <rect width={12} height={12} rx={2} fill={factionColorMap[name].fill} stroke={factionColorMap[name].stroke} strokeWidth={0.5} />
                                            <text x={18} y={10} fill={factionColorMap[name].text} fontSize={10}>{name}</text>
                                        </g>
                                    ))}
                                </g>
                            )}
                        </svg>
                    </div>
                </div>

                <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="cyber-card" style={{ padding: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <button className="cyber-btn cyber-btn-primary" onClick={() => {
                                const parentLevelIdx = levels.findIndex(l => l.key === currentNode?.level);
                                const childLevel = parentLevelIdx < levels.length - 1 ? levels[parentLevelIdx + 1] : null;
                                setNewNode({ name: '', description: '', level: childLevel?.key || '', color: '', factionName: '' });
                                setShowCreate(true);
                            }} style={{ fontSize: 11, width: '100%' }}>+ 添加子区域</button>
                            <button className="cyber-btn" onClick={handleImportMaterials} style={{ fontSize: 11, width: '100%' }}>📥 从素材库导入地点</button>
                            <button className="cyber-btn" onClick={loadTree} style={{ fontSize: 11, width: '100%' }}>🔄 刷新</button>
                        </div>
                    </div>

                    {selectedChild && (
                        <div className="cyber-card" style={{ padding: 10, borderColor: cfg.textColor }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ fontWeight: 700, color: cfg.textColor, fontSize: 13 }}>{getLevelIcon(selectedChild.level)} {selectedChild.name}</span>
                                <button className="cyber-btn cyber-btn-sm" onClick={() => setSelectedChild(null)} style={{ fontSize: 9 }}>✕</button>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                <div>层级: {getLevelLabel(selectedChild.level)}</div>
                                {selectedChild.factionName && <div>势力: <span style={{ color: factionColorMap[selectedChild.factionName]?.text || 'var(--neon-red)' }}>⚔ {selectedChild.factionName}</span></div>}
                                {selectedChild.description && <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{selectedChild.description}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                                <button className="cyber-btn cyber-btn-sm" onClick={() => handleZoomIn(selectedChild)} style={{ fontSize: 9, color: cfg.textColor }}>🔍 深入</button>
                                <button className="cyber-btn cyber-btn-sm" onClick={() => { setEditNode({ ...selectedChild }); setShowEdit(true); }} style={{ fontSize: 9, color: 'var(--neon-green)' }}>✏ 编辑</button>
                                <button className="cyber-btn cyber-btn-sm" onClick={() => handleDeleteNode(selectedChild.id)} style={{ fontSize: 9, color: 'var(--neon-red)' }}>🗑 删除</button>
                            </div>
                        </div>
                    )}

                    {currentNode && (
                        <div className="cyber-card" style={{ padding: 10, flex: 1, overflowY: 'auto' }}>
                            <div style={{ fontWeight: 700, color: cfg.textColor, fontSize: 13, marginBottom: 6 }}>{getLevelIcon(currentNode.level)} {currentNode.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>{getLevelLabel(currentNode.level)} · {children.length} 个子区域</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{currentNode.description || '暂无描述'}</div>
                            <div style={{ marginTop: 10 }}>
                                <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>子区域</div>
                                {children.map(child => {
                                    const fc = child.factionName ? factionColorMap[child.factionName] : null;
                                    return (
                                        <div key={child.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px',
                                            borderRadius: 3, cursor: 'pointer', fontSize: 11,
                                            background: selectedChild?.id === child.id ? 'rgba(0,150,255,0.1)' : 'transparent',
                                            borderLeft: `2px solid ${fc ? fc.stroke : 'transparent'}`
                                        }} onClick={() => setSelectedChild(child)} onDoubleClick={() => handleZoomIn(child)}>
                                            <span>{getLevelIcon(child.level)}</span>
                                            <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{child.name}</span>
                                            {child.factionName && <span style={{ fontSize: 9, color: fc?.text }}>⚔</span>}
                                            {child.children?.length > 0 && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{child.children.length}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showCreate && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCreate(false)}>
                    <div className="cyber-card" style={{ width: 380, borderColor: cfg.textColor }} onClick={e => e.stopPropagation()}>
                        <h4 style={{ color: cfg.textColor, marginBottom: 10 }}>添加子区域</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div className="form-group"><label className="form-label">名称</label><input className="cyber-input" value={newNode.name} onChange={e => setNewNode(p => ({ ...p, name: e.target.value }))} placeholder="区域名称" /></div>
                            <div className="form-group"><label className="form-label">层级</label><select className="cyber-input" value={newNode.level} onChange={e => setNewNode(p => ({ ...p, level: e.target.value }))}>{levels.map(l => <option key={l.key} value={l.key}>{l.icon} {l.label}</option>)}</select></div>
                            <div className="form-group"><label className="form-label">描述</label><textarea className="cyber-input" value={newNode.description} onChange={e => setNewNode(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="区域描述" /></div>
                            <div className="form-group"><label className="form-label">势力/阵营</label><input className="cyber-input" value={newNode.factionName} onChange={e => setNewNode(p => ({ ...p, factionName: e.target.value }))} placeholder="控制此区域的势力" /></div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 10 }}>
                            <button className="cyber-btn" onClick={() => setShowCreate(false)}>取消</button>
                            <button className="cyber-btn cyber-btn-primary" onClick={handleCreateNode}>创建</button>
                        </div>
                    </div>
                </div>
            )}

            {showEdit && editNode && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setShowEdit(false); setEditNode(null); }}>
                    <div className="cyber-card" style={{ width: 380, borderColor: 'var(--neon-green)' }} onClick={e => e.stopPropagation()}>
                        <h4 style={{ color: 'var(--neon-green)', marginBottom: 10 }}>编辑区域</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div className="form-group"><label className="form-label">名称</label><input className="cyber-input" value={editNode.name || ''} onChange={e => setEditNode(p => ({ ...p, name: e.target.value }))} /></div>
                            <div className="form-group"><label className="form-label">描述</label><textarea className="cyber-input" value={editNode.description || ''} onChange={e => setEditNode(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
                            <div className="form-group"><label className="form-label">势力/阵营</label><input className="cyber-input" value={editNode.factionName || ''} onChange={e => setEditNode(p => ({ ...p, factionName: e.target.value }))} /></div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 10 }}>
                            <button className="cyber-btn" onClick={() => { setShowEdit(false); setEditNode(null); }}>取消</button>
                            <button className="cyber-btn cyber-btn-primary" onClick={handleUpdateNode}>保存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
