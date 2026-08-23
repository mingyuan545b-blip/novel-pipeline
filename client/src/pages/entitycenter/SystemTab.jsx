function SystemTab({ csMeta, syncFrom, setSyncFrom, syncTo, setSyncTo, handleSync, syncMut, handleMigrateChineseKeys }) {
    return (
        <div>
            <div className="cyber-card ec-border-cyan ec-mb-12">
                <h3 className="ec-text-14 ec-font-600 ec-mb-8 ec-color-cyan">状态系统信息</h3>
                <div className="ec-grid-2 ec-gap-12">
                    <div>
                        <div className="ec-text-12 ec-text-muted">当前章节</div>
                        <div className="ec-text-14">第 {csMeta?.currentChapter || '?'} 章</div>
                    </div>
                    <div>
                        <div className="ec-text-12 ec-text-muted">题材</div>
                        <div className="ec-text-14">{csMeta?.genreLabel || '未指定'}</div>
                    </div>
                    <div>
                        <div className="ec-text-12 ec-text-muted">KV条目数</div>
                        <div className="ec-text-14">{csMeta?.stats?.totalKVEntries || 0}</div>
                    </div>
                    <div>
                        <div className="ec-text-12 ec-text-muted">状态记录数</div>
                        <div className="ec-text-14">{csMeta?.stats?.totalStateRecords || 0}</div>
                    </div>
                    <div>
                        <div className="ec-text-12 ec-text-muted">角色数</div>
                        <div className="ec-text-14">{csMeta?.stats?.uniqueCharacters || 0}</div>
                    </div>
                    <div>
                        <div className="ec-text-12 ec-text-muted">热点条目</div>
                        <div className="ec-text-14">{csMeta?.stats?.hotEntries || 0}</div>
                    </div>
                </div>
            </div>

            <div className="cyber-card ec-border-purple ec-mb-12">
                <h3 className="ec-text-14 ec-font-600 ec-mb-8 ec-color-purple">数据同步</h3>
                <div className="ec-grid-2 ec-gap-12 ec-mb-12">
                    <div>
                        <label className="ec-text-12 ec-text-muted ec-mb-4">起始章节</label>
                        <input className="cyber-input ec-w-full" type="number" value={syncFrom} onChange={e => setSyncFrom(e.target.value)} placeholder="从第几章" />
                    </div>
                    <div>
                        <label className="ec-text-12 ec-text-muted ec-mb-4">结束章节</label>
                        <input className="cyber-input ec-w-full" type="number" value={syncTo} onChange={e => setSyncTo(e.target.value)} placeholder="到第几章" />
                    </div>
                </div>
                <button className="cyber-btn cyber-btn-sm" onClick={handleSync} disabled={syncMut}>
                    {syncMut ? '同步中...' : '执行同步'}
                </button>
            </div>

            <div className="cyber-card">
                <h3 className="ec-text-14 ec-font-600 ec-mb-8">数据迁移</h3>
                <button className="cyber-btn cyber-btn-sm cyber-btn-ghost" onClick={handleMigrateChineseKeys}>
                    迁移中文键名
                </button>
            </div>
        </div>
    );
}

export default SystemTab;
