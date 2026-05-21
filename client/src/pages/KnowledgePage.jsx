import { useState, useEffect, useCallback, useRef } from 'react';
import useAppStore from '../store/useAppStore';
import { knowledgeApi, projectsApi, materialsApi, franchiseApi } from '../services/api';

const TABS = [
    { key: 'overview', label: '总览', icon: '◉' },
    { key: 'memory', label: '记忆金字塔', icon: '◆' },
    { key: 'graph', label: '关系图谱', icon: '⬡' },
    { key: 'power', label: '战力追踪', icon: '▲' },
    { key: 'foreshadowing', label: '伏笔管理', icon: '◈' },
    { key: 'consistency', label: '一致性校验', icon: '⬢' },
    { key: 'snapshots', label: '状态快照', icon: '▦' }
];

const SEVERITY_COLORS = { critical: '#ff4757', warning: '#ffa502', info: '#2ed573' };
const DIMENSION_LABELS = {
    character: '人物', relationship: '关系', power: '战力',
    timeline: '时间线', foreshadowing: '伏笔', worldview: '世界观'
};

export default function KnowledgePage() {
    const { currentProject } = useAppStore();
    const [activeTab, setActiveTab] = useState('overview');
    const [overview, setOverview] = useState(null);
    const [memoryLayers, setMemoryLayers] = useState(null);
    const [graph, setGraph] = useState(null);
    const [powerData, setPowerData] = useState(null);
    const [foreshadowings, setForeshadowings] = useState([]);
    const [consistencyResult, setConsistencyResult] = useState(null);
    const [consistencyReports, setConsistencyReports] = useState([]);
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [checkChapter, setCheckChapter] = useState('');
    const [selectedCharId, setSelectedCharId] = useState(null);
    const [charTimeline, setCharTimeline] = useState([]);
    const [snapshotDiff, setSnapshotDiff] = useState(null);

    const projectId = currentProject?.id;

    const loadOverview = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await knowledgeApi.getOverview(projectId);
            setOverview(res.data || res);
        } catch (e) { console.warn('Overview load failed:', e.message); }
    }, [projectId]);

    const loadMemory = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await knowledgeApi.getMemoryLayers(projectId);
            setMemoryLayers(res.data || res);
        } catch (e) { console.warn('Memory load failed:', e.message); }
    }, [projectId]);

    const loadGraph = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await projectsApi.getRelationshipGraph(projectId);
            setGraph(res.data || res);
        } catch (e) {
            try {
                const res = await knowledgeApi.getRelationshipGraph(projectId);
                setGraph(res.data || res);
            } catch (e2) { console.warn('Graph load failed:', e2.message); }
        }
    }, [projectId]);

    const loadPower = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await knowledgeApi.getPowerTracker(projectId);
            setPowerData(res.data || res);
        } catch (e) { console.warn('Power load failed:', e.message); }
    }, [projectId]);

    const loadForeshadowing = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await materialsApi.list({ projectId, type: 'foreshadowing' });
            const allF = (res.data || []);
            setForeshadowings(allF);
        } catch (e) {
            try {
                const res = await knowledgeApi.getForeshadowingTracker(projectId);
                setForeshadowings(res.data || res || []);
            } catch (e2) { console.warn('Foreshadowing load failed:', e2.message); }
        }
    }, [projectId]);

    const loadConsistencyReports = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await knowledgeApi.getConsistencyReports(projectId);
            setConsistencyReports(res.data || res || []);
        } catch (e) { console.warn('Reports load failed:', e.message); }
    }, [projectId]);

    const loadSnapshots = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await knowledgeApi.getSnapshots(projectId);
            setSnapshots(res.data || res || []);
        } catch (e) { console.warn('Snapshots load failed:', e.message); }
    }, [projectId]);

    useEffect(() => {
        if (!projectId) return;
        loadOverview();
    }, [projectId, loadOverview]);

    useEffect(() => {
        if (!projectId) return;
        const loaders = {
            memory: loadMemory,
            graph: loadGraph,
            power: loadPower,
            foreshadowing: loadForeshadowing,
            consistency: loadConsistencyReports,
            snapshots: loadSnapshots
        };
        if (loaders[activeTab]) loaders[activeTab]();
    }, [activeTab, projectId]);

    const handleBuildMemory = async (layer) => {
        if (!projectId) return;
        setLoading(true);
        try {
            await knowledgeApi.buildMemoryLayer(projectId, layer, { chapterNumber: overview?.totalChapters || 1 });
            await loadMemory();
        } catch (e) { alert('构建失败: ' + e.message); }
        setLoading(false);
    };

    const handleConsistencyCheck = async () => {
        if (!projectId || !checkChapter) return;
        setLoading(true);
        try {
            const chapters = useAppStore.getState().chapters;
            const chapter = chapters?.find(c => c.chapterNumber === parseInt(checkChapter));
            const res = await knowledgeApi.runQuickCheck(projectId, {
                chapterNumber: parseInt(checkChapter),
                chapterContent: chapter?.content || ''
            });
            setConsistencyResult(res.data || res);
        } catch (e) { alert('校验失败: ' + e.message); }
        setLoading(false);
    };

    const handleAiCheck = async () => {
        if (!projectId || !checkChapter) return;
        setLoading(true);
        try {
            const chapters = useAppStore.getState().chapters;
            const chapter = chapters?.find(c => c.chapterNumber === parseInt(checkChapter));
            const res = await knowledgeApi.runAiCheck(projectId, {
                chapterNumber: parseInt(checkChapter),
                chapterContent: chapter?.content || ''
            });
            setConsistencyResult(res.data || res);
        } catch (e) { alert('AI校验失败: ' + e.message); }
        setLoading(false);
    };

    const handleCharTimeline = async (charId) => {
        if (!projectId) return;
        setSelectedCharId(charId);
        try {
            const res = await knowledgeApi.getCharacterTimeline(projectId, charId);
            setCharTimeline(res.data || res || []);
        } catch (e) { console.warn('Char timeline failed:', e.message); }
    };

    const handleSnapshotDiff = async (chA, chB) => {
        if (!projectId) return;
        try {
            const res = await knowledgeApi.getSnapshotDiff(projectId, { chapterA: chA, chapterB: chB });
            setSnapshotDiff(res.data || res);
        } catch (e) { alert('对比失败: ' + e.message); }
    };

    if (!currentProject) {
        return (
            <div className="page-container">
                <div className="empty-state">
                    <div className="empty-state-icon">⬡</div>
                    <div className="empty-state-text">请先选择一个项目</div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">知识库 · 一致性守护</h1>
                        <div className="page-subtitle">300万字长篇一致性保障系统 | 分层记忆 · 智能校验 · 可视化纠偏</div>
                    </div>
                    <button className="cyber-btn cyber-btn-primary" onClick={() => {
                        const input = document.getElementById('knowledge-file-import');
                        if (input) input.click();
                    }} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        📄 从文件导入素材
                    </button>
                    <input id="knowledge-file-import" type="file" accept=".txt,.md,.markdown" multiple
                        style={{ display: 'none' }} onChange={async (e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0 || !currentProject) return;
                            const formData = new FormData();
                            formData.append('projectId', currentProject.id);
                            for (const file of files) formData.append('files', file);
                            try {
                                const res = await franchiseApi.importFileToProject(formData);
                                const counts = res.data?.importCounts;
                                if (counts) {
                                    const imported = Object.entries(counts).filter(([, v]) => v > 0)
                                        .map(([k, v]) => `${k}: ${v}`).join(', ');
                                    alert(`导入完成: ${imported}`);
                                }
                                window.location.reload();
                            } catch (err) {
                                alert('导入失败: ' + (err.response?.data?.error || err.message));
                            }
                            e.target.value = '';
                        }} />
                </div>
            </div>

            <div className="knowledge-tabs" style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`knowledge-tab-btn ${activeTab === tab.key ? 'knowledge-tab-active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: 6,
                            background: activeTab === tab.key ? 'var(--accent-color)' : 'var(--card-bg)',
                            color: activeTab === tab.key ? '#fff' : 'var(--text-primary)', cursor: 'pointer',
                            fontSize: 13, display: 'flex', alignItems: 'center', gap: 6
                        }}
                    >
                        <span>{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>

            {loading && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div className="spinner" /> 处理中...
                </div>
            )}

            {activeTab === 'overview' && <OverviewPanel overview={overview} onRefresh={loadOverview} />}
            {activeTab === 'memory' && <MemoryPanel layers={memoryLayers} onBuild={handleBuildMemory} projectId={projectId} />}
            {activeTab === 'graph' && <GraphPanel graph={graph} onRefresh={loadGraph} />}
            {activeTab === 'power' && <PowerPanel powerData={powerData} onCharSelect={handleCharTimeline} selectedCharId={selectedCharId} charTimeline={charTimeline} />}
            {activeTab === 'foreshadowing' && <ForeshadowingPanel foreshadowings={foreshadowings} onRefresh={loadForeshadowing} />}
            {activeTab === 'consistency' && <ConsistencyPanel result={consistencyResult} reports={consistencyReports} checkChapter={checkChapter} setCheckChapter={setCheckChapter} onCheck={handleConsistencyCheck} onAiCheck={handleAiCheck} loading={loading} />}
            {activeTab === 'snapshots' && <SnapshotPanel snapshots={snapshots} diff={snapshotDiff} onDiff={handleSnapshotDiff} projectId={projectId} />}
        </div>
    );
}

function OverviewPanel({ overview, onRefresh }) {
    if (!overview) return <div style={{ padding: 20, color: 'var(--text-secondary)' }}>加载中...</div>;

    const stats = [
        { label: '总章节数', value: overview.totalChapters || 0, icon: '▦' },
        { label: '素材条目', value: overview.activeMaterials || 0, icon: '⬡' },
        { label: '快照记录', value: overview.snapshotCount || 0, icon: '◈' },
        { label: '活跃角色', value: overview.characterStats?.active || 0, icon: '◉' },
        { label: '紧急伏笔', value: overview.foreshadowingStats?.urgent || 0, icon: '⚠' },
        { label: '一致性', value: overview.consistencyStats?.latestPassed ? '✓ 通过' : '✗ 有问题', icon: '⬢' }
    ];

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                {stats.map(s => (
                    <div key={s.label} style={{
                        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                        borderRadius: 8, padding: 16, textAlign: 'center'
                    }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {overview.materialStats && (
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>素材分布</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {Object.entries(overview.materialStats).map(([type, count]) => (
                            <div key={type} style={{
                                background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: 4,
                                fontSize: 12, display: 'flex', gap: 6
                            }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{DIMENSION_LABELS[type] || type}</span>
                                <span style={{ fontWeight: 700, color: 'var(--accent-color)' }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <button onClick={onRefresh} style={{ marginTop: 12, padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                刷新总览
            </button>
        </div>
    );
}

function MemoryPanel({ layers, onBuild, projectId }) {
    const [assembledContext, setAssembledContext] = useState(null);

    const handleAssemble = async () => {
        if (!projectId) return;
        try {
            const res = await knowledgeApi.getFormattedContext(projectId, { chapterNumber: 1, model: 'default' });
            setAssembledContext(res.data || res);
        } catch (e) { alert('组装失败: ' + e.message); }
    };

    const layerInfo = [
        { key: 'core', label: 'L0 核心设定', desc: '世界观规则、战力体系框架、核心人物 — 永远包含', color: '#ff6b6b' },
        { key: 'active', label: 'L1 活跃状态', desc: '当前角色位置/状态/战力、关系强度、装备归属', color: '#ffa502' },
        { key: 'recent', label: 'L2 近期上下文', desc: '近5章摘要、活跃任务、未回收伏笔', color: '#2ed573' },
        { key: 'archive', label: 'L3 归档检索', desc: '按关键词相关性检索的历史章节和已归档素材', color: '#1e90ff' },
        { key: 'compressed', label: 'L4 压缩摘要', desc: '卷级摘要(每30章一卷)，跨卷一致性参考', color: '#a55eea' }
    ];

    return (
        <div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>记忆金字塔架构</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {layerInfo.map(l => (
                        <div key={l.key} style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                            background: 'var(--bg-secondary)', borderRadius: 6, borderLeft: `4px solid ${l.color}`
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: l.color }}>{l.label}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{l.desc}</div>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {layers?.[l.key] ? `${layers[l.key].totalTokenEstimate || '?'} tokens` : '未构建'}
                            </div>
                            <button onClick={() => onBuild(l.key)} style={{
                                padding: '4px 12px', border: '1px solid var(--border-color)', borderRadius: 4,
                                background: 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12
                            }}>
                                构建
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>智能上下文组装器</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                    根据当前章节自动从五层记忆中提取最相关内容，在LLM上下文预算内组装最优上下文
                </p>
                <button onClick={handleAssemble} style={{
                    padding: '8px 16px', border: '1px solid var(--accent-color)', borderRadius: 6,
                    background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', fontSize: 13
                }}>
                    模拟组装上下文
                </button>
                {assembledContext && (
                    <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                包含层级: {assembledContext.layersIncluded?.join(' → ')}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--accent-color)' }}>
                                预算: {assembledContext.budgetUsed}/{assembledContext.budgetTotal} tokens
                            </span>
                        </div>
                        <pre style={{
                            background: 'var(--bg-secondary)', padding: 12, borderRadius: 6,
                            fontSize: 11, maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap',
                            border: '1px solid var(--border-color)'
                        }}>
                            {assembledContext.formatted}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}

function GraphPanel({ graph, onRefresh }) {
    const svgRef = useRef(null);
    const [viewMode, setViewMode] = useState('org-member');
    const [selectedNode, setSelectedNode] = useState(null);
    const [hoveredEdge, setHoveredEdge] = useState(null);
    const [positions, setPositions] = useState({});
    const [dragging, setDragging] = useState(null);
    const animRef = useRef(null);
    const currentPos = useRef({});
    const draggingRef = useRef(null);

    const CATEGORY_COLORS = {
        'org-hierarchy': '#ffa502', 'org-member': '#1e90ff',
        'org-hostile': '#ff4757', 'org-friendly': '#2ed573',
        'char-hostile': '#ff6348', 'char-friendly': '#7bed9f',
        'family': '#ff6b9d', 'hierarchy': '#eccc68',
        'other': '#555'
    };
    const CATEGORY_LABELS = {
        'org-hierarchy': '🏛 组织架构', 'org-member': '👥 组织人员',
        'org-hostile': '⚔ 组织对抗', 'org-friendly': '🤝 组织结盟',
        'char-hostile': '⚔ 人物对抗', 'char-friendly': '🤝 人物结盟',
        'family': '❤ 亲属', 'hierarchy': '📎 隶属',
        'other': '○ 其他'
    };
    const TYPE_COLORS = { character: '#00f0ff', organization: '#ffa502', worldview: '#a55eea' };
    const TYPE_LABELS = { character: '👤 人物', organization: '🏛 组织', worldview: '🌍 世界观' };

    const VIEW_TABS = [
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

    const nodes = graph?.nodes || [];
    const edges = graph?.edges || [];

    const filteredEdges = edges.filter(e => {
        const tab = VIEW_TABS.find(t => t.key === viewMode);
        return tab ? tab.filter(e) : true;
    });
    const activeNodeIds = new Set();
    filteredEdges.forEach(e => { activeNodeIds.add(e.source); activeNodeIds.add(e.target); });
    const filteredNodes = nodes.filter(n => activeNodeIds.has(n.id));
    const filteredCount = filteredNodes.length;
    const filteredEdgeCount = filteredEdges.length;

    useEffect(() => {
        if (!graph || filteredCount === 0) return;
        const pos = {};
        const cx = 450, cy = 300;
        filteredNodes.forEach((n, i) => {
            const angle = (2 * Math.PI * i) / filteredCount;
            const r = 150 + Math.random() * 100;
            pos[n.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), vx: 0, vy: 0 };
        });
        currentPos.current = pos;
        setPositions(pos);

        let frame = 0;
        const maxFrames = 200;
        const tick = () => {
            if (frame >= maxFrames) return;
            const p = { ...currentPos.current };
            const nodeIds = Object.keys(p);
            if (nodeIds.length === 0) { frame++; animRef.current = requestAnimationFrame(tick); return; }

            nodeIds.forEach(id => { if (p[id]) p[id] = { ...p[id], vx: 0, vy: 0 }; });

            filteredEdges.forEach(e => {
                const s = p[e.source], t = p[e.target];
                if (!s || !t) return;
                const dx = t.x - s.x, dy = t.y - s.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (dist - 180) * 0.005;
                const fx = (dx / dist) * force, fy = (dy / dist) * force;
                s.vx += fx; s.vy += fy; t.vx -= fx; t.vy -= fy;
            });

            for (let i = 0; i < nodeIds.length; i++) {
                for (let j = i + 1; j < nodeIds.length; j++) {
                    const a = p[nodeIds[i]], b = p[nodeIds[j]];
                    if (!a || !b) continue;
                    const dx = b.x - a.x, dy = b.y - a.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    if (dist < 200) {
                        const repulse = (200 - dist) * 0.02;
                        const fx = (dx / dist) * repulse, fy = (dy / dist) * repulse;
                        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
                    }
                }
            }

            nodeIds.forEach(id => {
                const n = p[id];
                if (!n) return;
                n.vx += (450 - n.x) * 0.001; n.vy += (300 - n.y) * 0.001;
                n.vx *= 0.8; n.vy *= 0.8;
                if (draggingRef.current !== id) {
                    n.x += n.vx; n.y += n.vy;
                    n.x = Math.max(50, Math.min(850, n.x));
                    n.y = Math.max(50, Math.min(550, n.y));
                }
            });

            currentPos.current = p;
            setPositions(p);
            frame++;
            animRef.current = requestAnimationFrame(tick);
        };
        animRef.current = requestAnimationFrame(tick);
        return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }, [graph, filteredCount, filteredEdgeCount, viewMode]);

    if (!graph) return <div style={{ padding: 20, color: 'var(--text-secondary)' }}>加载中...</div>;

    const handleMouseDown = (nodeId) => { setDragging(nodeId); draggingRef.current = nodeId; };
    const handleMouseMove = (e) => {
        if (!draggingRef.current || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = 900 / rect.width;
        const x = (e.clientX - rect.left) * scaleX, y = (e.clientY - rect.top) * scaleX;
        const pos = { ...currentPos.current };
        if (pos[draggingRef.current]) {
            pos[draggingRef.current] = { ...pos[draggingRef.current], x, y, vx: 0, vy: 0 };
            currentPos.current = pos;
            setPositions(pos);
        }
    };
    const handleMouseUp = () => { setDragging(null); draggingRef.current = null; };

    return (
        <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                    <svg ref={svgRef} width="100%" viewBox="0 0 900 600" style={{ background: 'rgba(0,0,0,0.2)', cursor: dragging ? 'grabbing' : 'default' }}
                        onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                        <defs>
                            {Object.entries(CATEGORY_COLORS).map(([k, c]) => (
                                <marker key={k} id={`arrow-${k}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                                    <path d="M0,0 L8,3 L0,6" fill={c} />
                                </marker>
                            ))}
                        </defs>

                        {filteredEdges.map(e => {
                            const s = positions[e.source], t = positions[e.target];
                            if (!s || !t) return null;
                            const color = CATEGORY_COLORS[e.category] || CATEGORY_COLORS.neutral;
                            const isHovered = hoveredEdge === e.id;
                            const isSelected = selectedNode && (e.source === selectedNode || e.target === selectedNode);
                            const opacity = (selectedNode && !isSelected) ? 0.15 : (isHovered ? 1 : 0.6);
                            const width = isHovered || isSelected ? 2.5 : 1.5;
                            const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;

                            return (
                                <g key={e.id}>
                                    <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                                        stroke={color} strokeWidth={width} opacity={opacity}
                                        strokeDasharray={e.category === 'hostile' ? '8,4' : (e.category === 'hierarchy' ? '4,2' : 'none')}
                                        markerEnd={`url(#arrow-${e.category})`}
                                        onMouseEnter={() => setHoveredEdge(e.id)}
                                        onMouseLeave={() => setHoveredEdge(null)}
                                        style={{ cursor: 'pointer' }} />
                                    {(isHovered || isSelected) && (
                                        <text x={mx} y={my - 6} textAnchor="middle" fill={color} fontSize="10" fontWeight="600"
                                            style={{ pointerEvents: 'none', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
                                            {e.label}
                                        </text>
                                    )}
                                </g>
                            );
                        })}

                        {filteredNodes.map(n => {
                            const p = positions[n.id];
                            if (!p) return null;
                            const color = TYPE_COLORS[n.type] || '#888';
                            const isSelected = selectedNode === n.id;
                            const isConnected = selectedNode && filteredEdges.some(e =>
                                (e.source === selectedNode && e.target === n.id) || (e.target === selectedNode && e.source === n.id)
                            );
                            const opacity = (selectedNode && !isSelected && !isConnected) ? 0.25 : 1;
                            const r = n.type === 'organization' ? 24 : (n.type === 'worldview' ? 20 : 18);

                            return (
                                <g key={n.id} style={{ cursor: 'grab', opacity }}
                                    onMouseDown={() => handleMouseDown(n.id)}
                                    onClick={() => setSelectedNode(isSelected ? null : n.id)}>
                                    {n.type === 'organization' ? (
                                        <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx={4}
                                            fill={color + '22'} stroke={color} strokeWidth={isSelected ? 3 : 1.5} />
                                    ) : (
                                        <circle cx={p.x} cy={p.y} r={r}
                                            fill={color + '22'} stroke={color} strokeWidth={isSelected ? 3 : 1.5} />
                                    )}
                                    <text x={p.x} y={p.y + 4} textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="600"
                                        style={{ pointerEvents: 'none', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
                                        {n.label.length > 4 ? n.label.substring(0, 4) : n.label}
                                    </text>
                                    <text x={p.x} y={p.y + r + 14} textAnchor="middle" fill={color} fontSize="9"
                                        style={{ pointerEvents: 'none' }}>
                                        {TYPE_LABELS[n.type] || n.type}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>

                <div>
                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                        <h4 style={{ fontSize: 13, marginBottom: 8 }}>图例</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                            {Object.entries(TYPE_LABELS).map(([k, l]) => (
                                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 12, height: 12, borderRadius: k === 'organization' ? 2 : '50%', background: TYPE_COLORS[k] + '44', border: `1.5px solid ${TYPE_COLORS[k]}` }} />
                                    <span>{l}</span>
                                </div>
                            ))}
                            <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                            {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
                                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 20, height: 2, background: CATEGORY_COLORS[k] }} />
                                    <span>{l}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {selectedNode && (() => {
                        const node = filteredNodes.find(n => n.id === selectedNode);
                        if (!node) return null;
                        const relEdges = filteredEdges.filter(e => e.source === selectedNode || e.target === selectedNode);
                        return (
                            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
                                <h4 style={{ fontSize: 13, marginBottom: 8, color: TYPE_COLORS[node.type] || 'var(--text-primary)' }}>{node.label}</h4>
                                {node.faction && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>阵营: {node.faction}</div>}
                                {node.role && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>身份: {node.role}</div>}
                                {node.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>{node.description}</div>}
                                {relEdges.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>关系 ({relEdges.length})</div>
                                        {relEdges.map(e => {
                                            const otherId = e.source === selectedNode ? e.target : e.source;
                                            const other = filteredNodes.find(n => n.id === otherId);
                                            const color = CATEGORY_COLORS[e.category] || CATEGORY_COLORS.neutral;
                                            return (
                                                <div key={e.id} style={{ padding: '4px 8px', marginBottom: 4, background: color + '11', borderRadius: 4, borderLeft: `3px solid ${color}`, fontSize: 11 }}>
                                                    <div style={{ fontWeight: 600 }}>{other?.label || '?'} <span style={{ color }}>{e.label}</span></div>
                                                    {e.detail && <div style={{ color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{e.detail.substring(0, 100)}</div>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}

function PowerPanel({ powerData, onCharSelect, selectedCharId, charTimeline }) {
    const [compareChars, setCompareChars] = useState([]);
    const [compareMode, setCompareMode] = useState('same');

    if (!powerData) return <div style={{ padding: 20, color: 'var(--text-secondary)' }}>加载中...</div>;

    const characters = powerData.characters || [];
    const systems = powerData.powerFramework || [];

    const toggleCompare = (charId) => {
        setCompareChars(prev => prev.includes(charId) ? prev.filter(c => c !== charId) : [...prev, charId]);
    };

    const compareCharData = characters.filter(c => compareChars.includes(c.id));

    const parsePowerValue = (powerStr) => {
        if (!powerStr || powerStr === '未知') return { numeric: 0, label: '未知', hasData: false };
        const pctMatch = powerStr.match(/(\d+)%/);
        if (pctMatch) {
            const pct = parseInt(pctMatch[1]);
            return { numeric: pct, label: powerStr, hasData: true };
        }
        const lvMatch = powerStr.match(/Lv\.?\s*(\d+)/i);
        if (lvMatch) {
            const lv = parseInt(lvMatch[1]);
            return { numeric: lv * 10, label: powerStr, hasData: true };
        }
        const numMatch = powerStr.match(/(\d+)/);
        if (numMatch) {
            return { numeric: parseInt(numMatch[1]), label: powerStr, hasData: true };
        }
        const LEVEL_MAP = {
            '凡人': 0, '练气': 10, '筑基': 20, '金丹': 30, '元婴': 40, '化神': 50,
            '合体': 60, '大乘': 70, '渡劫': 80, '真仙': 90, '金仙': 95,
            'F': 5, 'E': 15, 'D': 25, 'C': 40, 'B': 55, 'A': 70, 'S': 80, 'SS': 90, 'SSS': 95, 'EX': 100
        };
        for (const [key, val] of Object.entries(LEVEL_MAP)) {
            if (powerStr.includes(key)) return { numeric: val, label: powerStr, hasData: true };
        }
        return { numeric: 5, label: powerStr, hasData: true };
    };

    const parseHiddenPower = (char) => {
        const name = char.name || '';
        const growthContent = (char.growthContent || '') + (char.description || '');
        const patterns = [
            /(?:真实|隐藏|实际|暗藏|暗面)(?:战力|实力|等级|觉醒度)[：:]*\s*([^\n,，。；;]{2,30})/i,
            /(?:真实|隐藏)(?:觉醒度)[：:]*\s*(\d+%)/i,
        ];
        for (const p of patterns) {
            const m = growthContent.match(p);
            if (m && m[1]) return parsePowerValue(m[1].trim());
        }
        if (char.currentPower && char.currentPower !== '未知') {
            const official = parsePowerValue(char.currentPower);
            if (official.hasData && official.numeric > 0) {
                const hidden = Math.round(official.numeric * (1.1 + Math.random() * 0.3));
                return { numeric: Math.min(hidden, 100), label: `隐藏实力 (推测)`, hasData: true, estimated: true };
            }
        }
        return { numeric: 0, label: '', hasData: false };
    };

    return (
        <div>
            {systems.length > 0 && (
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>修炼体系</h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {systems.map((ps, i) => (
                            <div key={ps.id || i} style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6, borderLeft: '3px solid var(--neon-purple)', flex: '1 1 300px', maxWidth: 500 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--neon-purple)' }}>{ps.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{(ps.content || '').substring(0, 200)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 14 }}>选择对比人物（点击添加/移除）</h3>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button className={`cyber-btn cyber-btn-sm ${compareMode === 'same' ? 'cyber-btn-primary' : ''}`}
                            onClick={() => setCompareMode('same')}>同体系对比</button>
                        <button className={`cyber-btn cyber-btn-sm ${compareMode === 'cross' ? 'cyber-btn-primary' : ''}`}
                            onClick={() => setCompareMode('cross')}>跨体系对比</button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {characters.map(c => {
                        const isSelected = compareChars.includes(c.id);
                        const pv = parsePowerValue(c.currentPower);
                        return (
                            <button key={c.id} className={`cyber-btn cyber-btn-sm ${isSelected ? 'cyber-btn-primary' : ''}`}
                                onClick={() => toggleCompare(c.id)}>
                                {c.name} {pv.hasData ? `(${pv.numeric}%)` : ''}
                            </button>
                        );
                    })}
                </div>
            </div>

            {compareCharData.length > 0 && (
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14 }}>战力对比图</h3>
                    <svg width="100%" viewBox={`0 0 ${Math.max(600, compareCharData.length * 180)} 320`} style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 6 }}>
                        {compareCharData.map((c, i) => {
                            const x = 80 + i * 170;
                            const barWidth = 45;
                            const maxH = 220;
                            const official = parsePowerValue(c.currentPower);
                            const hidden = parseHiddenPower(c);
                            const officialH = official.hasData ? Math.max(15, (official.numeric / 100) * maxH) : 15;
                            const hiddenH = hidden.hasData ? Math.max(15, (hidden.numeric / 100) * maxH) : 0;

                            return (
                                <g key={c.id}>
                                    <rect x={x} y={290 - officialH} width={barWidth} height={officialH}
                                        fill="rgba(0,240,255,0.25)" stroke="var(--neon-blue)" strokeWidth="1.5" rx={3} />
                                    <text x={x + barWidth / 2} y={290 - officialH - 5} textAnchor="middle" fill="var(--neon-blue)" fontSize="9">
                                        {official.hasData ? `${official.numeric}%` : '未知'}
                                    </text>
                                    {hiddenH > 0 && (
                                        <rect x={x + barWidth + 5} y={290 - hiddenH} width={barWidth} height={hiddenH}
                                            fill="rgba(165,94,234,0.25)" stroke="var(--neon-purple)" strokeWidth="1.5" rx={3} strokeDasharray="4,2" />
                                    )}
                                    {hiddenH > 0 && (
                                        <text x={x + barWidth + 5 + barWidth / 2} y={290 - hiddenH - 5} textAnchor="middle" fill="var(--neon-purple)" fontSize="9">
                                            {hidden.estimated ? '~' : ''}{hidden.numeric}%
                                        </text>
                                    )}
                                    <text x={x + (hiddenH > 0 ? barWidth + 2 : barWidth / 2)} y={305} textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="600">{c.name}</text>
                                    <text x={x + barWidth / 2} y={290 - officialH - 16} textAnchor="middle" fill="var(--neon-blue)" fontSize="8" opacity={0.7}>明面</text>
                                    {hiddenH > 0 && (
                                        <text x={x + barWidth + 5 + barWidth / 2} y={290 - hiddenH - 16} textAnchor="middle" fill="var(--neon-purple)" fontSize="8" opacity={0.7}>{hidden.estimated ? '推测' : '真实'}</text>
                                    )}
                                </g>
                            );
                        })}
                        <line x1={60} y1={290} x2={80 + compareCharData.length * 170} y2={290} stroke="var(--border-color)" strokeWidth="1" />
                        {[0, 25, 50, 75, 100].map(pct => {
                            const y = 290 - (pct / 100) * 220;
                            return (
                                <g key={pct}>
                                    <line x1={65} y1={y} x2={80 + compareCharData.length * 170} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                                    <text x={58} y={y + 3} textAnchor="end" fill="var(--text-muted)" fontSize="8">{pct}%</text>
                                </g>
                            );
                        })}
                    </svg>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 12, height: 12, background: 'rgba(0,240,255,0.25)', border: '1.5px solid var(--neon-blue)', borderRadius: 2 }} />
                            明面等级
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 12, height: 12, background: 'rgba(165,94,234,0.25)', border: '1.5px dashed var(--neon-purple)', borderRadius: 2 }} />
                            真实战力
                        </div>
                    </div>
                </div>
            )}

            {selectedCharId && charTimeline.length > 0 && (
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>战力成长曲线</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {charTimeline.map((t, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, background: 'var(--bg-secondary)', borderRadius: 4 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 60 }}>第{t.chapterNumber}章</span>
                                <div style={{ flex: 1, height: 4, background: 'var(--border-color)', borderRadius: 2, position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 2, background: 'var(--neon-blue)', width: `${Math.min(100, (i + 1) / charTimeline.length * 100)}%` }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-blue)' }}>{t.state?.powerLevel || '未知'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ForeshadowingPanel({ foreshadowings, onRefresh }) {
    const active = foreshadowings.filter(f => f.status !== 'recycle' && !f.archived);
    const recycled = foreshadowings.filter(f => f.status === 'recycle' || f.archived);

    const getSummary = (f) => {
        const content = f.currentContent || f.description || '';
        const summaryMatch = content.match(/(?:【?简介?】?|【?概述?】?|【?描述?】?|【?内容?】?)[：:]\s*([^\n]+)/);
        if (summaryMatch) return summaryMatch[1].trim();
        const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('【'));
        if (lines.length > 0) return lines[0].trim().substring(0, 120);
        return content.substring(0, 120).trim();
    };

    const formatTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        const bj = new Date(d.getTime() + 8 * 3600000);
        return `${bj.getUTCFullYear()}-${String(bj.getUTCMonth() + 1).padStart(2, '0')}-${String(bj.getUTCDate()).padStart(2, '0')} ${String(bj.getUTCHours()).padStart(2, '0')}:${String(bj.getUTCMinutes()).padStart(2, '0')}`;
    };

    const renderChapterLifecycle = (f) => {
        const logs = f.changeLog || [];
        if (logs.length === 0) return <span style={{ color: 'var(--text-muted)' }}>暂无章节记录</span>;

        const startLog = logs[0];
        const changeLogs = logs.slice(1).filter(l => !l.to?.startsWith('[recycle]') && l.reason !== 'recycle');
        const recycleLog = logs.find(l => l.to?.startsWith('[recycle]') || l.reason === 'recycle' || l.reason?.includes('回收'));

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: 'rgba(0,240,255,0.15)', color: 'var(--neon-blue)' }}>埋设</span>
                    <span style={{ fontSize: 12 }}>第{startLog.chapterNumber || '?'}章</span>
                    {startLog.timestamp && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatTime(startLog.timestamp)}</span>}
                </div>
                {changeLogs.map((l, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8 }}>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: 'rgba(255,165,2,0.15)', color: '#ffa502' }}>变化</span>
                        <span style={{ fontSize: 12 }}>第{l.chapterNumber || '?'}章</span>
                        {l.reason && <span style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason}</span>}
                        {l.timestamp && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatTime(l.timestamp)}</span>}
                    </div>
                ))}
                {recycleLog ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8 }}>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: 'rgba(46,213,115,0.15)', color: 'var(--neon-green)' }}>回收</span>
                        <span style={{ fontSize: 12 }}>第{recycleLog.chapterNumber || '?'}章</span>
                        {recycleLog.reason && <span style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recycleLog.reason}</span>}
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8 }}>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: 'rgba(255,71,87,0.1)', color: '#ff4757' }}>⏳ 待回收</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>伏笔追踪器</h3>
                <button className="cyber-btn cyber-btn-sm" onClick={onRefresh}>刷新</button>
            </div>

            {active.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neon-blue)', marginBottom: 10 }}>进行中 ({active.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {active.map(f => {
                            const summary = getSummary(f);
                            return (
                                <div key={f.id} style={{ padding: '12px 14px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, borderLeft: '3px solid var(--neon-blue)' }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{f.name}</div>
                                    {summary && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.6 }}>{summary}</div>}
                                    {renderChapterLifecycle(f)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {recycled.length > 0 && (
                <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neon-green)', marginBottom: 10 }}>已回收 ({recycled.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {recycled.map(f => {
                            const summary = getSummary(f);
                            return (
                                <div key={f.id} style={{ padding: '12px 14px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, borderLeft: '3px solid var(--neon-green)', opacity: 0.75 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{f.name}</div>
                                    {summary && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.6 }}>{summary}</div>}
                                    {renderChapterLifecycle(f)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {active.length === 0 && recycled.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    暂无伏笔数据，完成章节创作后自动生成
                </div>
            )}
        </div>
    );
}

function ConsistencyPanel({ result, reports, checkChapter, setCheckChapter, onCheck, onAiCheck, loading }) {
    return (
        <div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>一致性校验</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    <input
                        type="number" value={checkChapter} onChange={e => setCheckChapter(e.target.value)}
                        placeholder="章节号" style={{
                            padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 4,
                            background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: 100, fontSize: 13
                        }}
                    />
                    <button onClick={onCheck} disabled={loading || !checkChapter} style={{
                        padding: '8px 16px', border: '1px solid var(--accent-color)', borderRadius: 6,
                        background: 'var(--accent-color)', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: 13,
                        opacity: loading || !checkChapter ? 0.5 : 1
                    }}>
                        快速校验
                    </button>
                    <button onClick={onAiCheck} disabled={loading || !checkChapter} style={{
                        padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: 6,
                        background: 'var(--card-bg)', color: 'var(--text-primary)', cursor: loading ? 'wait' : 'pointer', fontSize: 13,
                        opacity: loading || !checkChapter ? 0.5 : 1
                    }}>
                        AI深度校验
                    </button>
                </div>

                {result && (
                    <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                            <div style={{
                                padding: '8px 16px', borderRadius: 6, fontSize: 14, fontWeight: 700,
                                background: result.passed ? '#2ed57322' : '#ff475722',
                                color: result.passed ? '#2ed573' : '#ff4757'
                            }}>
                                {result.passed ? '✓ 校验通过' : '✗ 发现问题'}
                            </div>
                            {result.criticalCount !== undefined && (
                                <div style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, background: '#ff475722', color: '#ff4757' }}>
                                    严重: {result.criticalCount}
                                </div>
                            )}
                        </div>

                        {result.issues?.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {result.issues.map((issue, i) => (
                                    <div key={i} style={{
                                        padding: 10, borderRadius: 6,
                                        background: 'var(--bg-secondary)',
                                        borderLeft: `4px solid ${SEVERITY_COLORS[issue.severity] || '#888'}`
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontWeight: 600, fontSize: 13, color: SEVERITY_COLORS[issue.severity] }}>
                                                {issue.title}
                                            </span>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: SEVERITY_COLORS[issue.severity] + '22', color: SEVERITY_COLORS[issue.severity] }}>
                                                    {issue.severity === 'critical' ? '严重' : issue.severity === 'warning' ? '警告' : '提示'}
                                                </span>
                                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'var(--card-bg)', color: 'var(--text-secondary)' }}>
                                                    {DIMENSION_LABELS[issue.dimension] || issue.dimension}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{issue.description}</div>
                                        {issue.suggestion && (
                                            <div style={{ fontSize: 11, color: 'var(--accent-color)', fontStyle: 'italic' }}>
                                                💡 {issue.suggestion}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>校验历史</h3>
                {reports.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>暂无校验记录</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflow: 'auto' }}>
                        {reports.slice(0, 20).map((r, i) => (
                            <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: 8, background: 'var(--bg-secondary)', borderRadius: 4
                            }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: r.passed ? '#2ed573' : '#ff4757'
                                    }} />
                                    <span style={{ fontSize: 12 }}>第{r.chapterNumber}章</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                                    <span>严重: {r.criticalCount || 0}</span>
                                    <span>警告: {r.warningCount || 0}</span>
                                    <span>提示: {r.infoCount || 0}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function SnapshotPanel({ snapshots, diff, onDiff, projectId }) {
    const [diffA, setDiffA] = useState('');
    const [diffB, setDiffB] = useState('');

    return (
        <div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>状态快照历史</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                    每章完成后自动保存全量世界状态快照，支持回溯和对比
                </p>
                {snapshots.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>暂无快照，完成章节创作后自动生成</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflow: 'auto' }}>
                        {snapshots.map((s, i) => (
                            <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: 8, background: 'var(--bg-secondary)', borderRadius: 4
                            }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>第{s.chapterNumber}章</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                        {Object.keys(s.characterStates || {}).length}角色 | {Object.keys(s.relationshipStates || {}).length}关系
                                    </span>
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                                    {s.timestamp ? new Date(s.timestamp).toLocaleString() : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>快照对比</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    <input type="number" value={diffA} onChange={e => setDiffA(e.target.value)} placeholder="章节A"
                        style={{ padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: 80, fontSize: 13 }} />
                    <span style={{ color: 'var(--text-secondary)' }}>vs</span>
                    <input type="number" value={diffB} onChange={e => setDiffB(e.target.value)} placeholder="章节B"
                        style={{ padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: 80, fontSize: 13 }} />
                    <button onClick={() => onDiff(diffA, diffB)} disabled={!diffA || !diffB} style={{
                        padding: '6px 12px', border: '1px solid var(--accent-color)', borderRadius: 4,
                        background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', fontSize: 12,
                        opacity: !diffA || !diffB ? 0.5 : 1
                    }}>
                        对比
                    </button>
                </div>

                {diff && (
                    <div>
                        {['characterChanges', 'relationshipChanges', 'equipmentChanges', 'foreshadowingChanges'].map(dim => {
                            const changes = diff[dim] || [];
                            if (!changes.length) return null;
                            const label = { characterChanges: '角色变更', relationshipChanges: '关系变更', equipmentChanges: '装备变更', foreshadowingChanges: '伏笔变更' }[dim];
                            return (
                                <div key={dim} style={{ marginBottom: 12 }}>
                                    <h4 style={{ fontSize: 13, margin: '0 0 6px', color: 'var(--accent-color)' }}>{label}</h4>
                                    {changes.map((c, i) => (
                                        <div key={i} style={{ padding: 6, background: 'var(--bg-secondary)', borderRadius: 4, marginBottom: 4, fontSize: 12 }}>
                                            <strong>{c.name}</strong> — {c.change}
                                            {c.fields && Object.entries(c.fields).map(([k, v]) => (
                                                <div key={k} style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 12 }}>
                                                    {k}: <span style={{ color: '#ff4757' }}>{v.from}</span> → <span style={{ color: '#2ed573' }}>{v.to}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
