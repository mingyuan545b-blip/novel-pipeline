export default function ConstraintsCard({ dragHandleProps, currentProject,
    editingConstraints, editConstraints, constraintPresets, projectConstraints,
    startEditConstraints, toggleEditConstraint, saveConstraints, setEditingConstraints }) {
    return (
        <div className="cyber-card">
            <div className="card-header" {...dragHandleProps}>
                <div className="card-title-row">
                    <span className="drag-handle">⋮⋮</span>
                    <h3 className="card-title card-title-purple">🔒 写作约束</h3>
                </div>
                {currentProject && !editingConstraints && (
                    <button className="cyber-btn cyber-btn-sm" onClick={startEditConstraints}>编辑</button>
                )}
            </div>
            {currentProject ? (
                editingConstraints ? (
                    <>
                        <div className="grid-2 gap-4 mb-8">
                            {constraintPresets.map(c => (
                                <button key={c.id} type="button"
                                    className={`cyber-btn cyber-btn-sm ${editConstraints.includes(c.id) ? 'cyber-btn-primary' : ''}`}
                                    style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: 11, padding: '4px 8px' }}
                                    onClick={() => toggleEditConstraint(c.id)}>
                                    {c.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-8">
                            <button className="cyber-btn cyber-btn-sm cyber-btn-primary" onClick={saveConstraints}>保存</button>
                            <button className="cyber-btn cyber-btn-sm" onClick={() => setEditingConstraints(false)}>取消</button>
                        </div>
                    </>
                ) : projectConstraints.length > 0 ? (
                    <div className="tag-group">
                        {projectConstraints.map(c => (
                            <span key={c.id} className="tag-item tag-purple" title={c.desc}>{c.label}</span>
                        ))}
                    </div>
                ) : <div className="text-sm text-muted">未设置约束，点击编辑添加</div>
            ) : (
                <div className="text-sm text-muted">请先选择产品</div>
            )}
        </div>
    );
}
