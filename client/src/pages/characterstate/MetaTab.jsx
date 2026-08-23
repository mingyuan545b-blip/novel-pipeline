import { GENRE_LABELS, GENRE_COLORS } from './characterStateConstants';

export default function MetaTab({ meta, chapterOptions: _chapterOptions, syncFrom, setSyncFrom, syncTo, setSyncTo, syncMut, handleSync }) {
    if (!meta) return <div className="cyber-card cyber-empty">加载中...</div>;

    return (
        <div className="grid-2">
            <div className="cyber-card">
                <h3 className="text-md font-semibold text-cyan mb-12">系统信息</h3>
                <div className="flex-col gap-8 text-base">
                    <div className="flex-between"><span className="text-muted">当前章节</span><span>第{meta.currentChapter || '未知'}章 / 共{meta.maxChapter || meta.stats?.totalChapters || '?'}章</span></div>
                    <div className="flex-between"><span className="text-muted">题材</span><span style={{ color: GENRE_COLORS[meta.genreId] || 'inherit' }}>{meta.genreLabel || GENRE_LABELS[meta.genreId] || String(meta.genreId || '未知')}</span></div>
                    <div className="flex-between"><span className="text-muted">Schema 字段数</span><span>{meta.schemaFields?.length || 0}</span></div>
                </div>
            </div>
            <div className="cyber-card">
                <h3 className="text-md font-semibold text-pink mb-12">数据统计</h3>
                <div className="flex-col gap-8 text-base">
                    <div className="flex-between"><span className="text-muted">KV 总条目</span><span>{meta.stats?.totalKVEntries || 0}</span></div>
                    <div className="flex-between"><span className="text-muted">状态快照总数</span><span>{meta.stats?.totalStateRecords || 0}</span></div>
                    <div className="flex-between"><span className="text-muted">唯一角色数</span><span>{meta.stats?.uniqueCharacters || 0}</span></div>
                    <div className="flex-between"><span className="text-muted">热点条目数</span><span className="text-orange">{meta.stats?.hotEntries || 0}</span></div>
                </div>
            </div>
            {meta?.schemaFields && (
                <div className="cyber-card" style={{ gridColumn: '1 / -1' }}>
                    <h3 className="text-md font-semibold text-cyan mb-12">Schema 字段定义</h3>
                    <div className="grid-auto-200">
                        {meta.schemaFields.map(f => (
                            <div key={f.key} className="rounded text-sm p-4" style={{ background: 'var(--bg-secondary)' }}>
                                <span className="text-muted">{f.label}</span>
                                <span className="ml-8 text-purple font-mono">({f.key}: {f.type})</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="cyber-card" style={{ gridColumn: '1 / -1' }}>
                <h3 className="text-md font-semibold text-orange mb-12">数据迁移</h3>
                <p className="text-sm text-muted mb-12">从旧版 materialManagerOutput 提取角色状态数据并迁移到新的 state_kv_index 和 character_states 表。</p>
                <div className="flex gap-8 items-center flex-wrap">
                    <label className="text-sm text-muted">从章节:</label>
                    <input className="cyber-input max-w-80 text-sm" placeholder="可选" value={syncFrom} onChange={e => setSyncFrom(e.target.value)} />
                    <label className="text-sm text-muted">到章节:</label>
                    <input className="cyber-input max-w-80 text-sm" placeholder="可选" value={syncTo} onChange={e => setSyncTo(e.target.value)} />
                    <button className="cyber-btn cyber-btn-sm" onClick={handleSync} disabled={syncMut.isPending}>{syncMut.isPending ? '同步中...' : '执行同步'}</button>
                    {syncMut.isSuccess && <span className="text-sm text-green">成功同步 {syncMut.data?.synced}/{syncMut.data?.total} 章</span>}
                </div>
            </div>
        </div>
    );
}
