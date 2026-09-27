import useLibraryState from './library/useLibraryState';
import { DEPT_ICONS, DEPT_COLORS, SLOT_LABELS, INJECTION_LABELS, DEPTH_LABELS, DEPTH_COLORS, cleanName } from './library/useLibraryState';
import { TreeNode, TechLeaf } from './library/BookCard';
import FeedbackPanel from './library/FeedbackPanel';
import ExtractDialog from './library/ExtractDialog';
import useExtractState from './library/useExtractState';
import s from './library/library.module.css';

const VIEW_TABS = [
    { key: 'department', label: '按部门' },
    { key: 'depth', label: '按深度' },
];

export default function LibraryPage() {
    const {
        treeData, stats, expandedNodes, selectedTech, techDetail, currentProject,
        searchQuery, setSearchQuery, searchResults, modeFilter, setModeFilter,
        editingField, setEditingField, editValue, setEditValue, showSearch,
        viewMode, setViewMode, depthTree, feedbackData, loadFeedback,
        toggleNode, handleSelectTech, handleSaveField, handleToggleDisabled,
        handleResetMeta, expandAll, collapseAll, doSearch, closeSearch, reload,
    } = useLibraryState();

    // 一键提取：提取完成后刷新技法树（新技法直接入库）
    const extractState = useExtractState({ onFinished: () => reload?.() });

    const renderDetail = () => {
        if (!selectedTech || !techDetail) return <div className={s.emptyDetail}><div style={{ fontSize: 40, marginBottom: 12 }}>📖</div><div style={{ fontSize: 14 }}>点击左侧技法查看详情</div></div>;
        const metaItems = [
            { label: '上下文层级', value: SLOT_LABELS[techDetail.context_slot] || techDetail.context_slot },
            { label: '注入点', value: INJECTION_LABELS[techDetail.injection_point] || techDetail.injection_point },
            { label: '适用模式', value: (techDetail.applicable_modes || []).join(', ') },
            { label: '字数影响', value: techDetail.word_count_impact || 'N/A' },
            { label: '成功率', value: `${techDetail._meta?.success_rate ?? 50}%`, color: (techDetail._meta?.success_rate || 50) >= 60 ? '#2ed573' : (techDetail._meta?.success_rate || 50) >= 30 ? '#ffa502' : '#ff4757' },
            { label: '使用次数', value: `${techDetail._meta?.attempts || 0}次` },
        ];
        return (
            <>
                <div className={s.detailHeader}>
                    <div>
                        <button onClick={() => { handleSelectTech(null); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 4 }}>← 返回列表</button>
                        <h3 style={{ margin: 0, fontSize: 18 }}>{techDetail.display_name}</h3>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{cleanName(techDetail.department)} / {cleanName(techDetail.subcategory)}</p>
                    </div>
                    <div className="flex gap-8 items-center">
                        {techDetail._meta?.auto_disabled && <span className={s.disabledBadge}>已禁用</span>}
                        <button onClick={() => handleToggleDisabled(techDetail.id, techDetail._meta?.auto_disabled)} className={`${s.toggleBtn} ${techDetail._meta?.auto_disabled ? s.toggleBtnEnable : s.toggleBtnDisable}`}>{techDetail._meta?.auto_disabled ? '启用' : '禁用'}</button>
                        <button onClick={() => handleResetMeta(techDetail.id)} className={s.resetBtn}>重置统计</button>
                    </div>
                </div>
                <div className={s.detailBody}>
                    <div className={s.statGrid}>
                        {metaItems.map(({ label, value, color }) => (
                            <div key={label} className={s.statItem}><div className={s.statLabel}>{label}</div><div className={s.statValue} style={{ color: color || 'inherit' }}>{value}</div></div>
                        ))}
                    </div>
                    <div className="mb-20">
                        <div className="flex-between mb-8"><h4 style={{ margin: 0, fontSize: 14 }}>检索标签</h4>{editingField !== 'retrieval_tags' && <button onClick={() => { setEditingField('retrieval_tags'); setEditValue((techDetail.retrieval_tags || []).join(', ')); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 12 }}>编辑</button>}</div>
                        {editingField === 'retrieval_tags' ? (
                            <div className="flex gap-8"><input value={editValue} onChange={e => setEditValue(e.target.value)} className={s.editInlineInput} /><button onClick={() => handleSaveField('retrieval_tags', editValue.split(',').map(s => s.trim()).filter(Boolean))} className={s.saveBtn}>保存</button><button onClick={() => setEditingField(null)} className={s.cancelBtn}>取消</button></div>
                        ) : (
                            <div className="flex gap-6 flex-wrap">{(techDetail.retrieval_tags || []).map((tag, i) => <span key={i} className={s.tagChip} style={{ background: `${DEPT_COLORS[techDetail.department] || '#666'}22`, color: DEPT_COLORS[techDetail.department] || '#666' }}>{tag}</span>)}</div>
                        )}
                    </div>
                    {['implementation_rules', 'anti_patterns'].map(field => (
                        <div key={field} className="mb-20">
                            <div className="flex-between mb-8"><h4 style={{ margin: 0, fontSize: 14 }}>{field === 'implementation_rules' ? '实施规则' : '反模式（避免）'}</h4>{editingField !== field && <button onClick={() => { setEditingField(field); setEditValue((techDetail[field] || []).join('\n')); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 12 }}>编辑</button>}</div>
                            {editingField === field ? (
                                <div><textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={4} className="cyber-textarea" /><div className="flex gap-8 mt-8"><button onClick={() => handleSaveField(field, editValue.split('\n').filter(Boolean))} className={s.saveBtn}>保存</button><button onClick={() => setEditingField(null)} className={s.cancelBtn}>取消</button></div></div>
                            ) : (
                                (techDetail[field] || []).length > 0 ? <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: field === 'anti_patterns' ? '#ff6b6b' : 'inherit' }}>{techDetail[field].map((item, i) => <li key={i}>{item}</li>)}</ul> : <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>暂无，点击编辑添加</p>
                            )}
                        </div>
                    ))}
                </div>
            </>
        );
    };

    return (
        <div className={s.pageContainer}>
            <div className="flex-between mb-20">
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>📚 藏经阁</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>写作技法知识库 · {stats ? `${stats.total}个技法 · ${stats.departments}个部门` : '加载中...'}</p>
                </div>
                <div className="flex gap-8 items-center">
                    <div style={{ position: 'relative' }}>
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} placeholder="搜索技法..." className={s.searchInput} />
                        <span className={s.searchIcon}>🔍</span>
                    </div>
                    <select value={modeFilter} onChange={e => setModeFilter(e.target.value)} className={s.modeSelect}>
                        <option value="">全部模式</option><option value="novel">长篇</option><option value="shuangwen">爽文</option><option value="tomato-short">番茄短篇</option>
                    </select>
                    <button onClick={() => extractState.setOpen(true)} className={s.saveBtn}>⬆ 一键提取</button>
                    <button onClick={expandAll} className={s.toolbarBtn}>展开全部</button>
                    <button onClick={collapseAll} className={s.toolbarBtn}>折叠全部</button>
                </div>
            </div>
            {stats?.disabled > 0 && <div className={s.warnBanner}>⚠ {stats.disabled}个技法因成功率过低已被自动禁用</div>}
            <div className="grid-2" style={{ gridTemplateColumns: '320px 1fr' }}>
                <div className={s.treePanel}>
                    <div className="flex gap-4 mb-8 px-8">
                        {VIEW_TABS.map(tab => (
                            <button key={tab.key} onClick={() => setViewMode(tab.key)}
                                className={viewMode === tab.key ? s.tabActive : s.tabInactive}>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    {showSearch && searchResults.length > 0 ? (
                        <div>
                            <div className="flex-between mb-8 px-8"><span className="text-base font-semibold text-blue">搜索结果 ({searchResults.length})</span><button onClick={closeSearch} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>✕ 关闭</button></div>
                            {searchResults.map(r => <TechLeaf key={r.id} tech={r} selected={selectedTech === r.id} onClick={() => handleSelectTech(r.id)} />)}
                        </div>
                    ) : viewMode === 'depth' ? (
                        Object.entries(depthTree).map(([depth, depts]) => {
                            const depthCount = Object.values(depts).reduce((s, subs) => s + Object.values(subs).reduce((s2, arr) => s2 + arr.length, 0), 0);
                            return (
                                <TreeNode key={depth} label={DEPTH_LABELS[depth] || depth} icon={depth === 'macro' ? '🏛️' : depth === 'meso' ? '⚙️' : '🔍'} color={DEPTH_COLORS[depth]} count={depthCount} expanded={expandedNodes.has(depth)} onToggle={() => toggleNode(depth)} depth={0}>
                                    {Object.entries(depts).map(([dept, subs]) => (
                                        <TreeNode key={dept} label={cleanName(dept)} icon={DEPT_ICONS[dept]} color={DEPT_COLORS[dept]} count={Object.values(subs).reduce((s, arr) => s + arr.length, 0)} expanded={expandedNodes.has(`${depth}/${dept}`)} onToggle={() => toggleNode(`${depth}/${dept}`)} depth={1}>
                                            {Object.entries(subs).map(([sub, items]) => (
                                                <TreeNode key={sub} label={cleanName(sub)} count={items.length} expanded={expandedNodes.has(`${depth}/${dept}/${sub}`)} onToggle={() => toggleNode(`${depth}/${dept}/${sub}`)} depth={2}>
                                                    {items.map(item => <TechLeaf key={item.id} tech={item} selected={selectedTech === item.id} onClick={() => handleSelectTech(item.id)} />)}
                                                </TreeNode>
                                            ))}
                                        </TreeNode>
                                    ))}
                                </TreeNode>
                            );
                        })
                    ) : (
                        Object.entries(treeData).map(([dept, subs]) => {
                            const deptCount = Object.values(subs).reduce((s, arr) => s + arr.length, 0);
                            return (
                                <TreeNode key={dept} label={cleanName(dept)} icon={DEPT_ICONS[dept]} color={DEPT_COLORS[dept]} count={deptCount} expanded={expandedNodes.has(dept)} onToggle={() => toggleNode(dept)} depth={0}>
                                    {Object.entries(subs).map(([sub, items]) => (
                                        <TreeNode key={sub} label={cleanName(sub)} count={items.length} expanded={expandedNodes.has(`${dept}/${sub}`)} onToggle={() => toggleNode(`${dept}/${sub}`)} depth={1}>
                                            {items.map(item => <TechLeaf key={item.id} tech={item} selected={selectedTech === item.id} onClick={() => handleSelectTech(item.id)} />)}
                                        </TreeNode>
                                    ))}
                                </TreeNode>
                            );
                        })
                    )}
                </div>
                <div className={s.detailPanel}>{renderDetail()}</div>
            </div>
            <ExtractDialog state={extractState} />
            <FeedbackPanel feedbackData={feedbackData} projectId={currentProject?.id} onRefresh={loadFeedback} />
        </div>
    );
}
