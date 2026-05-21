import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { materialsApi, questApi, flavorsApi, integrityApi } from '../services/api';

const TABS = [
    { key: 'materials', label: '📦 素材库' },
    { key: 'quests', label: '⚔ 主线任务' },
    { key: 'timeline', label: '📅 时间线' }
];

const MATERIAL_TYPE_ICONS = {
    worldview: '🌍', character: '👤', equipment: '⚔', relationship: '🔗',
    'power-system': '⚡', 'sub-plane': '🌀', faction: '🏛', institution: '🏯',
    catchphrase: '💬', 'famous-scene': '🎬', 'growth-history': '📈',
    foreshadowing: '🔮', location: '📍', 'narrative-bridge': '🌉',
    'writing-technique': '✍️', craft: '📝', mechanism: '⚙️', index: '📑', other: '📋'
};

const MATERIAL_TYPE_LABELS = Object.fromEntries(
    Object.entries(MATERIAL_TYPE_ICONS).map(([k, v]) => [k, `${v} ${({worldview:'世界观',character:'人物卡',equipment:'装备',relationship:'人物关系','power-system':'战力体系','sub-plane':'次位面',faction:'势力',institution:'机构',catchphrase:'金句/热梗','famous-scene':'名场面','growth-history':'成长史',foreshadowing:'伏笔',location:'地点','narrative-bridge':'叙事衔接','writing-technique':'写作手法',craft:'创作规范',mechanism:'机制',index:'索引',other:'其他'})[k] || k}`])
);

const MATERIAL_TYPE_COLORS = {
    worldview: 'blue', character: 'pink', equipment: 'orange', relationship: 'red',
    'power-system': 'purple', 'sub-plane': 'cyan', faction: 'gold', institution: 'brown',
    catchphrase: 'green', 'famous-scene': 'orange', 'growth-history': 'blue',
    foreshadowing: 'purple', location: 'teal', 'narrative-bridge': 'gray',
    'writing-technique': 'indigo', craft: 'amber', mechanism: 'steel', index: 'slate', other: 'blue'
};

const DOMAIN_CATEGORIES = {
    world: ['worldview', 'power-system', 'faction', 'character', 'institution', 'location', 'equipment'],
    subplane: ['sub-plane'],
    craft: ['craft', 'writing-technique', 'narrative-bridge', 'catchphrase', 'famous-scene', 'foreshadowing', 'growth-history', 'relationship', 'mechanism', 'index', 'other']
};

const ARCHIVE_STATUS_LABELS = {
    retire: '已淘汰',
    deprecate: '已废弃',
    recycle: '已回收'
};

const ARCHIVE_STATUS_COLORS = {
    retire: 'var(--neon-red)',
    deprecate: 'var(--neon-orange)',
    recycle: 'var(--neon-green)'
};

const QUEST_STATUS_LABELS = {
    planned: '📋 计划中',
    active: '⚡ 进行中',
    completed: '✅ 已完成',
    abandoned: '❌ 已放弃'
};

const QUEST_STATUS_COLORS = {
    planned: 'var(--text-muted)',
    active: 'var(--neon-blue)',
    completed: 'var(--neon-green)',
    abandoned: 'var(--neon-red)'
};

const QUEST_STATUS_BADGE = {
    planned: 'cyber-badge-blue',
    active: 'cyber-badge-orange',
    completed: 'cyber-badge-green',
    abandoned: 'cyber-badge-red'
};

const QUEST_PRIORITY_LABELS = {
    low: '低',
    normal: '普通',
    high: '高',
    critical: '紧急'
};

const QUEST_PRIORITY_COLORS = {
    low: 'var(--text-muted)',
    normal: 'var(--neon-blue)',
    high: 'var(--neon-orange)',
    critical: 'var(--neon-red)'
};

const TIMELINE_EVENT_LABELS = {
    plot: '📖 剧情',
    character: '👤 人物',
    world: '🌍 世界',
    conflict: '⚔ 冲突',
    revelation: '💡 揭示',
    foreshadow: '🔮 伏笔',
    resolution: '🎯 解决'
};

const TIMELINE_EVENT_COLORS = {
    plot: 'var(--neon-blue)',
    character: 'var(--neon-pink)',
    world: 'var(--neon-green)',
    conflict: 'var(--neon-red)',
    revelation: 'var(--neon-orange)',
    foreshadow: 'var(--neon-purple)',
    resolution: 'var(--neon-green)'
};

const TIMELINE_EVENT_BADGE = {
    plot: 'cyber-badge-blue',
    character: 'cyber-badge-pink',
    world: 'cyber-badge-green',
    conflict: 'cyber-badge-red',
    revelation: 'cyber-badge-orange',
    foreshadow: 'cyber-badge-purple',
    resolution: 'cyber-badge-green'
};

const IMPORTANCE_LABELS = {
    low: '低',
    normal: '普通',
    high: '高',
    critical: '关键'
};

