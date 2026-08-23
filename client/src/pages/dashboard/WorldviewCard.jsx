import ProjectCard from './ProjectCard';

export default function WorldviewCard({ dragHandleProps, franchises, standaloneProjects,
    currentProject, selectProject, deleteProject, deleteFranchise,
    toggleFranchise, expandedFranchises, openCreateProduct,
    setShowCreateFranchise, setShowCreate, openCleanupModal }) {
    return (
        <div className="cyber-card">
            <div className="card-header" {...dragHandleProps}>
                <div className="card-title-row">
                    <span className="drag-handle">⋮⋮</span>
                    <h3 className="card-title card-title-cyan">🌍 世界观与产品</h3>
                </div>
                <div className="flex gap-8">
                    <button className="cyber-btn cyber-btn-sm" onClick={() => setShowCreateFranchise(true)}>+ 世界观</button>
                    <button className="cyber-btn cyber-btn-primary cyber-btn-sm" onClick={() => setShowCreate(true)}>+ 独立产品</button>
                </div>
            </div>
            <div className="flex-col gap-8">
                {franchises.length === 0 && standaloneProjects.length === 0 && (
                    <div className="cyber-empty">
                        <div className="cyber-empty-icon">⬡</div>
                        <div>暂无世界观，点击上方按钮创建</div>
                    </div>
                )}
                {franchises.map(f => (
                    <div key={f.id} className="cyber-card" style={{ padding: 0 }}>
                        <div
                            className={`franchise-header ${expandedFranchises[f.id] ? 'franchise-header-expanded' : ''}`}
                            onClick={() => toggleFranchise(f.id)}
                        >
                            <div className="flex gap-8" style={{ alignItems: 'center' }}>
                                <span className={`expand-arrow ${expandedFranchises[f.id] ? 'expand-arrow-open' : ''}`}>▶</span>
                                <div>
                                    <div className="font-semibold" style={{ fontSize: 15 }}>🌍 {f.name}</div>
                                    <div className="text-sm text-muted">{f.genre || '未设定类型'} · {(f.projects || []).length}部产品</div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button className="cyber-btn cyber-btn-sm" onClick={e => { e.stopPropagation(); openCreateProduct(f.id); }}>+ 新产品</button>
                                <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={e => deleteFranchise(e, f.id)}>删除</button>
                            </div>
                        </div>
                        {expandedFranchises[f.id] && (f.projects || []).length > 0 && (
                            <div className="franchise-children">
                                {f.projects.map(p => (
                                    <ProjectCard key={p.id} project={p} variant="franchise-inner"
                                        isActive={currentProject?.id === p.id}
                                        onSelect={selectProject} onDelete={deleteProject}
                                        onCleanup={openCleanupModal} />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {standaloneProjects.length > 0 && franchises.length > 0 && (
                    <div className="mt-8 pt-8" style={{ borderTop: '1px dashed var(--border-color)' }}>
                        <div className="text-sm text-muted mb-8">独立产品（未归属世界观）</div>
                    </div>
                )}
                {standaloneProjects.map(p => (
                    <ProjectCard key={p.id} project={p}
                        isActive={currentProject?.id === p.id}
                        onSelect={selectProject} onDelete={deleteProject}
                        onCleanup={openCleanupModal} />
                ))}
            </div>
        </div>
    );
}
