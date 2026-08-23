export default function StatsPanel({ franchises, projects, totalChapters, approvedChapters, currentProject }) {
    return (
        <div className="stat-grid">
            <div className="stat-card">
                <div className="stat-label">世界观</div>
                <div className="stat-value">{franchises.length}</div>
                <div className="stat-sub">系列数量</div>
            </div>
            <div className="stat-card">
                <div className="stat-label">产品总数</div>
                <div className="stat-value">{projects.length}</div>
                <div className="stat-sub">已创建产品</div>
            </div>
            <div className="stat-card">
                <div className="stat-label">章节总数</div>
                <div className="stat-value">{totalChapters}</div>
                <div className="stat-sub">已定稿: {approvedChapters}</div>
            </div>
            <div className="stat-card">
                <div className="stat-label">当前产品</div>
                <div className="stat-value" style={{ fontSize: currentProject ? 20 : 32 }}>
                    {currentProject ? currentProject.name : '未选择'}
                </div>
                <div className="stat-sub">{currentProject ? (currentProject.genre || '未设定类型') : '请选择或创建产品'}</div>
            </div>
        </div>
    );
}
