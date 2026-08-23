export default function ConstraintList({ constraints, selectedConstraint, setSelectedConstraint, currentProject, applying, applyConstraintsToProject }) {
    if (constraints.length === 0) {
        return <div className="cyber-card cyber-empty"><div className="cyber-empty-icon">🔒</div><div>暂无约束预设</div></div>;
    }

    return (
        <div className="grid-auto-320">
            {constraints.map(c => {
                const name = c.label || c.name || c.id;
                const desc = c.desc || c.description || '';
                const rules = c.rules || c.conditions || null;
                const injectionPoint = c.injection_point || c.injectionPoint || '';
                const department = c.department || c.category || '';
                return (
                    <div key={c.id} className="cyber-card cursor-pointer"
                        onClick={() => setSelectedConstraint(selectedConstraint?.id === c.id ? null : c)}
                        style={{ borderLeft: selectedConstraint?.id === c.id ? '3px solid var(--neon-blue)' : '3px solid transparent' }}>
                        <div className="flex-between mb-6">
                            <h4 className="text-md font-semibold" style={{ margin: 0 }}>{name}</h4>
                            {department && <span className="cyber-badge cyber-badge-blue">{department}</span>}
                        </div>
                        {desc && <div className="text-sm lh-1-5 mb-6 text-secondary">{desc}</div>}
                        {selectedConstraint?.id === c.id && rules && (
                            <div className="mt-8 p-8 rounded text-sm pre-wrap lh-1-6 max-h-200 overflow-auto" style={{ background: 'var(--bg-secondary)' }}>
                                {typeof rules === 'string' ? rules : JSON.stringify(rules, null, 2)}
                            </div>
                        )}
                        {injectionPoint && <div className="text-sm text-muted mt-4">注入点: {injectionPoint}</div>}
                        <div className="flex-between mt-6">
                            <div className="text-xs text-muted">ID: {c.id}</div>
                            {currentProject?.id && (
                                <button className="cyber-btn cyber-btn-sm text-sm" disabled={applying}
                                    onClick={e => { e.stopPropagation(); applyConstraintsToProject([c.id]); }}>应用</button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
