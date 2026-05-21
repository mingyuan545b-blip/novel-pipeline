import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../store/useAppStore';
import { libraryApi } from '../services/api';

const DEPT_ICONS = {
    '00_叙事之魂部': '🔮', '01_顶层设计部': '🏗️', '02_情节引擎部': '⚙️',
    '03_人物熔炉部': '🎭', '04_对白艺术部': '💬', '05_文笔滤镜部': '🎨', '06_世界构建部': '🌍'
};
const DEPT_COLORS = {
    '00_叙事之魂部': '#9b59b6', '01_顶层设计部': '#3498db', '02_情节引擎部': '#e74c3c',
    '03_人物熔炉部': '#e67e22', '04_对白艺术部': '#2ecc71', '05_文笔滤镜部': '#1abc9c', '06_世界构建部': '#f39c12'
};
const SLOT_LABELS = { L0: '核心层', L1: '活跃层', L2: '近期层', L3: '工作层', L4: '归档层' };
const INJECTION_LABELS = { 'intent-planner': '意图规划', writer: '执笔人', polisher: '润色师', 'material-manager': '素材管理' };

function cleanName(s) { return (s || '').replace(/^\d+_/, ''); }

function TreeNode({ label, icon, color, count, expanded, onToggle, children, depth = 0 }) {
    return (
        <div style={{ marginLeft: depth * 16 }}>
            <div
                onClick={onToggle}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                    cursor: 'pointer', borderRadius: 6, fontSize: 13, fontWeight: 600,
                    background: expanded ? 'var(--bg-secondary)' : 'transparent',
                    transition: 'background 0.15s', userSelect: 'none'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = expanded ? 'var(--bg-secondary)' : 'transparent'}
            >
                <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block', width: 12, textAlign: 'center' }}>▼</span>
                {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
                <span style={{ flex: 1, color }}>{label}</span>
                {count !== undefined && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '1px 7px', borderRadius: 10, minWidth: 24, textAlign: 'center' }}>
                        {count}
                    </span>
                )}
            </div>
            {expanded && <div>{children}</div>}
        </div>
    );
}

function TechLeaf({ tech, selected, onClick }) {
    const meta = tech._meta;
    const disabled = meta?.auto_disabled;
    return (
        <div
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 28px',
                cursor: 'pointer', borderRadius: 6, fontSize: 13,
                background: selected ? 'var(--accent-primary)22' : 'transparent',
                borderLeft: selected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                opacity: disabled ? 0.5 : 1
            }}
            onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
            onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
        >
            <span style={{ fontSize: 12 }}>📖</span>
            <span style={{ flex: 1 }}>{tech.display_name}</span>
            {disabled && <span style={{ fontSize: 10, color: '#ff4757', background: 'rgba(255,71,87,0.1)', padding: '1px 6px', borderRadius: 4 }}>禁用</span>}
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{SLOT_LABELS[tech.context_slot] || ''}</span>
        </div>
    );
}

