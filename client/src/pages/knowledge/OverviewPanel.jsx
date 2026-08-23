import { DIMENSION_LABELS } from './knowledgeConstants';
import './knowledge.css';

export default function OverviewPanel({ overview, onRefresh }) {
    if (!overview) return <div className="knowledge-loading-placeholder">加载中...</div>;

    const stats = [
        { label: '总章节数', value: overview.totalChapters || 0, icon: '▦' },
        { label: '素材条目', value: overview.activeMaterials || 0, icon: '⬡' },
        { label: '快照记录', value: overview.snapshotCount || 0, icon: '◈' },
        { label: '活跃角色', value: overview.characterStats?.active || 0, icon: '◉' },
        { label: '紧急伏笔', value: overview.foreshadowingStats?.urgent || 0, icon: '⚠' },
        { label: '一致性', value: overview.consistencyStats?.latestPassed ? '✓ 通过' : '✗ 有问题', icon: '⬢' }
    ];

    return (
        <div>
            <div className="overview-stats-grid">
                {stats.map(s => (
                    <div key={s.label} className="overview-stat-card">
                        <div className="overview-stat-icon">{s.icon}</div>
                        <div className="overview-stat-value">{s.value}</div>
                        <div className="overview-stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {overview.materialStats && (
                <div className="overview-material-card">
                    <h3 className="overview-material-title">素材分布</h3>
                    <div className="overview-material-list">
                        {Object.entries(overview.materialStats).map(([type, count]) => (
                            <div key={type} className="overview-material-item">
                                <span className="overview-material-type">{DIMENSION_LABELS[type] || type}</span>
                                <span className="overview-material-count">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <button className="overview-refresh-btn" onClick={onRefresh}>刷新总览</button>
        </div>
    );
}
