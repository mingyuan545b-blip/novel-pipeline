import { CLEANUP_ITEMS } from './constants';

export default function CleanupModal({ cleanupModal, setCleanupModal, cleanupStats, cleanupTargets,
    setCleanupTargets, cleanupKeepLocked, setCleanupKeepLocked, cleanupLoading, cleanupResult, executeCleanup }) {
    if (!cleanupModal) return null;

    const getCleanupDesc = (key, stats) => {
        if (!stats) return '';
        const descs = {
            chapters: `章节 ${stats.chapters.count} 篇 · 审核 ${stats.chapters.reviews} 条`,
            timelines: `时间线 ${stats.timelines.count} 条 · 任务 ${stats.timelines.quests} 条`,
            materials: `总计 ${stats.materials.count} · 锁定 ${stats.materials.locked} · 未锁定 ${stats.materials.unlocked}`,
            knowledge: `记忆层 ${stats.knowledge.memoryLayers} · 快照 ${stats.knowledge.snapshots} · 一致性报告 ${stats.knowledge.consistencyReports}`,
            outlines: `章节大纲 ${stats.outlines.count} 条`,
            logs: `${stats.logs.hasOutput || stats.logs.hasExport ? '有导出文件' : '无导出文件'}`,
            remediation: `${stats.remediation.hasWriterAdditions || stats.remediation.hasReviewAdditions || stats.remediation.hasStyleGuidance ? '有整改数据' : '无整改数据'}`
        };
        return descs[key] || '';
    };

    return (
        <div className="cyber-modal-overlay" onClick={() => setCleanupModal(null)}>
            <div className="cyber-modal modal-wide" onClick={e => e.stopPropagation()}>
                <h2>🧹 数据清理 - {cleanupModal.name}</h2>
                <p className="text-sm text-muted mb-16">选择要清理的数据类别，保留的设定和约束不会被影响</p>
                {cleanupLoading && !cleanupStats ? (
                    <div className="text-center p-20">加载中...</div>
                ) : cleanupStats && (
                    <div className="flex-col gap-8">
                        {CLEANUP_ITEMS.map(item => (
                            <div key={item.key}
                                className={`cyber-card cleanup-item ${cleanupTargets.includes(item.key) ? 'cleanup-item-selected' : ''}`}
                                onClick={() => setCleanupTargets(prev => prev.includes(item.key) ? prev.filter(t => t !== item.key) : [...prev, item.key])}>
                                <div>
                                    <div className="font-semibold text-md">{item.label}</div>
                                    <div className="text-sm text-muted">{getCleanupDesc(item.key, cleanupStats)}</div>
                                </div>
                                <div className="text-xl">{cleanupTargets.includes(item.key) ? '✅' : '⬜'}</div>
                            </div>
                        ))}
                        {cleanupTargets.includes('materials') && (
                            <div className="flex gap-8 p-8" style={{ background: 'var(--bg-input)', borderRadius: 4 }}>
                                <input type="checkbox" checked={cleanupKeepLocked}
                                    onChange={e => setCleanupKeepLocked(e.target.checked)} id="keepLocked" />
                                <label htmlFor="keepLocked" className="text-base cursor-pointer">🔒 保留锁定素材（设定文件）</label>
                            </div>
                        )}
                        <div className="flex gap-8 mt-8">
                            <button className="cyber-btn flex-1" disabled={cleanupTargets.length === 0 || cleanupLoading}
                                onClick={executeCleanup}>
                                {cleanupLoading ? '清理中...' : `清理选中 (${cleanupTargets.length})`}
                            </button>
                            <button className="cyber-btn flex-1" style={{ borderColor: 'var(--text-muted)' }}
                                onClick={() => setCleanupTargets(['chapters', 'timelines', 'materials', 'knowledge', 'outlines', 'logs', 'remediation'])}>
                                全选
                            </button>
                            <button className="cyber-btn flex-1" style={{ borderColor: 'var(--text-muted)' }}
                                onClick={() => setCleanupModal(null)}>关闭</button>
                        </div>
                        {cleanupResult && (
                            <div className="cleanup-result">
                                <div className="font-semibold text-green mb-6">✅ 清理完成</div>
                                <div className="text-sm pre-wrap text-secondary">{JSON.stringify(cleanupResult.cleaned, null, 2)}</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
