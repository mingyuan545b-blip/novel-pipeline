import { useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import useComicQueue from './comic/useComicQueue';
import { QueueStats, QueueTable } from './comic/QueueComponents';

export default function ComicRenderPage() {
    const { currentProject } = useAppStore();
    const { queue, stats, loadQueue, handleCancel, handleRetry, handleClearCompleted, QUEUE_STATUS } = useComicQueue(currentProject);

    useEffect(() => {
        loadQueue();
        const interval = setInterval(loadQueue, 5000);
        return () => clearInterval(interval);
    }, [currentProject]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">渲染队列</h1>
                <p className="page-subtitle">查看和管理 ComfyUI 渲染任务队列</p>
            </div>

            <QueueStats stats={stats} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="cyber-btn" onClick={handleClearCompleted}>清除已完成</button>
            </div>

            <QueueTable queue={queue} queueStatus={QUEUE_STATUS} onCancel={handleCancel} onRetry={handleRetry} />
        </div>
    );
}
