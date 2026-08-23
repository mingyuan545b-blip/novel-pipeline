export default function PublishQueuePanel({
    chapters, accounts, queue, batchConfig, setBatchConfig,
    onAddToQueue, onBatchAdd, onMarkPublished, onMarkFailed,
    onDeleteQueueItem, onFormatContent, getStatusLabel
}) {
    const completedChapters = chapters.filter(ch => ch.content);

    return (
        <div>
            <div className="queue-header">
                <div className="cyber-section-title" style={{ margin: 0 }}>发布队列</div>
                <div className="queue-config-row">
                    <select className="cyber-input" value={batchConfig.platformAccountId}
                        onChange={e => setBatchConfig(prev => ({ ...prev, platformAccountId: e.target.value }))}
                        style={{ width: 150 }}>
                        <option value="">选择平台</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.platformName} - {a.penName}</option>)}
                    </select>
                    <div className="queue-interval-row">
                        <label className="form-label" style={{ margin: 0, fontSize: 12 }}>间隔(分):</label>
                        <input className="cyber-input" type="number" value={batchConfig.scheduleInterval}
                            onChange={e => setBatchConfig(prev => ({ ...prev, scheduleInterval: parseInt(e.target.value) || 30 }))}
                            min={5} style={{ width: 50 }} />
                    </div>
                    <button className="cyber-btn cyber-btn-primary" onClick={onBatchAdd} disabled={!batchConfig.platformAccountId}>
                        批量加入队列
                    </button>
                </div>
            </div>

            <div className="cyber-section-title">已完成章节（点击加入队列）</div>
            <div className="flex-wrap gap-8 mb-20">
                {completedChapters.map(ch => (
                    <button key={ch.id} className="cyber-btn cyber-btn-sm"
                        onClick={() => onAddToQueue(ch)} disabled={!batchConfig.platformAccountId}>
                        第{ch.chapterNumber}章 {ch.title}
                    </button>
                ))}
            </div>

            <div className="cyber-section-title">格式化复制（一键复制平台格式）</div>
            <FormatSection accounts={accounts} chapters={completedChapters} onFormat={onFormatContent} />

            <div className="cyber-section-title">队列列表</div>
            {queue.length === 0 ? (
                <div className="cyber-card text-center text-muted p-20">队列为空，选择章节和平台后添加</div>
            ) : (
                <QueueTable queue={queue} getStatusLabel={getStatusLabel}
                    onMarkPublished={onMarkPublished} onMarkFailed={onMarkFailed} onDelete={onDeleteQueueItem} />
            )}
        </div>
    );
}

function FormatSection({ accounts, chapters, onFormat }) {
    return (
        <div className="format-section">
            {accounts.map(account => (
                <div key={account.id} className="format-account-row">
                    <span className="text-sm text-muted">{account.platformName}:</span>
                    {chapters.slice(0, 5).map(ch => (
                        <button key={ch.id} className="cyber-btn cyber-btn-sm text-xs"
                            onClick={() => onFormat(ch, account.platformId)}>第{ch.chapterNumber}章</button>
                    ))}
                    {chapters.length > 5 && <span className="text-sm text-muted">...</span>}
                </div>
            ))}
        </div>
    );
}

function QueueTable({ queue, getStatusLabel, onMarkPublished, onMarkFailed, onDelete }) {
    return (
        <div className="cyber-card">
            <table className="cyber-table">
                <thead>
                    <tr><th>章节</th><th>平台</th><th>计划时间</th><th>状态</th><th>操作</th></tr>
                </thead>
                <tbody>
                    {queue.map(item => (
                        <tr key={item.id}>
                            <td className="font-bold">第{item.chapterNumber}章 {item.chapterTitle}</td>
                            <td>{item.platformName}</td>
                            <td className="text-base font-mono">{new Date(item.scheduledTime).toLocaleString('zh-CN')}</td>
                            <td>
                                <span className={`cyber-badge ${item.status === 'published' ? 'cyber-badge-green' : item.status === 'failed' ? 'cyber-badge-red' : 'cyber-badge-blue'}`}>
                                    {getStatusLabel(item.status)}
                                </span>
                            </td>
                            <td>
                                <div className="flex gap-4">
                                    {item.status === 'pending' && (
                                        <button className="cyber-btn cyber-btn-sm text-xs text-green" onClick={() => onMarkPublished(item.id)}>标记已发布</button>
                                    )}
                                    {item.status === 'pending' && (
                                        <button className="cyber-btn cyber-btn-sm text-xs text-red" onClick={() => onMarkFailed(item.id, '手动标记失败')}>标记失败</button>
                                    )}
                                    <button className="cyber-btn cyber-btn-sm text-xs text-red" onClick={() => onDelete(item.id)}>删除</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