export default function LibraryPage() {
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
        } catch (e) { console.warn('Tree load failed:', e.message); }
    }, [modeFilter]);

    const loadStats = useCallback(async () => {
        try {
            const res = await libraryApi.getStats();
            setStats(res.data || res);
        } catch (e) { console.warn('Stats load failed:', e.message); }
    }, []);

    const loadTechnique = useCallback(async (id) => {
        try {
            const res = await libraryApi.getTechnique(id);
            setTechDetail(res.data || res);
        } catch (e) { console.warn('Technique load failed:', e.message); }
    }, []);

    const doSearch = useCallback(async () => {
        if (!searchQuery.trim()) { setSearchResults([]); return; }
        try {
            const res = await libraryApi.search({ q: searchQuery, mode: modeFilter || undefined, topK: 30 });
            setSearchResults(res.data || res || []);
            setShowSearch(true);
        } catch (e) { console.warn('Search failed:', e.message); }
    }, [searchQuery, modeFilter]);

    useEffect(() => { loadTree(); loadStats(); }, [loadTree, loadStats]);

    const handleSelectTech = async (id) => {
        setSelectedTech(id);
        await loadTechnique(id);
    };

    const handleSaveField = async (field, value) => {
        if (!selectedTech) return;
        try {
            await libraryApi.updateTechnique(selectedTech, { [field]: Array.isArray(value) ? value : value });
            await loadTechnique(selectedTech);
            setEditingField(null);
        } catch (e) { console.warn('Save failed:', e.message); }
    };

    const handleToggleDisabled = async (id, current) => {
        try {
            await libraryApi.updateMeta(id, { auto_disabled: !current });
            await loadTechnique(id);
            loadStats();
            loadTree();
        } catch (e) { console.warn('Toggle failed:', e.message); }
    };

    const handleResetMeta = async (id) => {
        try {
            await libraryApi.resetMeta(id);
            await loadTechnique(id);
            loadStats();
        } catch (e) { console.warn('Reset failed:', e.message); }
    };

    const expandAll = () => {
        const all = new Set();
        for (const [dept, subs] of Object.entries(treeData)) {
            all.add(dept);
            for (const sub of Object.keys(subs)) all.add(`${dept}/${sub}`);
        }
        setExpandedNodes(all);
    };

    const collapseAll = () => setExpandedNodes(new Set());

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>📚 藏经阁</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        写作技法知识库 · {stats ? `${stats.total}个技法 · ${stats.departments}个部门` : '加载中...'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && doSearch()}
                            placeholder="搜索技法..."
                            style={{
                                padding: '7px 12px 7px 30px', borderRadius: '8px', border: '1px solid var(--border-color)',
                                background: 'var(--input-bg)', color: 'var(--text-primary)', width: '220px', fontSize: '13px'
                            }}
                        />
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}>🔍</span>
                    </div>
                    <select value={modeFilter} onChange={e => setModeFilter(e.target.value)}
                        style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '13px' }}>
                        <option value="">全部模式</option>
                        <option value="novel">长篇</option>
                        <option value="shuangwen">爽文</option>
                        <option value="tomato-short">番茄短篇</option>
                    </select>
                    <button onClick={expandAll} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>展开全部</button>
                    <button onClick={collapseAll} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>折叠全部</button>
                </div>
            </div>

            {stats?.disabled > 0 && (
                <div style={{ padding: '8px 16px', background: 'rgba(255,165,2,0.1)', border: '1px solid rgba(255,165,2,0.3)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#ffa502' }}>
                    ⚠ {stats.disabled}个技法因成功率过低已被自动禁用
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
                <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '12px', maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }}>
                    {showSearch && searchResults.length > 0 ? (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)' }}>搜索结果 ({searchResults.length})</span>
                                <button onClick={() => { setShowSearch(false); setSearchResults([]); }}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>✕ 关闭</button>
                            </div>
                            {searchResults.map(r => (
                                <TechLeaf key={r.id} tech={r} selected={selectedTech === r.id} onClick={() => handleSelectTech(r.id)} />
                            ))}
                        </div>
                    ) : (
                        Object.entries(treeData).map(([dept, subs]) => {
                            const deptCount = Object.values(subs).reduce((s, arr) => s + arr.length, 0);
                            return (
                                <TreeNode
                                    key={dept}
                                    label={cleanName(dept)}
                                    icon={DEPT_ICONS[dept]}
                                    color={DEPT_COLORS[dept]}
                                    count={deptCount}
                                    expanded={expandedNodes.has(dept)}
                                    onToggle={() => toggleNode(dept)}
                                    depth={0}
                                >
                                    {Object.entries(subs).map(([sub, items]) => (
                                        <TreeNode
                                            key={sub}
                                            label={cleanName(sub)}
                                            count={items.length}
                                            expanded={expandedNodes.has(`${dept}/${sub}`)}
                                            onToggle={() => toggleNode(`${dept}/${sub}`)}
                                            depth={1}
                                        >
                                            {items.map(item => (
                                                <TechLeaf
                                                    key={item.id}
                                                    tech={item}
                                                    selected={selectedTech === item.id}
                                                    onClick={() => handleSelectTech(item.id)}
                                                />
                                            ))}
                                        </TreeNode>
                                    ))}
                                </TreeNode>
                            );
                        })
                    )}
                </div>

                <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', alignSelf: 'start' }}>
                    {selectedTech && techDetail ? (
                        <>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <button onClick={() => { setSelectedTech(null); setTechDetail(null); }}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '13px', padding: 0, marginBottom: 4 }}>← 返回列表</button>
                                    <h3 style={{ margin: 0, fontSize: '18px' }}>{techDetail.display_name}</h3>
                                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {cleanName(techDetail.department)} / {cleanName(techDetail.subcategory)}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    {techDetail._meta?.auto_disabled && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,71,87,0.15)', color: '#ff4757' }}>已禁用</span>}
                                    <button onClick={() => handleToggleDisabled(techDetail.id, techDetail._meta?.auto_disabled)}
                                        style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border-color)', background: techDetail._meta?.auto_disabled ? 'rgba(46,213,115,0.1)' : 'rgba(255,71,87,0.1)', color: techDetail._meta?.auto_disabled ? '#2ed573' : '#ff4757' }}>
                                        {techDetail._meta?.auto_disabled ? '启用' : '禁用'}
                                    </button>
                                    <button onClick={() => handleResetMeta(techDetail.id)}
                                        style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                                        重置统计
                                    </button>
                                </div>
                            </div>
                            <div style={{ padding: 20 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                                    {[
                                        { label: '上下文层级', value: SLOT_LABELS[techDetail.context_slot] || techDetail.context_slot },
                                        { label: '注入点', value: INJECTION_LABELS[techDetail.injection_point] || techDetail.injection_point },
                                        { label: '适用模式', value: (techDetail.applicable_modes || []).join(', ') },
                                        { label: '字数影响', value: techDetail.word_count_impact || 'N/A' },
                                        { label: '成功率', value: `${techDetail._meta?.success_rate ?? 50}%`, color: (techDetail._meta?.success_rate || 50) >= 60 ? '#2ed573' : (techDetail._meta?.success_rate || 50) >= 30 ? '#ffa502' : '#ff4757' },
                                        { label: '使用次数', value: `${techDetail._meta?.attempts || 0}次` },
                                    ].map(({ label, value, color }) => (
                                        <div key={label} style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</div>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: color || 'inherit' }}>{value}</div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <h4 style={{ margin: 0, fontSize: 14 }}>检索标签</h4>
                                        {editingField !== 'retrieval_tags' && <button onClick={() => { setEditingField('retrieval_tags'); setEditValue((techDetail.retrieval_tags || []).join(', ')); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 12 }}>编辑</button>}
                                    </div>
                                    {editingField === 'retrieval_tags' ? (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input value={editValue} onChange={e => setEditValue(e.target.value)} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 13 }} />
                                            <button onClick={() => handleSaveField('retrieval_tags', editValue.split(',').map(s => s.trim()).filter(Boolean))} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>保存</button>
                                            <button onClick={() => setEditingField(null)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>取消</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {(techDetail.retrieval_tags || []).map((tag, i) => (
                                                <span key={i} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, background: `${DEPT_COLORS[techDetail.department] || '#666'}22`, color: DEPT_COLORS[techDetail.department] || '#666' }}>{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {['implementation_rules', 'anti_patterns'].map(field => (
                                    <div key={field} style={{ marginBottom: 20 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <h4 style={{ margin: 0, fontSize: 14 }}>{field === 'implementation_rules' ? '实施规则' : '反模式（避免）'}</h4>
                                            {editingField !== field && <button onClick={() => { setEditingField(field); setEditValue((techDetail[field] || []).join('\n')); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 12 }}>编辑</button>}
                                        </div>
                                        {editingField === field ? (
                                            <div>
                                                <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={4} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical' }} />
                                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                                    <button onClick={() => handleSaveField(field, editValue.split('\n').filter(Boolean))} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>保存</button>
                                                    <button onClick={() => setEditingField(null)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>取消</button>
                                                </div>
                                            </div>
                                        ) : (
                                            (techDetail[field] || []).length > 0 ? (
                                                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: field === 'anti_patterns' ? '#ff6b6b' : 'inherit' }}>
                                                    {techDetail[field].map((item, i) => <li key={i}>{item}</li>)}
                                                </ul>
                                            ) : (
                                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>暂无，点击编辑添加</p>
                                            )
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
                            <div style={{ fontSize: 14 }}>点击左侧技法查看详情</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
