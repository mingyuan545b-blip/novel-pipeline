export default function PlatformDetailContent({ platform: p, config, status, logs, loginChecking, loginBadge, setMultiConfigs, onCheckLogin, onOpenWriter, onOpenEditor, onPublish, onStop, onUpdate, onCloseBrowser }) {
    const updateConfig = (key, value) => setMultiConfigs(prev => ({ ...prev, [p.key]: { ...prev[p.key], [key]: value } }));

    return (
        <div>
            <div className="cyber-card mb-16" style={{ borderColor: p.color }}>
                <div className="flex-between mb-16">
                    <div className="flex gap-8" style={{ alignItems: 'center' }}>
                        <span className="text-2xl">{p.icon}</span>
                        <div>
                            <h4 style={{ color: p.color, margin: 0 }}>{p.name} 批量发布</h4>
                            <a href={p.writerUrl} target="_blank" rel="noreferrer" className="text-sm text-blue" style={{ textDecoration: 'none' }}>{p.writerUrl}</a>
                        </div>
                    </div>
                    <div className="flex gap-6" style={{ alignItems: 'center' }}>
                        <span className="login-badge" style={{ background: loginBadge.bg, color: loginBadge.color }}>{loginBadge.text}</span>
                        <span className={`cyber-badge ${status.running ? 'cyber-badge-red' : 'cyber-badge-green'} text-sm`}>{status.running ? '发布中' : '空闲'}</span>
                    </div>
                </div>

                <div className="login-section">
                    <div className="login-section-title">📋 账号与登录</div>
                    <div className="flex-wrap gap-8">
                        <button className="cyber-btn text-base text-blue" onClick={() => onCheckLogin(p.key)} disabled={loginChecking[p.key]} style={{ borderColor: 'var(--neon-blue)' }}>
                            {loginChecking[p.key] ? '⏳ 检测中...' : '🔍 检测登录'}</button>
                        <button className="cyber-btn text-base text-green" onClick={() => onOpenWriter(p.key)} style={{ borderColor: 'var(--neon-green)' }}>🌐 打开创作后台</button>
                        <button className="cyber-btn text-base text-orange" onClick={() => onOpenEditor(p.key)} style={{ borderColor: 'var(--neon-orange)' }}>✏️ 打开作品编辑</button>
                        <button className="cyber-btn text-base" onClick={() => onCloseBrowser(p.key)}>🚪 关闭浏览器</button>
                    </div>
                    <div className="login-section-hint">点击"检测登录"会启动浏览器并自动检测{p.name}的登录状态，未登录时请在浏览器中手动扫码登录</div>
                </div>

                <div className="config-grid">
                    <div className="form-group">
                        <label className="form-label">CDP连接地址（可选）</label>
                        <input className="cyber-input" value={config.cdpUrl} onChange={e => updateConfig('cdpUrl', e.target.value)} placeholder="http://127.0.0.1:9222" />
                        <div className="config-hint">留空则启动本地浏览器；填CDP地址可接管已登录的Chrome</div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">作品ID/书号</label>
                        <input className="cyber-input" value={config.bookId} onChange={e => updateConfig('bookId', e.target.value)} placeholder={`${p.name}作品ID`} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">发布模式</label>
                        <select className="cyber-input" value={config.mode} onChange={e => updateConfig('mode', e.target.value)}>
                            <option value="immediate">立即发布</option><option value="scheduled">定时发布</option></select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">定时间隔（分钟）</label>
                        <input className="cyber-input" type="number" value={config.scheduleInterval} onChange={e => updateConfig('scheduleInterval', parseInt(e.target.value) || 30)} min={5} disabled={config.mode !== 'scheduled'} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">从第几章开始</label>
                        <input className="cyber-input" type="number" value={config.startFrom} onChange={e => updateConfig('startFrom', parseInt(e.target.value) || 1)} min={1} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">到第几章结束（0=不限）</label>
                        <input className="cyber-input" type="number" value={config.endAt} onChange={e => updateConfig('endAt', parseInt(e.target.value) || 0)} min={0} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">发布章数限制（0=全部）</label>
                        <input className="cyber-input" type="number" value={config.limit} onChange={e => updateConfig('limit', parseInt(e.target.value) || 0)} min={0} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">每日字数上限</label>
                        <input className="cyber-input" type="number" value={config.dailyLimitChars} onChange={e => updateConfig('dailyLimitChars', parseInt(e.target.value) || 50000)} min={10000} step={10000} />
                    </div>
                    <div className="form-group">
                        <label className="config-checkbox-label">
                            <input type="checkbox" checked={config.fillOnly} onChange={e => updateConfig('fillOnly', e.target.checked)} />
                            仅填充模式（不点击发布按钮）</label>
                    </div>
                </div>

                <div className="action-row">
                    {status.running ? (
                        <button className="cyber-btn text-base text-red" onClick={() => onStop(p.key)} style={{ borderColor: 'var(--neon-red)' }}>⏹ 停止</button>
                    ) : (
                        <>
                            <button className="cyber-btn cyber-btn-primary text-base" onClick={() => onPublish(p.key)} style={{ borderColor: p.color, color: p.color }}>⚡ 批量发布</button>
                            {p.key === 'qimao' && <button className="cyber-btn text-base" onClick={() => onUpdate(p.key)} style={{ borderColor: '#F39C12', color: '#F39C12' }}>🔄 修改章节</button>}
                        </>
                    )}
                </div>
            </div>

            {status && (status.totalChapters > 0 || status.running || status.completedChapters > 0 || status.failedChapters > 0) && (
                <div className="cyber-card mb-16">
                    <div className="status-grid-4">
                        <div className="text-center"><div className="status-value" style={{ color: status.running ? p.color : 'var(--neon-green)' }}>{status.running ? '运行中' : '空闲'}</div><div className="status-label">状态</div></div>
                        <div className="text-center"><div className="status-value text-blue">{status.totalChapters || 0}</div><div className="status-label">总章数</div></div>
                        <div className="text-center"><div className="status-value text-green">{status.completedChapters || 0}</div><div className="status-label">已发布</div></div>
                        <div className="text-center"><div className="status-value text-red">{status.failedChapters || 0}</div><div className="status-label">失败</div></div>
                    </div>
                    {status.currentChapter && <div className="current-chapter-bar" style={{ background: `${p.color}22` }}>当前: 第{status.currentChapter.chapterNumber}章 {status.currentChapter.title}</div>}
                </div>
            )}

            <div className="cyber-card">
                <div className="flex-between mb-8">
                    <div className="cyber-section-title" style={{ margin: 0 }}>执行日志</div>
                    <span className="text-sm text-muted">{logs.length} 条</span>
                </div>
                <div className="log-container">
                    {logs.length === 0 ? (
                        <div className="log-empty">暂无日志，点击"检测登录"或"开始批量发布"启动</div>
                    ) : logs.map((log, i) => (
                        <div key={i} className="log-entry-line">
                            <span className="log-time">{new Date(log.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            <span className={log.msg.includes('失败') || log.msg.includes('异常') ? 'log-msg-error' : log.msg.includes('成功') ? 'log-msg-success' : 'log-msg-default'}>{log.msg}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="cyber-card mt-16">
                <div className="cyber-section-title mb-8">使用说明</div>
                <div className="usage-guide">
                    <div>1. <strong>检测登录</strong>：点击"检测登录"按钮，系统会启动浏览器并自动检测{p.name}的登录状态</div>
                    <div>2. <strong>手动登录</strong>：如果未登录，在弹出的浏览器中手动扫码登录，系统会自动检测登录成功</div>
                    <div>3. <strong>打开创作后台</strong>：登录后可点击"打开创作后台"查看作品管理页面</div>
                    <div>4. <strong>打开作品编辑</strong>：填入作品ID后，点击"打开作品编辑"可直接进入章节编辑页面</div>
                    <div>5. 填入{p.name}的<strong>作品ID</strong>（从作者后台URL中获取）</div>
                    <div>6. 设置从第几章开始、发布章数限制等参数</div>
                    <div>7. 点击"开始批量发布"，系统会自动逐章创建并发布</div>
                    <div className="usage-warning">⚠ 番茄发布流程：填标题→填正文→下一步→填章节序号→确定→下一步→忽略敏感词→确认发布</div>
                    <div className="usage-warning">⚠ 部分平台有每日发布字数上限，超出会自动停止</div>
                </div>
            </div>
        </div>
    );
}
