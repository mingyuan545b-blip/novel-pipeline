import { AGENT_ICONS } from './agentConstants';

export default function TemplatesPanel({
    templates, selectedTemplate, templateEditSystem, setTemplateEditSystem,
    templateSaving, templateHasChanges, selectTemplate, saveTemplate,
}) {
    return (
        <>
            <div className="cyber-section-title">Agent模板列表 ({templates.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
                <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 12, maxHeight: 'calc(100vh - 320px)', overflow: 'auto' }}>
                    {templates.map(tpl => (
                        <div key={tpl.id} onClick={() => selectTemplate(tpl)} className="cursor-pointer rounded mb-4"
                            style={{ padding: '8px 10px', background: selectedTemplate?.id === tpl.id ? 'var(--accent-primary)22' : 'transparent', borderLeft: selectedTemplate?.id === tpl.id ? '3px solid var(--accent-primary)' : '3px solid transparent' }}
                            onMouseEnter={e => { if (selectedTemplate?.id !== tpl.id) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                            onMouseLeave={e => { if (selectedTemplate?.id !== tpl.id) e.currentTarget.style.background = 'transparent'; }}>
                            <div className="flex items-center gap-8">
                                <span className="text-md">{AGENT_ICONS[tpl.agentType] || '⚙'}</span>
                                <div><div className="text-md font-semibold">{tpl.role || tpl.agentType}</div><div className="text-sm text-muted">{tpl.agentType} · {tpl.mode}</div></div>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ maxHeight: 'calc(100vh - 320px)', overflow: 'auto' }}>
                    {selectedTemplate ? (
                        <div className="cyber-card">
                            <div className="flex-between mb-12">
                                <div><h3 className="text-lg font-semibold" style={{ margin: 0 }}>{selectedTemplate.role}</h3>
                                <div className="text-sm text-muted mt-4">{selectedTemplate.agentType} · 模式: {selectedTemplate.mode} · 工具: {selectedTemplate.tool}</div></div>
                                <span className="cyber-badge cyber-badge-blue">v{selectedTemplate.updatedAt ? new Date(selectedTemplate.updatedAt).toLocaleDateString('zh-CN') : '1.0'}</span>
                            </div>
                            <div className="form-group">
                                <label className="form-label">模板系统提示词 (System)</label>
                                <textarea className="cyber-textarea" value={templateEditSystem} onChange={e => setTemplateEditSystem(e.target.value)} rows={15}
                                    style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
                            </div>
                            <div className="flex-end gap-8">
                                <span className="text-sm text-muted">字数: {templateEditSystem.length}</span>
                                <button className="cyber-btn" onClick={() => setTemplateEditSystem(selectedTemplate.system || '')} disabled={!templateHasChanges}>重置</button>
                                <button className="cyber-btn cyber-btn-primary" onClick={saveTemplate} disabled={templateSaving || !templateHasChanges}>{templateSaving ? '保存中...' : '保存模板'}</button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-muted p-20" style={{ padding: 60 }}><div className="text-2xl mb-12">📋</div><div>点击左侧模板查看详情</div></div>
                    )}
                </div>
            </div>
        </>
    );
}
