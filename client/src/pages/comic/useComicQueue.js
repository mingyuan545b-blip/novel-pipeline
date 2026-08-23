import { useState } from 'react';
import { comicApi } from '../../services/api';

const QUEUE_STATUS = {
    pending: { label: '排队中', color: 'var(--text-muted)', icon: '◷' },
    running: { label: '渲染中', color: 'var(--neon-orange)', icon: '◉' },
    completed: { label: '已完成', color: 'var(--neon-green)', icon: '✓' },
    failed: { label: '失败', color: 'var(--neon-red)', icon: '✗' },
    cancelled: { label: '已取消', color: 'var(--text-muted)', icon: '○' },
};

export default function useComicQueue(currentProject) {
    const [queue, setQueue] = useState([]);
    const [stats, setStats] = useState({ pending: 0, running: 0, completed: 0, failed: 0 });

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
                failed: items.filter(i => i.status === 'failed').length,
            });
        } catch { setQueue([]); }
    };

    const handleCancel = async (id) => {
        try { await comicApi.cancelRender(id); await loadQueue(); }
        catch (e) { alert('取消失败: ' + e.message); }
    };

    const handleRetry = async (id) => {
        try { await comicApi.retryRender(id); await loadQueue(); }
        catch (e) { alert('重试失败: ' + e.message); }
    };

    const handleClearCompleted = async () => {
        try { await comicApi.clearCompleted(currentProject.id); await loadQueue(); }
        catch (e) { alert('清除失败: ' + e.message); }
    };

    return { queue, stats, loadQueue, handleCancel, handleRetry, handleClearCompleted, QUEUE_STATUS };
}
