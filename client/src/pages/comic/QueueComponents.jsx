export function QueueStats({ stats }) {
    return (
        <div className="stat-grid">
            <div className="stat-card">
                <div className="stat-label">排队中</div>
                <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{stats.pending}</div>
            </div>
            <div className="stat-card">
                <div className="stat-label">渲染中</div>
                <div className="stat-value" style={{ color: 'var(--neon-orange)' }}>{stats.running}</div>
            </div>
            <div className="stat-card">
                <div className="stat-label">已完成</div>
                <div className="stat-value" style={{ color: 'var(--neon-green)' }}>{stats.completed}</div>
            </div>
            <div className="stat-card">
                <div className="stat-label">失败</div>
                <div className="stat-value" style={{ color: 'var(--neon-red)' }}>{stats.failed}</div>
            </div>
        </div>
    );
}

export function QueueTable({ queue, queueStatus, onCancel, onRetry }) {
    if (queue.length === 0) {
        return (
            <div className="cyber-card" style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>◈</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>渲染队列为空</div>
            </div>
        );
    }

    return (
        <div className="table-container">
            <table className="cyber-table">
                <thead>
                    <tr><th>状态</th><th>分镜</th><th>工作流</th><th>进度</th><th>耗时</th><th>操作</th></tr>
                </thead>
                <tbody>
                    {queue.map(item => (
                        <QueueRow key={item.id} item={item} queueStatus={queueStatus} onCancel={onCancel} onRetry={onRetry} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function QueueRow({ item, queueStatus, onCancel, onRetry }) {
    const statusInfo = queueStatus[item.status] || queueStatus.pending;
    return (
        <tr>
            <td><span style={{ color: statusInfo.color, fontWeight: 600 }}>{statusInfo.icon} {statusInfo.label}</span></td>
            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.storyboardName || item.storyboardId?.substring(0, 8)}
            </td>
            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.workflowName || '-'}</td>
            <td><ProgressCell status={item.status} progress={item.progress} /></td>
            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.elapsed ? `${item.elapsed}s` : '-'}</td>
            <td>
                {item.status === 'pending' && (
                    <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-red)' }} onClick={() => onCancel(item.id)}>取消</button>
                )}
                {item.status === 'failed' && (
                    <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-orange)' }} onClick={() => onRetry(item.id)}>重试</button>
                )}
            </td>
        </tr>
    );
}

function ProgressCell({ status, progress }) {
    if (status === 'running') {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 4, background: 'var(--border-color)', borderRadius: 2 }}>
                    <div style={{ width: `${progress || 0}%`, height: '100%', background: 'var(--neon-orange)', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--neon-orange)' }}>{progress || 0}%</span>
            </div>
        );
    }
    if (status === 'completed') {
        return <span style={{ color: 'var(--neon-green)', fontSize: 12 }}>100%</span>;
    }
    return '-';
}
