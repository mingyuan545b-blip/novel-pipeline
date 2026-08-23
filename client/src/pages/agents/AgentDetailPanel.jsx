export default function AgentDetailPanel({
    selectedAgent, editPrompt, setEditPrompt, saving, hasChanges,
    showResolvedPrompt, resolvedPrompt, resolvedPromptLoading,
    savePrompt, resetPrompt, toggleResolvedPrompt, mode: _mode, projectId: _projectId,
}) {
    if (!selectedAgent) return null;

    return (
        <div>
            <div className="cyber-section-title">
                编辑 {selectedAgent.role} 提示词
                {hasChanges && <span className="ml-8 text-orange" style={{ fontSize: 12 }}>(已修改)</span>}
            </div>
            <div className="cyber-card">
                <div className="form-group">
                    <label className="form-label">系统提示词 (System Prompt)</label>
                    <textarea className="cyber-textarea" value={editPrompt} onChange={e => setEditPrompt(e.target.value)} rows={20}
                        style={{ minHeight: 400, fontFamily: 'var(--font-mono)', fontSize: 13 }} />
                </div>
                <div className="flex-end gap-8">
                    <span className="text-sm text-muted">字数: {editPrompt.length}</span>
                    <button className="cyber-btn" onClick={resetPrompt} disabled={!hasChanges}>重置</button>
                    <button className="cyber-btn cyber-btn-primary" onClick={savePrompt} disabled={saving || !hasChanges}>
                        {saving ? <><span className="cyber-loading"></span> 保存中</> : '保存提示词'}
                    </button>
                </div>
            </div>

            <div className="mt-20">
                <div className="cyber-section-title">Agent信息</div>
                <div className="cyber-card">
                    <div className="table-container">
                        <table className="cyber-table">
                            <tbody>
                                <tr><td className="font-semibold" style={{ width: 150 }}>Agent类型</td><td>{selectedAgent.type}</td></tr>
                                <tr><td className="font-semibold">角色名</td><td>{selectedAgent.name || selectedAgent.role}</td></tr>
                                <tr><td className="font-semibold">分类</td><td>{selectedAgent.category || '未分类'}</td></tr>
                                <tr><td className="font-semibold">MCP工具名</td><td><code className="text-blue">{selectedAgent.tool}</code></td></tr>
                                <tr><td className="font-semibold">数据来源</td><td>{selectedAgent.source === 'database' ? <span className="text-cyan">数据库自定义</span> : <span className="text-orange">内置默认模板</span>}</td></tr>
                                <tr><td className="font-semibold">提示词长度</td><td>{(selectedAgent.systemPrompt || '').length} 字符</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-10">
                        <button className="cyber-btn cyber-btn-sm" onClick={toggleResolvedPrompt}>
                            {showResolvedPrompt ? '收起完整提示词' : '🔍 预览完整提示词'}
                        </button>
                    </div>
                    {showResolvedPrompt && (
                        <div className="mt-10 p-10 rounded" style={{ background: 'rgba(0,240,255,0.03)', border: '1px solid rgba(0,240,255,0.1)' }}>
                            {resolvedPromptLoading ? (
                                <div className="text-sm text-muted text-center p-20">加载中...</div>
                            ) : resolvedPrompt?.error ? (
                                <div className="text-sm text-red">{resolvedPrompt.message || '加载失败'}</div>
                            ) : resolvedPrompt ? (
                                <div>
                                    <div className="flex-between mb-8">
                                        <div className="text-sm font-semibold text-cyan">完整提示词预览</div>
                                        <div className="text-xs text-muted">总长度: {resolvedPrompt.totalLength || 0} 字符</div>
                                    </div>
                                    {resolvedPrompt.agent?.system && (
                                        <div className="mb-8"><div className="text-sm font-semibold text-blue mb-4">🤖 Agent专属提示词</div>
                                        <pre className="font-mono text-sm pre-wrap word-break" style={{ margin: 0, padding: 8, background: 'var(--bg-input)', borderRadius: 4, maxHeight: 200, overflow: 'auto', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{resolvedPrompt.agent.system}</pre></div>
                                    )}
                                    {resolvedPrompt.foundation && (
                                        <div className="mb-8"><div className="text-sm font-semibold text-green mb-4">📐 基础提示词</div>
                                        <pre className="font-mono text-sm pre-wrap word-break" style={{ margin: 0, padding: 8, background: 'var(--bg-input)', borderRadius: 4, maxHeight: 200, overflow: 'auto', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{typeof resolvedPrompt.foundation === 'string' ? resolvedPrompt.foundation : JSON.stringify(resolvedPrompt.foundation, null, 2)}</pre></div>
                                    )}
                                    {resolvedPrompt.styleInjection && (
                                        <div className="mb-8"><div className="text-sm font-semibold text-orange mb-4">🎨 风格注入</div>
                                        <pre className="font-mono text-sm pre-wrap word-break" style={{ margin: 0, padding: 8, background: 'var(--bg-input)', borderRadius: 4, maxHeight: 200, overflow: 'auto', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{typeof resolvedPrompt.styleInjection === 'string' ? resolvedPrompt.styleInjection : JSON.stringify(resolvedPrompt.styleInjection, null, 2)}</pre></div>
                                    )}
                                    {resolvedPrompt.constraintInjection && (
                                        <div className="mb-8"><div className="text-sm font-semibold text-purple mb-4">🔒 约束注入</div>
                                        <pre className="font-mono text-sm pre-wrap word-break" style={{ margin: 0, padding: 8, background: 'var(--bg-input)', borderRadius: 4, maxHeight: 200, overflow: 'auto', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{typeof resolvedPrompt.constraintInjection === 'string' ? resolvedPrompt.constraintInjection : JSON.stringify(resolvedPrompt.constraintInjection, null, 2)}</pre></div>
                                    )}
                                </div>
                            ) : <div className="text-sm text-muted text-center">无数据</div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
