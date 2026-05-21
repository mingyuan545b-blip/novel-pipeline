import { useState, useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import { comicApi } from '../services/api';

const QUEUE_STATUS = {
    pending: { label: '排队中', color: 'var(--text-muted)', icon: '◷' },
    running: { label: '渲染中', color: 'var(--neon-orange)', icon: '◉' },
    completed: { label: '已完成', color: 'var(--neon-green)', icon: '✓' },
    failed: { label: '失败', color: 'var(--neon-red)', icon: '✗' },
    cancelled: { label: '已取消', color: 'var(--text-muted)', icon: '○' }
};

export default function ComicRenderPage() {
    const { currentProject } = useAppStore();
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ pending: 0, running: 0, completed: 0, failed: 0 });

    useEffect(() => {
        loadQueue();
        const interval = setInterval(loadQueue, 5000);
        return () => clearInterval(interval);
    }, [currentProject]);

    const loadQueue = async () => {
        if (!currentProject) return;
        try {
            const res = await comicApi.getRenderQueue(currentProject.id);
            const items = res.data || [];
            setQueue(items);
            setStats({
                pending: items.filter(i => i.status === 'pending').length,
                running: items.filter(i => i.status === 'running').length,
                completed: items.filter(i => i.status === 'completed').length,
                failed: items.filter(i => i.status === 'failed').length
            });
        } catch (e) {
            setQueue([]);
        }
    };

    const handleCancel = async (id) => {
        try {
            await comicApi.cancelRender(id);
            await loadQueue();
        } catch (e) {
            alert('取消失败: ' + e.message);
        }
    };

    const handleRetry = async (id) => {
        try {
            await comicApi.retryRender(id);
            await loadQueue();
        } catch (e) {
            alert('重试失败: ' + e.message);
        }
    };

    const handleClearCompleted = async () => {
        try {
            await comicApi.clearCompleted(currentProject.id);
            await loadQueue();
        } catch (e) {
            alert('清除失败: ' + e.message);
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">渲染队列</h1>
                <p className="page-subtitle">查看和管理 ComfyUI 渲染任务队列</p>
            </div>

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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="cyber-btn" onClick={handleClearCompleted}>
                    清除已完成
                </button>
            </div>

            {queue.length === 0 ? (
                <div className="cyber-card" style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>◈</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>渲染队列为空</div>
                </div>
            ) : (
                <div className="table-container">
                    <table className="cyber-table">
                        <thead>
                            <tr>
                                <th>状态</th>
                                <th>分镜</th>
                                <th>工作流</th>
                                <th>进度</th>
                                <th>耗时</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {queue.map(item => {
                                const statusInfo = QUEUE_STATUS[item.status] || QUEUE_STATUS.pending;
                                return (
                                    <tr key={item.id}>
                                        <td>
                                            <span style={{ color: statusInfo.color, fontWeight: 600 }}>
                                                {statusInfo.icon} {statusInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.storyboardName || item.storyboardId?.substring(0, 8)}
                                        </td>
                                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            {item.workflowName || '-'}
                                        </td>
                                        <td>
                                            {item.status === 'running' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ flex: 1, height: 4, background: 'var(--border-color)', borderRadius: 2 }}>
                                                        <div style={{
                                                            width: `${item.progress || 0}%`, height: '100%',
                                                            background: 'var(--neon-orange)', borderRadius: 2,
                                                            transition: 'width 0.3s'
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: 11, color: 'var(--neon-orange)' }}>{item.progress || 0}%</span>
                                                </div>
                                            ) : item.status === 'completed' ? (
                                                <span style={{ color: 'var(--neon-green)', fontSize: 12 }}>100%</span>
                                            ) : '-'}
                                        </td>
                                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            {item.elapsed ? `${item.elapsed}s` : '-'}
                                        </td>
                                        <td>
                                            {item.status === 'pending' && (
                                                <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-red)' }}
                                                    onClick={() => handleCancel(item.id)}>取消</button>
                                            )}
                                            {item.status === 'failed' && (
                                                <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-orange)' }}
                                                    onClick={() => handleRetry(item.id)}>重试</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