export default function MaterialsPage() {
    const navigate = useNavigate();
    const { currentProject, materials, setMaterials, chapters } = useAppStore();
    const [activeTab, setActiveTab] = useState('materials');
    const [filterType, setFilterType] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [selectedMaterialId, setSelectedMaterialId] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [isEditing, setIsEditing] = useState(false);
    const [activeView, setActiveView] = useState('active');
    const [showHistoryFor, setShowHistoryFor] = useState(null);
    const [collapsedTypes, setCollapsedTypes] = useState(new Set());
    const [expandedPlanes, setExpandedPlanes] = useState(new Set());
    const [availableDialects, setAvailableDialects] = useState([]);
    const [availableStyles, setAvailableStyles] = useState([]);
    const [availableNamingStyles, setAvailableNamingStyles] = useState([]);
    const [availableArchetypes, setAvailableArchetypes] = useState([]);
    const [flavorPreview, setFlavorPreview] = useState(null);
    const [projectPromptData, setProjectPromptData] = useState(null);
    const [showPromptPanel, setShowPromptPanel] = useState(false);
    const [integrityReport, setIntegrityReport] = useState(null);
    const [showIntegrityPanel, setShowIntegrityPanel] = useState(false);
    const [fixResult, setFixResult] = useState(null);

    const toBeijingTime = (isoStr) => {
        if (!isoStr) return '未知时间';
        const d = new Date(isoStr);
        return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const goToChapter = (chapterNumber) => {
        const ch = chapters.find(c => c.chapterNumber === chapterNumber);
        if (ch) {
            navigate('/pipeline?chapterId=' + ch.id);
        } else {
            navigate('/pipeline?chapter=' + chapterNumber);
        }
    };

    const [quests, setQuests] = useState([]);
    const [timelineEvents, setTimelineEvents] = useState([]);
    const [questMeta, setQuestMeta] = useState(null);
    const [showQuestForm, setShowQuestForm] = useState(false);
    const [editingQuest, setEditingQuest] = useState(null);
    const [questForm, setQuestForm] = useState({ title: '', description: '', status: 'planned', priority: 'normal', parentId: null });
    const [showTimelineForm, setShowTimelineForm] = useState(false);
    const [editingTimeline, setEditingTimeline] = useState(null);
    const [timelineForm, setTimelineForm] = useState({ title: '', description: '', eventType: 'plot', storyTime: '', location: '', importance: 'normal', isKeyEvent: false });
    const [expandedQuests, setExpandedQuests] = useState(new Set());
    const [questStatusFilter, setQuestStatusFilter] = useState('all');
    const [timelineTypeFilter, setTimelineTypeFilter] = useState('all');

    const loadMaterials = useCallback(() => {
        if (!currentProject) return;
        materialsApi.list({ projectId: currentProject.id }).then(res => setMaterials(res.data || [])).catch(console.error);
    }, [currentProject, setMaterials]);

    useEffect(() => {
        loadMaterials();
    }, [loadMaterials]);

    const selectMaterial = useCallback(async (matId) => {
        setSelectedMaterialId(matId);
        setIsEditing(false);
        if (!matId) return;
        try {
            const res = await materialsApi.get(matId);
            const freshMat = res.data;
            if (freshMat) {
                const updatedList = materials.map(m => m.id === matId ? freshMat : m);
                setMaterials(updatedList);
            }
        } catch (e) {
            console.warn('Failed to refresh material:', e.message);
        }
    }, [materials, setMaterials]);

    const startEdit = useCallback(async (material) => {
        setEditingMaterial(material.id);
        setSelectedMaterialId(material.id);
        setIsEditing(true);
        setFlavorPreview(null);
        try {
            const res = await materialsApi.get(material.id);
            const freshMat = res.data;
            setEditForm({
                name: freshMat?.name || material.name,
                type: freshMat?.type || material.type,
                currentContent: freshMat?.currentContent || material.currentContent || '',
                changeReason: '',
                dialectRegion: freshMat?.dialectRegion || material.dialectRegion || '',
                dialectIntensity: freshMat?.dialectIntensity || material.dialectIntensity || 'medium',
                speechStyle: freshMat?.speechStyle || material.speechStyle || '',
                speechStyleIntensity: freshMat?.speechStyleIntensity || material.speechStyleIntensity || 'medium',
                archetype: freshMat?.archetype || material.archetype || ''
            });
        } catch (e) {
            setEditForm({
                name: material.name,
                type: material.type,
                currentContent: material.currentContent || '',
                changeReason: '',
                dialectRegion: material.dialectRegion || '',
                dialectIntensity: material.dialectIntensity || 'medium',
                speechStyle: material.speechStyle || '',
                speechStyleIntensity: material.speechStyleIntensity || 'medium',
                archetype: material.archetype || ''
            });
        }
    }, []);

    const loadQuests = useCallback(() => {
        if (!currentProject) return;
        questApi.listQuests({ projectId: currentProject.id }).then(res => setQuests(res.data || [])).catch(console.error);
    }, [currentProject]);

    const loadTimelines = useCallback(() => {
        if (!currentProject) return;
        questApi.listTimelines({ projectId: currentProject.id }).then(res => setTimelineEvents(res.data || [])).catch(console.error);
    }, [currentProject]);

    useEffect(() => {
        if (!questMeta) questApi.getMeta().then(res => setQuestMeta(res.data)).catch(() => {});
    }, [questMeta]);

    useEffect(() => { if (activeTab === 'quests') loadQuests(); }, [activeTab, loadQuests]);
    useEffect(() => { if (activeTab === 'timeline') loadTimelines(); }, [activeTab, loadTimelines]);

    useEffect(() => {
        const loadFlavors = async () => {
            try {
                const [dialectsRes, stylesRes, namingRes, archetypesRes] = await Promise.all([flavorsApi.getDialects(), flavorsApi.getStyles(), flavorsApi.getNamingStyles(), flavorsApi.getCharacterArchetypes()]);
                setAvailableDialects(dialectsRes.data || []);
                setAvailableStyles(stylesRes.data || []);
                setAvailableNamingStyles(namingRes.data || []);
                setAvailableArchetypes(archetypesRes.data || []);
            } catch (_) {}
        };
        loadFlavors();
    }, []);

    const activeMaterials = materials.filter(m => !m.archived);
    const archivedMaterials = materials.filter(m => m.archived);

    const filteredMaterials = (activeView === 'archived' ? archivedMaterials : activeMaterials).filter(m => {
        if (filterType !== 'all' && m.type !== filterType) return false;
        if (searchTerm && !m.name.toLowerCase().includes(searchTerm.toLowerCase()) && !m.currentContent?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const buildDomainTree = (mats) => {
        const matMap = {};
        mats.forEach(m => { matMap[m.id] = m; });
        const mainWorld = { id: '__mainworld__', name: '主世界', factions: {}, others: [] };
        const subPlanes = [];
        const planeMap = {};
        const craftRules = { id: '__craft__', name: '创作规范', byType: {} };

        mats.filter(m => m.type === 'sub-plane').forEach(sp => {
            const node = { ...sp, factions: {}, others: [], items: [] };
            subPlanes.push(node);
            planeMap[sp.id] = node;
        });

        const worldTypes = new Set(DOMAIN_CATEGORIES.world);
        const craftTypes = new Set(DOMAIN_CATEGORIES.craft);

        const factions = mats.filter(m => m.type === 'faction');
        const nonFactions = mats.filter(m => m.type !== 'sub-plane' && m.type !== 'faction');

        factions.forEach(f => {
            if (f.parentPlane && planeMap[f.parentPlane]) {
                planeMap[f.parentPlane].factions[f.id] = { ...f, characters: [] };
            } else {
                mainWorld.factions[f.id] = { ...f, characters: [] };
            }
        });

        nonFactions.forEach(m => {
            if (craftTypes.has(m.type)) {
                if (!craftRules.byType[m.type]) craftRules.byType[m.type] = [];
                craftRules.byType[m.type].push(m);
            } else if (m.parentPlane && planeMap[m.parentPlane]) {
                const plane = planeMap[m.parentPlane];
                if (m.type === 'character' && m.parentFaction && plane.factions[m.parentFaction]) {
                    plane.factions[m.parentFaction].characters.push(m);
                } else if (m.type === 'equipment') {
                    plane.items.push(m);
                } else {
                    plane.others.push(m);
                }
            } else if (m.parentFaction && mainWorld.factions[m.parentFaction]) {
                mainWorld.factions[m.parentFaction].characters.push(m);
            } else if (worldTypes.has(m.type)) {
                mainWorld.others.push(m);
            } else {
                if (!craftRules.byType[m.type]) craftRules.byType[m.type] = [];
                craftRules.byType[m.type].push(m);
            }
        });

        const mainWorldOthers = {};
        mainWorld.others.forEach(m => {
            if (!mainWorldOthers[m.type]) mainWorldOthers[m.type] = [];
            mainWorldOthers[m.type].push(m);
        });
        mainWorld.othersByType = mainWorldOthers;

        const craftTotal = Object.values(craftRules.byType).reduce((s, arr) => s + arr.length, 0);
        craftRules.total = craftTotal;

        return { mainWorld, subPlanes, craftRules };
    };

    const domainTree = buildDomainTree(filteredMaterials);

    const foreshadowingActive = filteredMaterials.filter(m => m.type === 'foreshadowing' && !m.archived);
    const foreshadowingRecycled = filteredMaterials.filter(m => m.type === 'foreshadowing' && m.archived && m.status === 'recycle');

    const saveEdit = async () => {
        if (!editingMaterial) return;
        try {
            await materialsApi.update(editingMaterial, editForm);
            await loadMaterials();
            setIsEditing(false);
        } catch (e) {
            console.error('Save error:', e);
        }
    };

    const createMaterial = async (formData) => {
        if (!currentProject) return;
        try {
            await materialsApi.create({ ...formData, projectId: currentProject.id });
            await loadMaterials();
            setShowCreate(false);
        } catch (e) {
            console.error('Create error:', e);
        }
    };

    const deleteMaterial = async (id) => {
        if (!confirm('确定删除此素材？')) return;
        try {
            await materialsApi.delete(id);
            await loadMaterials();
        } catch (e) {
            alert('删除失败: ' + (e.response?.data?.error || e.message));
        }
    };

    const saveQuest = async () => {
        if (!currentProject) return;
        try {
            const data = { ...questForm, projectId: currentProject.id };
            if (editingQuest) {
                await questApi.updateQuest(editingQuest, data);
            } else {
                await questApi.createQuest(data);
            }
            loadQuests();
            setShowQuestForm(false);
            setEditingQuest(null);
            setQuestForm({ title: '', description: '', status: 'planned', priority: 'normal', parentId: null });
        } catch (e) { console.error('Save quest error:', e); }
    };

    const deleteQuest = async (id) => {
        if (!confirm('确定删除此任务？')) return;
        try { await questApi.deleteQuest(id); loadQuests(); } catch (e) { alert(e.response?.data?.error || e.message); }
    };

    const toggleQuestExpand = (id) => {
        setExpandedQuests(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    };

    const saveTimeline = async () => {
        if (!currentProject) return;
        try {
            const data = { ...timelineForm, projectId: currentProject.id };
            if (editingTimeline) {
                await questApi.updateTimeline(editingTimeline, data);
            } else {
                await questApi.createTimeline(data);
            }
            loadTimelines();
            setShowTimelineForm(false);
            setEditingTimeline(null);
            setTimelineForm({ title: '', description: '', eventType: 'plot', storyTime: '', location: '', importance: 'normal', isKeyEvent: false });
        } catch (e) { console.error('Save timeline error:', e); }
    };

    const deleteTimeline = async (id) => {
        if (!confirm('确定删除此事件？')) return;
        try { await questApi.deleteTimeline(id); loadTimelines(); } catch (e) { alert(e.response?.data?.error || e.message); }
    };

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 className="page-title">素材库管理</h1>
                        <p className="page-subtitle">管理小说世界观、人物、装备、关系等素材 - 支持初始/当前状态对比</p>
                    </div>
                    {currentProject && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="cyber-btn cyber-btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={async () => {
                                try {
                                    const res = await integrityApi.check(currentProject.id);
                                    setIntegrityReport(res.data);
                                    setFixResult(null);
                                    setShowIntegrityPanel(true);
                                } catch (_) {}
                            }}>🏥 健康检查</button>
                            <button className="cyber-btn cyber-btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={async () => {
                                try {
                                    const res = await flavorsApi.getProjectPrompt(currentProject.id);
                                    setProjectPromptData(res.data);
                                    setShowPromptPanel(true);
                                } catch (_) {}
                            }}>🔍 查看注入Prompt</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="cyber-tabs" style={{ marginBottom: 20 }}>
                {TABS.map(tab => (
                    <button key={tab.key} className={`cyber-tab ${activeTab === tab.key ? 'cyber-tab-active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                        style={activeTab === tab.key ? { borderColor: 'var(--neon-blue)', color: 'var(--neon-blue)' } : {}}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {!currentProject ? (
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon">⬡</div>
                    <div>请先在仪表盘选择一个项目</div>
                </div>
            ) : (
                <>
                    {activeTab === 'materials' && (<>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="cyber-tabs">
                            <button className={`cyber-tab ${activeView === 'active' ? 'cyber-tab-active' : ''}`}
                                onClick={() => setActiveView('active')}
                                style={activeView === 'active' ? { borderColor: 'var(--neon-blue)', color: 'var(--neon-blue)' } : {}}>
                                活跃素材 ({activeMaterials.length})
                            </button>
                            <button className={`cyber-tab ${activeView === 'archived' ? 'cyber-tab-active' : ''}`}
                                onClick={() => setActiveView('archived')}
                                style={activeView === 'archived' ? { borderColor: 'var(--neon-red)', color: 'var(--neon-red)' } : {}}>
                                登记表 ({archivedMaterials.length})
                            </button>
                        </div>
                        <input className="cyber-input" style={{ maxWidth: 240 }} placeholder="搜索素材..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <select className="cyber-select" style={{ maxWidth: 150 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="all">全部类型</option>
                            {Object.entries(MATERIAL_TYPE_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
                        </select>
                        {activeView === 'active' && <button className="cyber-btn cyber-btn-primary" onClick={() => setShowCreate(true)}>+ 新建素材</button>}
                        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>共 {filteredMaterials.length} 条</div>
                        <button className="cyber-btn cyber-btn-sm" onClick={() => { setCollapsedTypes(prev => prev.size > 0 ? new Set() : new Set(['__mw__', '__sp__'])); }}>
                            {collapsedTypes.size > 0 ? '展开全部' : '折叠全部'}
                        </button>
                    </div>

                    {filteredMaterials.length === 0 ? (
                        <div className="cyber-card cyber-empty">
                            <div className="cyber-empty-icon">⬡</div>
                            <div>暂无素材，请在仪表盘生成素材库或手动创建</div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
                            <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 12, maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
                                {(() => {
                                    const TREE_LINE = '2px solid var(--border-color)';
                                    const INDENT = 20;

                                    const renderItem = (mat, depth, opts = {}) => (
                                        <div
                                            key={mat.id}
                                            onClick={() => { if (selectedMaterialId === mat.id) { setSelectedMaterialId(null); setIsEditing(false); } else { selectMaterial(mat.id); } }}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `5px 10px 5px ${INDENT + depth * INDENT}px`, cursor: 'pointer', borderRadius: 4, fontSize: opts.fontSize || 13, color: opts.color || 'inherit', background: selectedMaterialId === mat.id ? 'var(--accent-primary)22' : 'transparent', borderLeft: selectedMaterialId === mat.id ? '3px solid var(--accent-primary)' : '3px solid transparent', opacity: mat.isLocked ? 0.55 : mat.archived ? 0.6 : 1 }}
                                            onMouseEnter={e => { if (selectedMaterialId !== mat.id) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                            onMouseLeave={e => { if (selectedMaterialId !== mat.id) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <span style={{ fontSize: 11 }}>{MATERIAL_TYPE_ICONS[mat.type] || '📄'}</span>
                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.name}</span>
                                            {mat.isLocked && <span style={{ fontSize: 10 }}>🔒</span>}
                                            {mat.archived && <span style={{ fontSize: 10, color: ARCHIVE_STATUS_COLORS[mat.status] || 'var(--neon-red)' }}>●</span>}
                                        </div>
                                    );

                                    const renderFactionBlock = (fac, depth) => {
                                        const facKey = `fac-${fac.id}`;
                                        const isFacOpen = expandedPlanes.has(facKey);
                                        const hasChars = fac.characters && fac.characters.length > 0;
                                        return (
                                            <div key={fac.id}>
                                                <div style={{ display: 'flex', alignItems: 'center', padding: `5px 10px 5px ${INDENT + depth * INDENT}px`, cursor: 'pointer', borderRadius: 4, fontSize: 13, background: selectedMaterialId === fac.id ? 'var(--accent-primary)22' : 'transparent' }}>
                                                    {hasChars ? (
                                                        <span onClick={e => { e.stopPropagation(); setExpandedPlanes(prev => { const n = new Set(prev); n.has(facKey) ? n.delete(facKey) : n.add(facKey); return n; }); }} style={{ fontSize: 9, transition: 'transform 0.2s', transform: isFacOpen ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block', width: 14, textAlign: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}>▼</span>
                                                    ) : <span style={{ width: 14 }} />}
                                                    <span onClick={() => selectMaterial(fac.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden' }}>
                                                        <span style={{ fontSize: 11 }}>🏛</span>
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fac.name}</span>
                                                        {hasChars && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fac.characters.length}</span>}
                                                    </span>
                                                </div>
                                                {isFacOpen && hasChars && (
                                                    <div style={{ borderLeft: TREE_LINE, marginLeft: INDENT + depth * INDENT + 10, paddingLeft: 4 }}>
                                                        {fac.characters.map(chr => renderItem(chr, depth + 1, { fontSize: 12, color: 'var(--text-secondary)' }))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    };

                                    const renderSubPlane = (plane) => {
                                        const isOpen = expandedPlanes.has(plane.id);
                                        const facCount = Object.keys(plane.factions).length;
                                        const otherCount = plane.others ? plane.others.length : 0;
                                        const itemCount = plane.items ? plane.items.length : 0;
                                        const total = facCount + otherCount + itemCount;
                                        return (
                                            <div key={plane.id}>
                                                <div style={{ display: 'flex', alignItems: 'center', padding: `5px 10px 5px ${INDENT}px`, cursor: 'pointer', borderRadius: 6, fontSize: 13, background: selectedMaterialId === plane.id ? 'var(--accent-primary)22' : 'transparent', borderLeft: selectedMaterialId === plane.id ? '3px solid var(--accent-primary)' : '3px solid transparent', opacity: plane.isLocked ? 0.55 : 1 }}>
                                                    <span onClick={e => { e.stopPropagation(); setExpandedPlanes(prev => { const n = new Set(prev); n.has(plane.id) ? n.delete(plane.id) : n.add(plane.id); return n; }); }} style={{ fontSize: 9, transition: 'transform 0.2s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block', width: 14, textAlign: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}>▼</span>
                                                    <span onClick={() => selectMaterial(plane.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden' }}>
                                                        <span style={{ fontSize: 11 }}>🌀</span>
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plane.name}</span>
                                                        {plane.isLocked && <span style={{ fontSize: 10 }}>🔒</span>}
                                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{total}</span>
                                                    </span>
                                                </div>
                                                {isOpen && (
                                                    <div style={{ borderLeft: TREE_LINE, marginLeft: INDENT + 6, paddingLeft: 4 }}>
                                                        {Object.values(plane.factions).map(fac => renderFactionBlock(fac, 1))}
                                                        {plane.others && plane.others.map(m => renderItem(m, 1))}
                                                        {itemCount > 0 && (
                                                            <div style={{ padding: `2px 10px 2px ${INDENT}px`, fontSize: 11, color: 'var(--text-muted)' }}>
                                                                ⚔ {plane.items.map(i => i.name).join('、')}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    };

                                    const { mainWorld, subPlanes, craftRules } = domainTree;
                                    const mwFactions = Object.values(mainWorld.factions);
                                    const mwOthersByType = mainWorld.othersByType || {};
                                    const mwTotal = mwFactions.length + Object.values(mwOthersByType).reduce((s, arr) => s + arr.length, 0);
                                    return (
                                        <>
                                            <div style={{ marginBottom: 4 }}>
                                                <div onClick={() => setCollapsedTypes(prev => { const n = new Set(prev); n.has('__mw__') ? n.delete('__mw__') : n.add('__mw__'); return n; })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer', borderRadius: 6, fontSize: 14, fontWeight: 700, userSelect: 'none', background: collapsedTypes.has('__mw__') ? 'transparent' : 'var(--bg-secondary)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.currentTarget.style.background = collapsedTypes.has('__mw__') ? 'transparent' : 'var(--bg-secondary)'}>
                                                    <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: collapsedTypes.has('__mw__') ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block', width: 12, textAlign: 'center' }}>▼</span>
                                                    <span>主世界</span>
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '1px 7px', borderRadius: 10, marginLeft: 'auto' }}>{mwTotal}</span>
                                                </div>
                                                {!collapsedTypes.has('__mw__') && (
                                                    <div style={{ borderLeft: TREE_LINE, marginLeft: 16, paddingLeft: 4 }}>
                                                        {mwFactions.map(fac => renderFactionBlock(fac, 0))}
                                                        {Object.entries(mwOthersByType).map(([type, items]) => (
                                                            <div key={type}>
                                                                <div style={{ padding: `4px 10px 4px ${INDENT}px`, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', userSelect: 'none' }}>{MATERIAL_TYPE_LABELS[type] || type} ({items.length})</div>
                                                                {items.map(m => renderItem(m, 1, { fontSize: 12 }))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {subPlanes.length > 0 && (
                                                <div style={{ marginBottom: 4 }}>
                                                    <div onClick={() => setCollapsedTypes(prev => { const n = new Set(prev); n.has('__sp__') ? n.delete('__sp__') : n.add('__sp__'); return n; })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer', borderRadius: 6, fontSize: 14, fontWeight: 700, userSelect: 'none', background: collapsedTypes.has('__sp__') ? 'transparent' : 'var(--bg-secondary)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.currentTarget.style.background = collapsedTypes.has('__sp__') ? 'transparent' : 'var(--bg-secondary)'}>
                                                        <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: collapsedTypes.has('__sp__') ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block', width: 12, textAlign: 'center' }}>▼</span>
                                                        <span>次位面</span>
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '1px 7px', borderRadius: 10, marginLeft: 'auto' }}>{subPlanes.length}</span>
                                                    </div>
                                                    {!collapsedTypes.has('__sp__') && (
                                                        <div style={{ borderLeft: TREE_LINE, marginLeft: 16, paddingLeft: 4 }}>
                                                            {subPlanes.map(sp => renderSubPlane(sp))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {craftRules && craftRules.total > 0 && (
                                                <div style={{ marginBottom: 4 }}>
                                                    <div onClick={() => setCollapsedTypes(prev => { const n = new Set(prev); n.has('__craft__') ? n.delete('__craft__') : n.add('__craft__'); return n; })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer', borderRadius: 6, fontSize: 14, fontWeight: 700, userSelect: 'none', background: collapsedTypes.has('__craft__') ? 'transparent' : 'var(--bg-secondary)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.currentTarget.style.background = collapsedTypes.has('__craft__') ? 'transparent' : 'var(--bg-secondary)'}>
                                                        <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: collapsedTypes.has('__craft__') ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block', width: 12, textAlign: 'center' }}>▼</span>
                                                        <span>✍️ 创作规范</span>
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '1px 7px', borderRadius: 10, marginLeft: 'auto' }}>{craftRules.total}</span>
                                                    </div>
                                                    {!collapsedTypes.has('__craft__') && (
                                                        <div style={{ borderLeft: TREE_LINE, marginLeft: 16, paddingLeft: 4 }}>
                                                            {Object.entries(craftRules.byType).map(([type, items]) => (
                                                                <div key={type}>
                                                                    <div style={{ padding: `4px 10px 4px ${INDENT}px`, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', userSelect: 'none' }}>{MATERIAL_TYPE_LABELS[type] || type} ({items.length})</div>
                                                                    {items.map(m => renderItem(m, 1, { fontSize: 12 }))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            <div style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
                                {selectedMaterialId ? (() => {
                                    const mat = filteredMaterials.find(m => m.id === selectedMaterialId);
                                    if (!mat) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>选择左侧素材查看详情</div>;
                                    return (
                                        <div className="cyber-card" style={mat.archived ? { borderLeft: `3px solid ${ARCHIVE_STATUS_COLORS[mat.status] || 'var(--neon-red)'}` } : {}}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                                <div>
                                                    <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{mat.name}</h3>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                                        {MATERIAL_TYPE_LABELS[mat.type] || mat.type} · v{mat.version} · {mat.isLocked ? '🔒 锁定' : '可编辑'}
                                                        {mat.archived && <span style={{ color: ARCHIVE_STATUS_COLORS[mat.status] || 'var(--neon-red)', fontWeight: 600, marginLeft: 8 }}>{ARCHIVE_STATUS_LABELS[mat.status] || mat.status}</span>}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {!mat.archived && !isEditing && <button className="cyber-btn cyber-btn-sm" onClick={() => startEdit(mat)}>编辑</button>}
                                                    {(mat.changeLog?.length > 0) && <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-purple)' }} onClick={() => setShowHistoryFor(showHistoryFor === mat.id ? null : mat.id)}>📋 变更({mat.changeLog.length})</button>}
                                                    {!mat.archived && !isEditing && <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-orange)' }} onClick={async () => { const reason = prompt('归档原因：'); if (!reason) return; await materialsApi.update(mat.id, { archived: true, status: reason, archivedReason: reason }); const res = await materialsApi.list({ projectId: currentProject.id }); setMaterials(res.data || []); }}>归档</button>}
                                                    {mat.archived && <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-green)' }} onClick={async () => { await materialsApi.update(mat.id, { archived: false, status: 'active', archivedReason: '' }); const res = await materialsApi.list({ projectId: currentProject.id }); setMaterials(res.data || []); }}>恢复</button>}
                                                    {!mat.isLocked && !mat.archived && !isEditing && <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={() => deleteMaterial(mat.id)}>删除</button>}
                                                </div>
                                            </div>

                                            {mat.archived && mat.archivedReason && (
                                                <div style={{ padding: '6px 10px', background: 'rgba(255,0,68,0.05)', borderRadius: 6, marginBottom: 10, fontSize: 12, color: 'var(--neon-orange)' }}>
                                                    原因: {mat.archivedReason}
                                                    {mat.archivedAt && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>{new Date(mat.archivedAt).toLocaleString('zh-CN')}</span>}
                                                </div>
                                            )}

                                            {isEditing && editForm ? (
                                                <div>
                                                    <div className="form-group"><label className="form-label">名称</label><input className="cyber-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
                                                    <div className="form-group"><label className="form-label">类型</label><select className="cyber-select" value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>{Object.entries(MATERIAL_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                                                    {editForm.type === 'character' && (
                                                        <div style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neon-cyan)', marginBottom: 8 }}>🎭 说话风味</div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                                <div className="form-group" style={{ margin: 0 }}>
                                                                    <label className="form-label" style={{ fontSize: 11 }}>方言（你从哪来）</label>
                                                                    <select className="cyber-select" value={editForm.dialectRegion || ''} onChange={e => setEditForm({ ...editForm, dialectRegion: e.target.value })}>
                                                                        <option value="">无方言</option>
                                                                        {availableDialects.map(d => <option key={d.region} value={d.region}>{d.label}</option>)}
                                                                    </select>
                                                                </div>
                                                                <div className="form-group" style={{ margin: 0 }}>
                                                                    <label className="form-label" style={{ fontSize: 11 }}>方言强度</label>
                                                                    <select className="cyber-select" value={editForm.dialectIntensity || 'medium'} onChange={e => setEditForm({ ...editForm, dialectIntensity: e.target.value })} disabled={!editForm.dialectRegion}>
                                                                        <option value="light">轻度（偶尔语气词）</option>
                                                                        <option value="medium">中度（核心词汇替换）</option>
                                                                        <option value="heavy">重度（全面方言化）</option>
                                                                    </select>
                                                                </div>
                                                                <div className="form-group" style={{ margin: 0 }}>
                                                                    <label className="form-label" style={{ fontSize: 11 }}>说话风格（你是谁）</label>
                                                                    <select className="cyber-select" value={editForm.speechStyle || ''} onChange={e => setEditForm({ ...editForm, speechStyle: e.target.value })}>
                                                                        <option value="">无风格</option>
                                                                        {availableStyles.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                                                    </select>
                                                                </div>
                                                                <div className="form-group" style={{ margin: 0 }}>
                                                                    <label className="form-label" style={{ fontSize: 11 }}>风格强度</label>
                                                                    <select className="cyber-select" value={editForm.speechStyleIntensity || 'medium'} onChange={e => setEditForm({ ...editForm, speechStyleIntensity: e.target.value })} disabled={!editForm.speechStyle}>
                                                                        <option value="light">轻度</option>
                                                                        <option value="medium">中度</option>
                                                                        <option value="heavy">重度</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            {(editForm.dialectRegion || editForm.speechStyle) && (
                                                                <div style={{ marginTop: 8 }}>
                                                                    <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 11 }} onClick={async () => {
                                                                        try {
                                                                            const res = await flavorsApi.previewCombined({
                                                                                dialectRegion: editForm.dialectRegion || undefined,
                                                                                dialectIntensity: editForm.dialectIntensity || undefined,
                                                                                speechStyle: editForm.speechStyle || undefined,
                                                                                speechStyleIntensity: editForm.speechStyleIntensity || undefined,
                                                                                charName: editForm.name || '角色'
                                                                            });
                                                                            setFlavorPreview(res.data);
                                                                        } catch (_) { setFlavorPreview({ error: '预览加载失败' }); }
                                                                    }}>👁 预览效果</button>
                                                                    {flavorPreview && !flavorPreview.error && (
                                                                        <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 6, fontSize: 12 }}>
                                                                            {flavorPreview.parts?.map((p, i) => (
                                                                                <div key={i} style={{ marginBottom: 6 }}>
                                                                                    {p.type === 'dialect' && <><span style={{ color: 'var(--neon-cyan)' }}>🗣 {p.label}({p.intensity})</span><div style={{ color: 'var(--text-secondary)', marginTop: 2, fontStyle: 'italic' }}>"{p.example}"</div></>}
                                                                                    {p.type === 'style' && <><span style={{ color: 'var(--neon-orange)' }}>🎭 {p.label}({p.intensity})</span><div style={{ color: 'var(--text-secondary)', marginTop: 2, fontStyle: 'italic' }}>"{p.example}"</div></>}
                                                                                    {p.type === 'combined' && <div style={{ color: 'var(--neon-purple)', fontSize: 11 }}>⚡ {p.note}</div>}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {editForm.dialectRegion && editForm.speechStyle && (
                                                                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--neon-purple)', background: 'rgba(128,0,255,0.08)', padding: '4px 8px', borderRadius: 4 }}>
                                                                    ⚡ 方言+风格组合：方言降为轻度底色，风格为主味
                                                                </div>
                                                            )}
                                                            {editForm.type === 'character' && (
                                                                <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(255,200,0,0.05)', border: '1px solid rgba(255,200,0,0.15)', borderRadius: 6 }}>
                                                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neon-orange)', marginBottom: 8 }}>✒️ 命名规范</div>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                                        <div className="form-group" style={{ margin: 0 }}>
                                                                            <label className="form-label" style={{ fontSize: 11 }}>命名风格</label>
                                                                            <select className="cyber-select" value={editForm.namingStyle || ''} onChange={e => setEditForm({ ...editForm, namingStyle: e.target.value })}>
                                                                                <option value="">自动推断</option>
                                                                                {availableNamingStyles.map(s => <option key={s.id} value={s.id}>{s.label}（{s.tag}）</option>)}
                                                                            </select>
                                                                        </div>
                                                                        <div className="form-group" style={{ margin: 0 }}>
                                                                            <label className="form-label" style={{ fontSize: 11 }}>命名强度</label>
                                                                            <select className="cyber-select" value={editForm.namingStyleIntensity || 'medium'} onChange={e => setEditForm({ ...editForm, namingStyleIntensity: e.target.value })} disabled={!editForm.namingStyle}>
                                                                                <option value="light">轻度</option>
                                                                                <option value="medium">中度</option>
                                                                                <option value="heavy">重度</option>
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                    {editForm.namingStyle && (
                                                                        <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 11, marginTop: 6 }} onClick={async () => {
                                                                            try {
                                                                                const res = await flavorsApi.previewNamingStyle(editForm.namingStyle, editForm.namingStyleIntensity || 'medium');
                                                                                setFlavorPreview(prev => ({ ...prev, namingPreview: res.data }));
                                                                            } catch (_) {}
                                                                        }}>👁 预览命名规范</button>
                                                                    )}
                                                                    {flavorPreview?.namingPreview && (
                                                                        <div style={{ marginTop: 6, padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 6, fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', color: 'var(--text-secondary)' }}>
                                                                            {flavorPreview.namingPreview.prompt?.substring(0, 500)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(128,0,255,0.05)', border: '1px solid rgba(128,0,255,0.15)', borderRadius: 6 }}>
                                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neon-purple)', marginBottom: 8 }}>🃏 人设模板</div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                                                                    <div className="form-group" style={{ margin: 0 }}>
                                                                        <label className="form-label" style={{ fontSize: 11 }}>配角类型（你是哪种人）</label>
                                                                        <select className="cyber-select" value={editForm.archetype || ''} onChange={e => setEditForm({ ...editForm, archetype: e.target.value })}>
                                                                            <option value="">无特定模板</option>
                                                                            {availableArchetypes.map(a => <option key={a.id} value={a.id}>{a.label}（{a.tag}）</option>)}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                                {editForm.archetype && (() => {
                                                                    const selArch = availableArchetypes.find(a => a.id === editForm.archetype);
                                                                    return selArch ? (
                                                                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                                                                            <div style={{ color: 'var(--neon-purple)', marginBottom: 4 }}>📋 {selArch.description}</div>
                                                                            <div>角色功能：{selArch.roleInStory}</div>
                                                                            {selArch.recommendedSpeechStyles?.length > 0 && <div style={{ marginTop: 2 }}>推荐风格：{selArch.recommendedSpeechStyles.join('、')}</div>}
                                                                            {selArch.recommendedDialects?.length > 0 && <div style={{ marginTop: 2 }}>推荐方言：{selArch.recommendedDialects.join('、')}</div>}
                                                                            <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, marginTop: 6 }} onClick={async () => {
                                                                                try {
                                                                                    const res = await flavorsApi.previewCharacterArchetype(editForm.archetype);
                                                                                    setFlavorPreview(prev => ({ ...prev, archetypePreview: res.data }));
                                                                                } catch (_) {}
                                                                            }}>👁 预览四维描写</button>
                                                                            {flavorPreview?.archetypePreview && (
                                                                                <div style={{ marginTop: 6, padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 6, fontSize: 10, whiteSpace: 'pre-wrap', maxHeight: 250, overflow: 'auto', color: 'var(--text-secondary)' }}>
                                                                                    {flavorPreview.archetypePreview.writerPrompt?.substring(0, 800)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="form-group"><label className="form-label">当前内容</label><textarea className="cyber-textarea" value={editForm.currentContent} onChange={e => setEditForm({ ...editForm, currentContent: e.target.value })} rows={10} /></div>
                                                    <div className="form-group"><label className="form-label">变更原因</label><input className="cyber-input" value={editForm.changeReason} onChange={e => setEditForm({ ...editForm, changeReason: e.target.value })} placeholder="记录变更原因..." /></div>
                                                    <div style={{ display: 'flex', gap: 8 }}><button className="cyber-btn cyber-btn-success cyber-btn-sm" onClick={saveEdit}>保存</button><button className="cyber-btn cyber-btn-sm" onClick={() => setIsEditing(false)}>取消</button></div>
                                                </div>
                                            ) : (
                                                <>
                                                    {(() => {
                                                        const planeLabel = mat.parentPlane && mat.parentPlane !== '主世界'
                                                            ? (filteredMaterials.find(m => m.id === mat.parentPlane)?.name || mat.parentPlane)
                                                            : (mat.parentPlane === '主世界' ? '主世界' : null);
                                                        const factionLabel = mat.parentFaction
                                                            ? (filteredMaterials.find(m => m.id === mat.parentFaction)?.name || mat.parentFaction)
                                                            : null;
                                                        return (planeLabel || factionLabel || mat.dialectRegion || mat.speechStyle || mat.namingStyle || mat.archetype) ? (
                                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                                                                {planeLabel && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(0,200,255,0.1)', color: 'var(--neon-cyan)', border: '1px solid rgba(0,200,255,0.2)' }}>🌀 {planeLabel}</span>}
                                                                {factionLabel && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,200,0,0.1)', color: 'var(--neon-orange)', border: '1px solid rgba(255,200,0,0.2)' }}>🏛 {factionLabel}</span>}
                                                                {mat.dialectRegion && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(0,255,150,0.1)', color: 'var(--neon-green)', border: '1px solid rgba(0,255,150,0.2)' }}>🗣 {availableDialects.find(d => d.region === mat.dialectRegion)?.label || mat.dialectRegion}</span>}
                                                                {mat.speechStyle && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,100,255,0.1)', color: 'var(--neon-pink)', border: '1px solid rgba(255,100,255,0.2)' }}>🎭 {availableStyles.find(s => s.id === mat.speechStyle)?.label || mat.speechStyle}</span>}
                                                                {mat.namingStyle && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,200,0,0.1)', color: 'var(--neon-orange)', border: '1px solid rgba(255,200,0,0.2)' }}>✒️ {availableNamingStyles.find(s => s.id === mat.namingStyle)?.label || mat.namingStyle}</span>}
                                                                {mat.archetype && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(128,0,255,0.1)', color: 'var(--neon-purple)', border: '1px solid rgba(128,0,255,0.2)' }}>🃏 {availableArchetypes.find(a => a.id === mat.archetype)?.label || mat.archetype}</span>}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                    {(() => {
                                                        const content = mat.currentContent || '';
                                                        if (!content) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>(空)</div>;
                                                        const fieldRegex = /【([^】]+)】/g;
                                                        const parts = content.split(fieldRegex);
                                                        if (parts.length <= 1) {
                                                            return <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>{content}</div>;
                                                        }
                                                        const fields = [];
                                                        let currentLabel = null;
                                                        for (let i = 0; i < parts.length; i++) {
                                                            if (i % 2 === 1) {
                                                                currentLabel = parts[i];
                                                            } else if (currentLabel && parts[i].trim()) {
                                                                fields.push({ label: currentLabel, value: parts[i].trim() });
                                                                currentLabel = null;
                                                            } else if (!currentLabel && parts[i].trim()) {
                                                                fields.push({ label: null, value: parts[i].trim() });
                                                            }
                                                        }
                                                        const FIELD_COLORS = {
                                                            '核心欲望': '#ff6b9d', '内在矛盾': '#ff6b9d', '行为模式': '#ff6b9d',
                                                            '身份': '#4ecdc4', '与主角关系': '#4ecdc4', '核心欲望': '#ff6b9d',
                                                            '所属位面': '#00c8ff', '势力名': '#ffc800', '定位': '#ffc800',
                                                            '获取方式': '#ff9f43', '限制': '#ff9f43', '代价': '#ff9f43',
                                                            '当前状态': '#a29bfe', '预期回收窗口': '#a29bfe', '关联角色': '#a29bfe',
                                                            '核心规则': '#00c8ff', '视觉特征': '#00c8ff', '主线剧情': '#6c5ce7',
                                                            '系统任务': '#fd79a8', '关键转折': '#fd79a8', '掠夺能力': '#fd79a8',
                                                            '触发条件': '#ffeaa7', '结构': '#ffeaa7', '功能': '#ffeaa7',
                                                            '势力关系': '#ffc800', '更新说明': '#a29bfe', '观察记录': '#a29bfe'
                                                        };
                                                        return (
                                                            <div style={{ maxHeight: 500, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                                {fields.map((f, i) => (
                                                                    <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', borderLeft: `3px solid ${FIELD_COLORS[f.label] || 'var(--border-color)'}` }}>
                                                                        {f.label && <div style={{ fontSize: 11, color: FIELD_COLORS[f.label] || 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>{f.label}</div>}
                                                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{f.value}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}
                                                    {mat.initialContent && mat.initialContent !== mat.currentContent && (
                                                        <details style={{ fontSize: 12, marginTop: 10 }}>
                                                            <summary style={{ color: 'var(--neon-blue)', cursor: 'pointer' }}>查看初始内容</summary>
                                                            <div style={{ padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginTop: 4, color: 'var(--text-muted)', maxHeight: 150, overflow: 'auto' }}>
                                                                {mat.initialContent}
                                                            </div>
                                                        </details>
                                                    )}
                                                    {showHistoryFor === mat.id && mat.changeLog?.length > 0 && (
                                                        <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(126,87,194,0.06)', borderRadius: 6, borderLeft: '3px solid var(--neon-purple)', maxHeight: 200, overflow: 'auto' }}>
                                                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-purple)', marginBottom: 6 }}>📋 变更记录</div>
                                                            {[...mat.changeLog].reverse().map((log, i) => (
                                                                <div key={i} style={{ padding: '5px 0', borderBottom: i < mat.changeLog.length - 1 ? '1px solid var(--border-color)' : 'none', fontSize: 12, lineHeight: 1.5 }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{toBeijingTime(log.timestamp)}</span>
                                                                        {log.chapterNumber && <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, padding: '1px 6px', color: 'var(--neon-blue)' }} onClick={() => goToChapter(log.chapterNumber)}>📖 第{log.chapterNumber}章</button>}
                                                                    </div>
                                                                    <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{log.chapterNumber ? `第${log.chapterNumber}章` : ''} {log.reason || '更新'}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {mat.tags?.length > 0 && (
                                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
                                                            {mat.tags.map((tag, i) => <span key={i} className="cyber-tag">{tag}</span>)}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })() : (
                                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
                                        <div style={{ fontSize: 14 }}>点击左侧素材查看详情</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    </>)}

                    {activeTab === 'quests' && (<>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button className="cyber-btn cyber-btn-primary" onClick={() => {
                                setEditingQuest(null);
                                setQuestForm({ title: '', description: '', status: 'planned', priority: 'normal', parentId: null, notes: '', tags: [] });
                                setShowQuestForm(true);
                            }}>
                                + 新建任务
                            </button>
                            <select className="cyber-select" style={{ maxWidth: 160 }}
                                value={questStatusFilter}
                                onChange={e => {
                                    const v = e.target.value;
                                    setQuestStatusFilter(v);
                                    if (v === 'all') loadQuests();
                                    else questApi.listQuests({ projectId: currentProject.id, status: v }).then(res => setQuests(res.data || [])).catch(console.error);
                                }}>
                                <option value="all">全部状态</option>
                                {Object.entries(QUEST_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                            </select>
                            <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
                                共 {quests.length} 个任务
                            </div>
                        </div>

                        {quests.filter(q => !q.parentId).length === 0 ? (
                            <div className="cyber-card cyber-empty">
                                <div className="cyber-empty-icon">⚔</div>
                                <div>暂无主线任务，点击上方按钮创建</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {quests.filter(q => !q.parentId).map(quest => {
                                    const children = quests.filter(q => q.parentId === quest.id);
                                    const isExpanded = expandedQuests.has(quest.id);
                                    return (
                                        <div key={quest.id}>
                                            <div className="cyber-card" style={{
                                                borderLeft: `4px solid ${QUEST_STATUS_COLORS[quest.status] || 'var(--neon-blue)'}`,
                                                opacity: quest.status === 'abandoned' ? 0.6 : 1
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                            {children.length > 0 && (
                                                                <button className="cyber-btn cyber-btn-sm" style={{ padding: '2px 8px', fontSize: 11 }}
                                                                    onClick={() => toggleQuestExpand(quest.id)}>
                                                                    {isExpanded ? '▼' : '▶'} {children.length}
                                                                </button>
                                                            )}
                                                            <h4 style={{ fontSize: 15, fontWeight: 600 }}>{quest.title}</h4>
                                                            <span className={`cyber-badge ${QUEST_STATUS_BADGE[quest.status] || 'cyber-badge-blue'}`}>
                                                                {QUEST_STATUS_LABELS[quest.status] || quest.status}
                                                            </span>
                                                            {quest.priority !== 'normal' && (
                                                                <span className="cyber-badge" style={{
                                                                    background: 'rgba(255,170,0,0.1)',
                                                                    color: QUEST_PRIORITY_COLORS[quest.priority],
                                                                    border: `1px solid ${QUEST_PRIORITY_COLORS[quest.priority]}40`
                                                                }}>
                                                                    {QUEST_PRIORITY_LABELS[quest.priority] || quest.priority}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {quest.description && (
                                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
                                                                {quest.description.length > 200 ? quest.description.substring(0, 200) + '...' : quest.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 4, marginLeft: 12, flexShrink: 0 }}>
                                                                        {quest.status === 'planned' && (
                                                                            <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-blue)' }}
                                                                                onClick={async () => {
                                                                                    await questApi.updateQuest(quest.id, { status: 'active' });
                                                                                    loadQuests();
                                                                                }}>开始</button>
                                                                        )}
                                                                        {quest.status === 'active' && (
                                                                            <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-green)' }}
                                                                                onClick={async () => {
                                                                                    await questApi.updateQuest(quest.id, { status: 'completed' });
                                                                                    loadQuests();
                                                                                }}>完成</button>
                                                                        )}
                                                                        <button className="cyber-btn cyber-btn-sm" onClick={() => {
                                                                                            setEditingQuest(quest.id);
                                                                                            setQuestForm({
                                                                                                title: quest.title,
                                                                                                description: quest.description || '',
                                                                                                status: quest.status,
                                                                                                priority: quest.priority,
                                                                                                parentId: quest.parentId,
                                                                                                notes: quest.notes || '',
                                                                                                tags: quest.tags || []
                                                                                            });
                                                                                            setShowQuestForm(true);
                                                                                        }}>编辑</button>
                                                                        <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-purple)' }}
                                                                            onClick={() => {
                                                                                setEditingQuest(null);
                                                                                setQuestForm({
                                                                                    title: '',
                                                                                    description: '',
                                                                                    status: 'planned',
                                                                                    priority: 'normal',
                                                                                    parentId: quest.id,
                                                                                    notes: '',
                                                                                    tags: []
                                                                                });
                                                                                setShowQuestForm(true);
                                                                            }}>+ 子任务</button>
                                                                        <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={() => deleteQuest(quest.id)}>删除</button>
                                                    </div>
                                                </div>
                                                {quest.progress > 0 && quest.status !== 'completed' && (
                                                    <div style={{ marginBottom: 6 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                                                            <span>进度</span><span>{quest.progress}%</span>
                                                        </div>
                                                        <div className="cyber-progress">
                                                            <div className="cyber-progress-bar" style={{ width: `${quest.progress}%` }} />
                                                        </div>
                                                    </div>
                                                )}
                                                {quest.status === 'completed' && quest.completedAt && (
                                                    <div style={{ fontSize: 11, color: 'var(--neon-green)' }}>
                                                        ✅ 完成于 {new Date(quest.completedAt).toLocaleString('zh-CN')}
                                                    </div>
                                                )}
                                                {quest.tags?.length > 0 && (
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                                        {quest.tags.map((tag, i) => (
                                                            <span key={i} className="cyber-tag">{tag}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {isExpanded && children.length > 0 && (
                                                <div style={{ marginLeft: 32, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    {children.map(sub => (
                                                        <div key={sub.id} className="cyber-card" style={{
                                                            borderLeft: `3px solid ${QUEST_STATUS_COLORS[sub.status] || 'var(--neon-blue)'}`,
                                                            padding: 14,
                                                            opacity: sub.status === 'abandoned' ? 0.6 : 1
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>└</span>
                                                                    <h5 style={{ fontSize: 14, fontWeight: 600 }}>{sub.title}</h5>
                                                                    <span className={`cyber-badge ${QUEST_STATUS_BADGE[sub.status] || 'cyber-badge-blue'}`} style={{ fontSize: 10 }}>
                                                                        {QUEST_STATUS_LABELS[sub.status] || sub.status}
                                                                    </span>
                                                                    {sub.priority !== 'normal' && (
                                                                        <span style={{ fontSize: 10, color: QUEST_PRIORITY_COLORS[sub.priority] }}>
                                                                            [{QUEST_PRIORITY_LABELS[sub.priority]}]
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div style={{ display: 'flex', gap: 4 }}>
                                                                    {sub.status === 'planned' && (
                                                                        <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-blue)', padding: '2px 8px' }}
                                                                            onClick={async () => { await questApi.updateQuest(sub.id, { status: 'active' }); loadQuests(); }}>开始</button>
                                                                    )}
                                                                    {sub.status === 'active' && (
                                                                        <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-green)', padding: '2px 8px' }}
                                                                            onClick={async () => { await questApi.updateQuest(sub.id, { status: 'completed' }); loadQuests(); }}>完成</button>
                                                                    )}
                                                                    <button className="cyber-btn cyber-btn-sm" style={{ padding: '2px 8px' }} onClick={() => {
                                                                        setEditingQuest(sub.id);
                                                                        setQuestForm({
                                                                            title: sub.title,
                                                                            description: sub.description || '',
                                                                            status: sub.status,
                                                                            priority: sub.priority,
                                                                            parentId: sub.parentId,
                                                                            notes: sub.notes || '',
                                                                            tags: sub.tags || []
                                                                        });
                                                                        setShowQuestForm(true);
                                                                    }}>编辑</button>
                                                                    <button className="cyber-btn cyber-btn-danger cyber-btn-sm" style={{ padding: '2px 8px' }} onClick={() => deleteQuest(sub.id)}>删除</button>
                                                                </div>
                                                            </div>
                                                            {sub.description && (
                                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                                                                    {sub.description.length > 150 ? sub.description.substring(0, 150) + '...' : sub.description}
                                                                </div>
                                                            )}
                                                            {sub.progress > 0 && sub.status !== 'completed' && (
                                                                <div style={{ marginTop: 4 }}>
                                                                    <div className="cyber-progress">
                                                                        <div className="cyber-progress-bar" style={{ width: `${sub.progress}%` }} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>)}

                    {activeTab === 'timeline' && (<>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button className="cyber-btn cyber-btn-primary" onClick={() => {
                                setEditingTimeline(null);
                                setTimelineForm({ title: '', description: '', eventType: 'plot', storyTime: '', location: '', importance: 'normal', isKeyEvent: false, notes: '', tags: [] });
                                setShowTimelineForm(true);
                            }}>
                                + 新建事件
                            </button>
                            <select className="cyber-select" style={{ maxWidth: 160 }}
                                value={timelineTypeFilter}
                                onChange={e => {
                                    const v = e.target.value;
                                    setTimelineTypeFilter(v);
                                    if (v === 'all') loadTimelines();
                                    else questApi.listTimelines({ projectId: currentProject.id, eventType: v }).then(res => setTimelineEvents(res.data || [])).catch(console.error);
                                }}>
                                <option value="all">全部类型</option>
                                {Object.entries(TIMELINE_EVENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                            </select>
                            <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
                                共 {timelineEvents.length} 个事件
                            </div>
                        </div>

                        {timelineEvents.length === 0 ? (
                            <div className="cyber-card cyber-empty">
                                <div className="cyber-empty-icon">📅</div>
                                <div>暂无时间线事件，点击上方按钮创建</div>
                            </div>
                        ) : (
                            <div style={{ position: 'relative', paddingLeft: 24 }}>
                                <div style={{
                                    position: 'absolute', left: 10, top: 0, bottom: 0, width: 2,
                                    background: 'linear-gradient(180deg, var(--neon-blue), var(--neon-purple), var(--neon-pink))',
                                    borderRadius: 1
                                }} />
                                {timelineEvents.map((event, idx) => (
                                    <div key={event.id} style={{ position: 'relative', marginBottom: 16 }}>
                                        <div style={{
                                            position: 'absolute', left: -18, top: 18, width: 12, height: 12,
                                            borderRadius: '50%', background: TIMELINE_EVENT_COLORS[event.eventType] || 'var(--neon-blue)',
                                            border: '2px solid var(--bg-secondary)', boxShadow: `0 0 8px ${TIMELINE_EVENT_COLORS[event.eventType] || 'var(--neon-blue)'}40`
                                        }} />
                                        <div className="cyber-card" style={{
                                            borderLeft: `3px solid ${TIMELINE_EVENT_COLORS[event.eventType] || 'var(--neon-blue)'}`,
                                            marginLeft: 8
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 40 }}>
                                                            #{idx + 1}
                                                        </span>
                                                        <h4 style={{ fontSize: 15, fontWeight: 600 }}>{event.title}</h4>
                                                        <span className={`cyber-badge ${TIMELINE_EVENT_BADGE[event.eventType] || 'cyber-badge-blue'}`}>
                                                            {TIMELINE_EVENT_LABELS[event.eventType] || event.eventType}
                                                        </span>
                                                        {event.isKeyEvent && (
                                                            <span className="cyber-badge cyber-badge-red">🔑 关键</span>
                                                        )}
                                                        {event.importance === 'high' && (
                                                            <span className="cyber-badge cyber-badge-orange">高重要度</span>
                                                        )}
                                                        {event.importance === 'critical' && (
                                                            <span className="cyber-badge cyber-badge-red">核心事件</span>
                                                        )}
                                                    </div>
                                                    {event.description && (
                                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 4 }}>
                                                            {event.description.length > 250 ? event.description.substring(0, 250) + '...' : event.description}
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                                                        {event.storyTime && (
                                                            <span>🕐 {event.storyTime}</span>
                                                        )}
                                                        {event.location && (
                                                            <span>📍 {event.location}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 4, marginLeft: 12, flexShrink: 0 }}>
                                                    <button className="cyber-btn cyber-btn-sm" onClick={() => {
                                                        setEditingTimeline(event.id);
                                                        setTimelineForm({
                                                            title: event.title,
                                                            description: event.description || '',
                                                            eventType: event.eventType,
                                                            storyTime: event.storyTime || '',
                                                            location: event.location || '',
                                                            importance: event.importance || 'normal',
                                                            isKeyEvent: event.isKeyEvent || false,
                                                            notes: event.notes || '',
                                                            tags: event.tags || []
                                                        });
                                                        setShowTimelineForm(true);
                                                    }}>编辑</button>
                                                    <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={() => deleteTimeline(event.id)}>删除</button>
                                                </div>
                                            </div>
                                            {event.tags?.length > 0 && (
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                                    {event.tags.map((tag, i) => (
                                                        <span key={i} className="cyber-tag">{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>)}
                </>
            )}

            {showCreate && (
                <div className="cyber-modal-overlay">
                    <div className="cyber-modal" onClick={e => e.stopPropagation()}>
                        <h2>新建素材</h2>
                        <CreateMaterialForm onSubmit={createMaterial} onCancel={() => setShowCreate(false)} />
                    </div>
                </div>
            )}

            {showQuestForm && (
                <div className="cyber-modal-overlay">
                    <div className="cyber-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 650 }}>
                        <h2>{editingQuest ? '编辑任务' : questForm.parentId ? '新建子任务' : '新建任务'}</h2>
                        <div className="form-group">
                            <label className="form-label">任务标题</label>
                            <input className="cyber-input" value={questForm.title} onChange={e => setQuestForm({ ...questForm, title: e.target.value })} placeholder="输入任务标题..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">任务描述</label>
                            <textarea className="cyber-textarea" value={questForm.description} onChange={e => setQuestForm({ ...questForm, description: e.target.value })} rows={4} placeholder="描述任务内容..." />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">状态</label>
                                <select className="cyber-select" value={questForm.status} onChange={e => setQuestForm({ ...questForm, status: e.target.value })}>
                                    {Object.entries(QUEST_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">优先级</label>
                                <select className="cyber-select" value={questForm.priority} onChange={e => setQuestForm({ ...questForm, priority: e.target.value })}>
                                    {Object.entries(QUEST_PRIORITY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">备注</label>
                            <textarea className="cyber-textarea" value={questForm.notes} onChange={e => setQuestForm({ ...questForm, notes: e.target.value })} rows={3} placeholder="备注信息..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">标签（逗号分隔）</label>
                            <input className="cyber-input" value={questForm.tags?.join(', ') || ''} onChange={e => setQuestForm({ ...questForm, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} placeholder="标签1, 标签2..." />
                        </div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button className="cyber-btn" onClick={() => { setShowQuestForm(false); setEditingQuest(null); }}>取消</button>
                            <button className="cyber-btn cyber-btn-primary" onClick={saveQuest} disabled={!questForm.title.trim()}>
                                {editingQuest ? '保存' : '创建'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showTimelineForm && (
                <div className="cyber-modal-overlay">
                    <div className="cyber-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 650 }}>
                        <h2>{editingTimeline ? '编辑事件' : '新建事件'}</h2>
                        <div className="form-group">
                            <label className="form-label">事件标题</label>
                            <input className="cyber-input" value={timelineForm.title} onChange={e => setTimelineForm({ ...timelineForm, title: e.target.value })} placeholder="输入事件标题..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">事件描述</label>
                            <textarea className="cyber-textarea" value={timelineForm.description} onChange={e => setTimelineForm({ ...timelineForm, description: e.target.value })} rows={4} placeholder="描述事件内容..." />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">事件类型</label>
                                <select className="cyber-select" value={timelineForm.eventType} onChange={e => setTimelineForm({ ...timelineForm, eventType: e.target.value })}>
                                    {Object.entries(TIMELINE_EVENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">重要度</label>
                                <select className="cyber-select" value={timelineForm.importance} onChange={e => setTimelineForm({ ...timelineForm, importance: e.target.value })}>
                                    {Object.entries(IMPORTANCE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">故事内时间</label>
                                <input className="cyber-input" value={timelineForm.storyTime} onChange={e => setTimelineForm({ ...timelineForm, storyTime: e.target.value })} placeholder="如：第一卷第三章 / 永生历1234年" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">地点</label>
                                <input className="cyber-input" value={timelineForm.location} onChange={e => setTimelineForm({ ...timelineForm, location: e.target.value })} placeholder="事件发生地点..." />
                            </div>
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                <div className={`cyber-switch ${timelineForm.isKeyEvent ? 'cyber-switch-active' : ''}`}
                                    onClick={() => setTimelineForm({ ...timelineForm, isKeyEvent: !timelineForm.isKeyEvent })} />
                                <span style={{ color: timelineForm.isKeyEvent ? 'var(--neon-red)' : 'var(--text-secondary)', fontWeight: timelineForm.isKeyEvent ? 600 : 400 }}>
                                    🔑 关键事件
                                </span>
                            </label>
                        </div>
                        <div className="form-group">
                            <label className="form-label">备注</label>
                            <textarea className="cyber-textarea" value={timelineForm.notes} onChange={e => setTimelineForm({ ...timelineForm, notes: e.target.value })} rows={3} placeholder="备注信息..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">标签（逗号分隔）</label>
                            <input className="cyber-input" value={timelineForm.tags?.join(', ') || ''} onChange={e => setTimelineForm({ ...timelineForm, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} placeholder="标签1, 标签2..." />
                        </div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button className="cyber-btn" onClick={() => { setShowTimelineForm(false); setEditingTimeline(null); }}>取消</button>
                            <button className="cyber-btn cyber-btn-primary" onClick={saveTimeline} disabled={!timelineForm.title.trim()}>
                                {editingTimeline ? '保存' : '创建'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPromptPanel && projectPromptData && (
                <div className="cyber-modal-overlay" onClick={() => setShowPromptPanel(false)}>
                    <div className="cyber-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, maxHeight: '85vh', overflow: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ margin: 0 }}>🔍 执笔人注入Prompt总览</h2>
                            <button className="cyber-btn cyber-btn-sm" onClick={() => setShowPromptPanel(false)}>关闭</button>
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                            以下内容是Pipeline运行时自动注入到Writer和Reviewer提示词中的方言/风格规则。角色对话将按这些规则创作。
                        </div>

                        {projectPromptData.characters.length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                                <h3 style={{ fontSize: 14, color: 'var(--neon-cyan)', marginBottom: 8 }}>🎭 角色说话风味明细</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {projectPromptData.characters.map((char, idx) => (
                                        <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 12, border: '1px solid rgba(0,200,255,0.1)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <span style={{ fontSize: 14, fontWeight: 600 }}>{char.name}</span>
                                                {char.dialectRegion && <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 8, background: 'rgba(0,255,150,0.1)', color: 'var(--neon-green)', border: '1px solid rgba(0,255,150,0.2)' }}>🗣 {char.dialectRegion}({char.dialectIntensity})</span>}
                                                {char.speechStyle && <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 8, background: 'rgba(255,100,255,0.1)', color: 'var(--neon-pink)', border: '1px solid rgba(255,100,255,0.2)' }}>🎭 {char.speechStyle}({char.speechStyleIntensity})</span>}
                                                {char.combinedNote && <span style={{ fontSize: 11, color: 'var(--neon-purple)' }}>⚡ {char.combinedNote}</span>}
                                            </div>
                                            {char.dialectPrompt && (
                                                <div style={{ marginBottom: 4 }}>
                                                    <div style={{ fontSize: 11, color: 'var(--neon-green)', marginBottom: 2 }}>方言注入：</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(0,255,150,0.03)', padding: '6px 8px', borderRadius: 4, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{char.dialectPrompt}</div>
                                                </div>
                                            )}
                                            {char.stylePrompt && (
                                                <div>
                                                    <div style={{ fontSize: 11, color: 'var(--neon-pink)', marginBottom: 2 }}>风格注入：</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(255,100,255,0.03)', padding: '6px 8px', borderRadius: 4, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{char.stylePrompt}</div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {projectPromptData.writerPrompt && (
                            <div style={{ marginBottom: 20 }}>
                                <h3 style={{ fontSize: 14, color: 'var(--neon-orange)', marginBottom: 8 }}>✍️ Writer完整注入块</h3>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.4)', padding: 12, borderRadius: 8, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 300, overflow: 'auto', border: '1px solid rgba(255,200,0,0.15)' }}>
                                    {projectPromptData.writerPrompt}
                                </div>
                            </div>
                        )}

                        {projectPromptData.reviewerPrompt && (
                            <div>
                                <h3 style={{ fontSize: 14, color: 'var(--neon-purple)', marginBottom: 8 }}>🔎 Reviewer注入块</h3>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.4)', padding: 12, borderRadius: 8, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 200, overflow: 'auto', border: '1px solid rgba(128,0,255,0.15)' }}>
                                    {projectPromptData.reviewerPrompt}
                                </div>
                            </div>
                        )}

                        {projectPromptData.characters.length === 0 && (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                当前项目没有角色设置了方言或说话风格。<br/>
                                编辑角色素材时在"🎭 说话风味"区域设置即可。
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showIntegrityPanel && integrityReport && (
                <div className="cyber-modal-overlay" onClick={() => setShowIntegrityPanel(false)}>
                    <div className="cyber-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, maxHeight: '85vh', overflow: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ margin: 0 }}>🏥 素材健康检查</h2>
                            <button className="cyber-btn cyber-btn-sm" onClick={() => setShowIntegrityPanel(false)}>关闭</button>
                        </div>

                        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                            <div style={{ background: integrityReport.healthy ? 'rgba(0,255,150,0.1)' : 'rgba(255,80,80,0.1)', border: `1px solid ${integrityReport.healthy ? 'rgba(0,255,150,0.3)' : 'rgba(255,80,80,0.3)'}`, borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: integrityReport.healthy ? 'var(--neon-green)' : 'var(--neon-pink)' }}>{integrityReport.healthy ? '✅ 健康' : '⚠ 有问题'}</div>
                            </div>
                            <div style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>严重</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-pink)' }}>{integrityReport.criticalCount}</div>
                            </div>
                            <div style={{ background: 'rgba(255,200,0,0.08)', border: '1px solid rgba(255,200,0,0.2)', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>警告</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-orange)' }}>{integrityReport.warningCount}</div>
                            </div>
                            <div style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>建议</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-cyan)' }}>{integrityReport.infoCount}</div>
                            </div>
                        </div>

                        {integrityReport.stats && (
                            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--neon-cyan)' }}>📊 素材统计</div>
                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
                                    <span>总计: {integrityReport.stats.total}</span>
                                    <span>👤 主世界角色: {integrityReport.stats.characters?.mainWorld || 0}</span>
                                    <span>🌀 次位面角色: {integrityReport.stats.characters?.subPlane || 0}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 11 }}>
                                    {Object.entries(integrityReport.stats.byType || {}).sort((a,b) => b[1]-a[1]).map(([type, count]) => (
                                        <span key={type} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(0,200,255,0.08)', color: 'var(--neon-cyan)' }}>{MATERIAL_TYPE_LABELS[type] || type}: {count}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {integrityReport.issues.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--neon-orange)' }}>🔍 发现问题</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {integrityReport.issues.map((issue, idx) => (
                                        <div key={idx} style={{
                                            background: issue.severity === 'critical' ? 'rgba(255,80,80,0.08)' : issue.severity === 'warning' ? 'rgba(255,200,0,0.06)' : 'rgba(0,200,255,0.05)',
                                            border: `1px solid ${issue.severity === 'critical' ? 'rgba(255,80,80,0.2)' : issue.severity === 'warning' ? 'rgba(255,200,0,0.15)' : 'rgba(0,200,255,0.1)'}`,
                                            borderRadius: 6, padding: '8px 12px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 12 }}>{issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵'}</span>
                                                <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{issue.message}</span>
                                            </div>
                                            {issue.fixDescription && (
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, paddingLeft: 22 }}>
                                                    💡 {issue.fixDescription}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {integrityReport.issues.length > 0 && (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="cyber-btn" onClick={async () => {
                                    try {
                                        const res = await integrityApi.fix(currentProject.id, { dryRun: true });
                                        setFixResult(res.data);
                                    } catch (_) {}
                                }}>👁 预览修复</button>
                                <button className="cyber-btn" style={{ background: 'rgba(255,80,80,0.2)', borderColor: 'rgba(255,80,80,0.4)' }} onClick={async () => {
                                    try {
                                        const res = await integrityApi.fix(currentProject.id, { dryRun: false });
                                        setFixResult(res.data);
                                        const recheck = await integrityApi.check(currentProject.id);
                                        setIntegrityReport(recheck.data);
                                        if (currentProject) loadMaterials();
                                    } catch (_) {}
                                }}>🔧 执行修复</button>
                            </div>
                        )}

                        {fixResult && (
                            <div style={{ marginTop: 16, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(0,200,255,0.15)' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: fixResult.dryRun ? 'var(--neon-cyan)' : 'var(--neon-green)' }}>
                                    {fixResult.dryRun ? '👁 预览结果（未实际修改）' : '🔧 修复结果'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                    共 {fixResult.totalFixes} 项修复{fixResult.errors > 0 ? `，${fixResult.errors} 项失败` : ''}
                                </div>
                                {fixResult.fixes.map((f, i) => (
                                    <div key={i} style={{ fontSize: 11, color: f.error ? 'var(--neon-pink)' : 'var(--text-secondary)', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        {f.error ? '❌' : '✅'} {f.action}
                                    </div>
                                ))}
                            </div>
                        )}

                        {integrityReport.issues.length === 0 && (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--neon-green)' }}>
                                🎉 所有素材数据健康，无重复、无断链、无归属异常！
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function CreateMaterialForm({ onSubmit, onCancel }) {
    const [form, setForm] = useState({
        name: '',
        type: 'character',
        initialContent: '',
        currentContent: '',
        tags: []
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSubmit(form);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="form-group">
                <label className="form-label">素材名称</label>
                <input className="cyber-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
                <label className="form-label">类型</label>
                <select className="cyber-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    {Object.entries(MATERIAL_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
            </div>
            <div className="form-group">
                <label className="form-label">内容</label>
                <textarea className="cyber-textarea" value={form.currentContent} onChange={e => setForm({ ...form, currentContent: e.target.value, initialContent: e.target.value })} rows={6} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="cyber-btn" onClick={onCancel}>取消</button>
                <button type="submit" className="cyber-btn cyber-btn-primary">创建</button>
            </div>
        </form>
    );
}
