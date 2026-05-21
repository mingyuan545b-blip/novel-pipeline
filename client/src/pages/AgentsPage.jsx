import { useState, useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import { agentsApi, pipelineApi, promptConfigApi, projectsApi } from '../services/api';

const AGENT_ICONS = {
    writer: '✍',
    'intent-planner': '📋',
    'first-review': '✓',
    'second-review': '★',
    'fast-review': '⚡',
    'final-editor': '♛',
    'material-manager': '⬡',
    polisher: '✦',
    consolidator: '◈',
    reviser: '🔧',
    reader: '📖',
    adjuster: '⚖'
};

const AGENT_COLORS = {
    writer: 'var(--neon-blue)',
    'intent-planner': '#2ed573',
    'first-review': 'var(--neon-green)',
    'second-review': 'var(--neon-orange)',
    'fast-review': '#ffa502',
    'final-editor': 'var(--neon-pink)',
    'material-manager': 'var(--neon-purple)',
    polisher: '#a29bfe',
    consolidator: 'var(--neon-cyan, #00e5ff)',
    reviser: '#00d2d3',
    reader: '#ff9ff3',
    adjuster: '#f368e0'
};

const TABS = [
    { key: 'agents', label: '🤖 Agent配置' },
    { key: 'templates', label: '📋 模板管理' },
    { key: 'constraints', label: '🔒 约束预设' },
    { key: 'profiles', label: '🎨 风格配置' }
];

export default function AgentsPage() {
    const { agents, setAgents, currentProject } = useAppStore();
    const [activeTab, setActiveTab] = useState('agents');
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [editPrompt, setEditPrompt] = useState('');
    const [saving, setSaving] = useState(false);
    const [originalPrompt, setOriginalPrompt] = useState('');

    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [templateEditSystem, setTemplateEditSystem] = useState('');
    const [templateOriginal, setTemplateOriginal] = useState('');
    const [templateSaving, setTemplateSaving] = useState(false);

    const [constraints, setConstraints] = useState([]);
    const [selectedConstraint, setSelectedConstraint] = useState(null);

    const [profiles, setProfiles] = useState([]);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        const mode = currentProject?.mode || 'novel';
        pipelineApi.getAgents(mode).then(res => setAgents(res.data || [])).catch(() => {});
    }, [setAgents, currentProject?.mode]);

    useEffect(() => {
        promptConfigApi.listAgentTemplates().then(res => setTemplates(res.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        promptConfigApi.listConstraintPresets().then(res => setConstraints(res.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        promptConfigApi.listStyleProfiles().then(res => setProfiles(res.data || [])).catch(() => {});
    }, []);

    const loadAgentDetail = async (type) => {
        try {
            const mode = currentProject?.mode || 'novel';
            const projectId = currentProject?.id || '';
            const res = await pipelineApi.getAgent(type, mode, projectId);
            setSelectedAgent(res.data);
            const currentPrompt = res.data.systemPrompt || res.data.system || '';
            setEditPrompt(currentPrompt);
            setOriginalPrompt(currentPrompt);
        } catch (e) {
            console.error(e);
        }
    };

    const savePrompt = async () => {
        if (!selectedAgent) return;
        setSaving(true);
        try {
            await agentsApi.updatePrompt(selectedAgent.type, {
                systemPrompt: editPrompt,
                projectId: currentProject?.id || null
            });
            setOriginalPrompt(editPrompt);
            alert(currentProject?.id ? '项目级Agent提示词已保存' : '全局Agent提示词已更新');
            loadAgentDetail(selectedAgent.type);
        } catch (e) {
            console.error(e);
            alert('保存失败: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const resetPrompt = () => {
        setEditPrompt(originalPrompt);
    };

    const hasChanges = editPrompt !== originalPrompt;

    const selectTemplate = (tpl) => {
        setSelectedTemplate(tpl);
        setTemplateEditSystem(tpl.system || '');
        setTemplateOriginal(tpl.system || '');
    };

    const saveTemplate = async () => {
        if (!selectedTemplate) return;
        setTemplateSaving(true);
        try {
            await promptConfigApi.updateAgentTemplate(selectedTemplate.id, { ...selectedTemplate, system: templateEditSystem });
            setTemplateOriginal(templateEditSystem);
            const res = await promptConfigApi.listAgentTemplates();
            setTemplates(res.data || []);
            alert('模板已更新');
        } catch (e) {
            alert('保存失败: ' + e.message);
        } finally {
            setTemplateSaving(false);
        }
    };

    const templateHasChanges = templateEditSystem !== templateOriginal;

    const applyConstraintsToProject = async (constraintIds) => {
        if (!currentProject?.id) { alert('请先选择一个项目'); return; }
        setApplying(true);
        try {
            const res = await projectsApi.get(currentProject.id);
            const project = res.data;
            const current = project.constraints || [];
            const merged = [...new Set([...current, ...constraintIds])];
            await projectsApi.update(currentProject.id, { constraints: merged });
            alert(`已将 ${constraintIds.length} 个约束应用到项目（共 ${merged.length} 个）`);
        } catch (e) {
            alert('应用失败: ' + e.message);
        } finally {
            setApplying(false);
        }
    };

    const applyProfileToProject = async (profileKey) => {
        if (!currentProject?.id) { alert('请先选择一个项目'); return; }
        setApplying(true);
        try {
            await projectsApi.update(currentProject.id, { styleProfile: profileKey });
            alert(`风格配置「${profileKey}」已应用到项目`);
        } catch (e) {
            alert('应用失败: ' + e.message);
        } finally {
            setApplying(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Agent 配置</h1>
                <p className="page-subtitle">管理流水线中的Agent设定、模板、约束预设和风格配置</p>
            </div>

            <div className="cyber-tabs" style={{ marginBottom: 20 }}>
                {TABS.map(tab => (
                    <button key={tab.key} className={`cyber-tab ${activeTab === tab.key ? 'cyber-tab-active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                        style={activeTab === tab.key ? { borderColor: 'var(--neon-blue)', color: 'var(--neon-blue)' } : {}}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'agents' && (<>
                <div className="cyber-section-title">流水线成员</div>
                <div className="cyber-grid cyber-grid-3" style={{ marginBottom: 24 }}>
                    {agents.map(agent => (
                        <div
                            key={agent.type}
                            className="agent-card"
                            onClick={() => loadAgentDetail(agent.type)}
                            style={selectedAgent?.type === agent.type ? { borderColor: AGENT_COLORS[agent.type] } : {}}
                        >
                            <div className="agent-card-header">
                                <div className="agent-card-icon" style={{ color: AGENT_COLORS[agent.type], borderColor: AGENT_COLORS[agent.type] }}>
                                    {AGENT_ICONS[agent.type] || '?'}
                                </div>
                                <div>
                                    <div className="agent-card-name">{agent.role}</div>
                                    <div className="agent-card-role">{agent.type}</div>
                                </div>
                            </div>
                            <div className="agent-card-desc">
                                {agent.systemPrompt?.substring(0, 100)}...
                            </div>
                            <div style={{ marginTop: 10 }}>
                                <span className="cyber-badge cyber-badge-blue">{agent.tool}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {selectedAgent && (
                    <div>
                        <div className="cyber-section-title">
                            编辑 {selectedAgent.role} 提示词
                            {hasChanges && <span style={{ marginLeft: 8, color: 'var(--neon-orange)', fontSize: 12 }}>(已修改)</span>}
                        </div>
                        <div className="cyber-card">
                            <div className="form-group">
                                <label className="form-label">系统提示词 (System Prompt)</label>
                                <textarea
                                    className="cyber-textarea"
                                    value={editPrompt}
                                    onChange={e => setEditPrompt(e.target.value)}
                                    rows={20}
                                    style={{ minHeight: 400, fontFamily: 'var(--font-mono)', fontSize: 13 }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    字数: {editPrompt.length}
                                </span>
                                <button className="cyber-btn" onClick={resetPrompt} disabled={!hasChanges}>重置</button>
                                <button className="cyber-btn cyber-btn-primary" onClick={savePrompt} disabled={saving || !hasChanges}>
                                    {saving ? <><span className="cyber-loading"></span> 保存中</> : '保存提示词'}
                                </button>
                            </div>
                        </div>

                        <div style={{ marginTop: 20 }}>
                            <div className="cyber-section-title">Agent信息</div>
                            <div className="cyber-card">
                                <div className="table-container">
                                    <table className="cyber-table">
                                        <tbody>
                                            <tr><td style={{ fontWeight: 600, width: 150 }}>Agent类型</td><td>{selectedAgent.type}</td></tr>
                                            <tr><td style={{ fontWeight: 600 }}>角色名</td><td>{selectedAgent.role}</td></tr>
                                            <tr><td style={{ fontWeight: 600 }}>MCP工具名</td><td><code style={{ color: 'var(--neon-blue)' }}>{selectedAgent.tool}</code></td></tr>
                                            <tr><td style={{ fontWeight: 600 }}>AiPy Pro扩展名</td><td><code>@aipy-pro/{selectedAgent.type}</code></td></tr>
                                            <tr><td style={{ fontWeight: 600 }}>安装路径</td><td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>mcp-agents/{selectedAgent.type}/</td></tr>
                                            <tr><td style={{ fontWeight: 600 }}>输出文件路径</td><td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>output/&#123;projectId&#125;/chapters/&#123;chapterId&#125;.{selectedAgent.type}.txt</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>)}

            {activeTab === 'templates' && (<>
                <div className="cyber-section-title">Agent模板列表 ({templates.length})</div>
                <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
                    <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 12, maxHeight: 'calc(100vh - 320px)', overflow: 'auto' }}>
                        {templates.map(tpl => (
                            <div key={tpl.id}
                                onClick={() => selectTemplate(tpl)}
                                style={{
                                    padding: '8px 10px', cursor: 'pointer', borderRadius: 6, marginBottom: 4,
                                    background: selectedTemplate?.id === tpl.id ? 'var(--accent-primary)22' : 'transparent',
                                    borderLeft: selectedTemplate?.id === tpl.id ? '3px solid var(--accent-primary)' : '3px solid transparent'
                                }}
                                onMouseEnter={e => { if (selectedTemplate?.id !== tpl.id) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                onMouseLeave={e => { if (selectedTemplate?.id !== tpl.id) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 14 }}>{AGENT_ICONS[tpl.agentType] || '⚙'}</span>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{tpl.role || tpl.agentType}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tpl.agentType} · {tpl.mode}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ maxHeight: 'calc(100vh - 320px)', overflow: 'auto' }}>
                        {selectedTemplate ? (
                            <div className="cyber-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <div>
                                        <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{selectedTemplate.role}</h3>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                            {selectedTemplate.agentType} · 模式: {selectedTemplate.mode} · 工具: {selectedTemplate.tool}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <span className="cyber-badge cyber-badge-blue">v{selectedTemplate.updatedAt ? new Date(selectedTemplate.updatedAt).toLocaleDateString('zh-CN') : '1.0'}</span>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">模板系统提示词 (System)</label>
                                    <textarea
                                        className="cyber-textarea"
                                        value={templateEditSystem}
                                        onChange={e => setTemplateEditSystem(e.target.value)}
                                        rows={15}
                                        style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>字数: {templateEditSystem.length}</span>
                                    <button className="cyber-btn" onClick={() => setTemplateEditSystem(templateOriginal)} disabled={!templateHasChanges}>重置</button>
                                    <button className="cyber-btn cyber-btn-primary" onClick={saveTemplate} disabled={templateSaving || !templateHasChanges}>
                                        {templateSaving ? '保存中...' : '保存模板'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                                <div>点击左侧模板查看详情</div>
                            </div>
                        )}
                    </div>
                </div>
            </>)}

            {activeTab === 'constraints' && (<>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div className="cyber-section-title" style={{ marginBottom: 0 }}>约束预设列表 ({constraints.length})</div>
                    {currentProject?.id && (
                        <button className="cyber-btn cyber-btn-primary cyber-btn-sm"
                            disabled={applying}
                            onClick={() => applyConstraintsToProject(constraints.map(c => c.id))}>
                            {applying ? '应用中...' : `全部应用到「${currentProject.name}」`}
                        </button>
                    )}
                </div>
                {constraints.length === 0 ? (
                    <div className="cyber-card cyber-empty"><div className="cyber-empty-icon">🔒</div><div>暂无约束预设</div></div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                        {constraints.map(c => {
                            const name = c.label || c.name || c.id;
                            const desc = c.desc || c.description || '';
                            const rules = c.rules || c.conditions || null;
                            const injectionPoint = c.injection_point || c.injectionPoint || '';
                            const department = c.department || c.category || '';
                            return (
                            <div key={c.id} className="cyber-card"
                                onClick={() => setSelectedConstraint(selectedConstraint?.id === c.id ? null : c)}
                                style={{ cursor: 'pointer', borderLeft: selectedConstraint?.id === c.id ? '3px solid var(--neon-blue)' : '3px solid transparent' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{name}</h4>
                                    {department && <span className="cyber-badge cyber-badge-blue">{department}</span>}
                                </div>
                                {desc && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>{desc}</div>}
                                {selectedConstraint?.id === c.id && rules && (
                                    <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 200, overflow: 'auto' }}>
                                        {typeof rules === 'string' ? rules : JSON.stringify(rules, null, 2)}
                                    </div>
                                )}
                                {injectionPoint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>注入点: {injectionPoint}</div>}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID: {c.id}</div>
                                    {currentProject?.id && (
                                        <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, padding: '2px 8px' }}
                                            disabled={applying}
                                            onClick={e => { e.stopPropagation(); applyConstraintsToProject([c.id]); }}>
                                            应用
                                        </button>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </>)}

            {activeTab === 'profiles' && (<>
                <div className="cyber-section-title">风格配置列表 ({profiles.length})</div>
                {profiles.length === 0 ? (
                    <div className="cyber-card cyber-empty"><div className="cyber-empty-icon">🎨</div><div>暂无风格配置</div></div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
                        {profiles.map(p => {
                            const name = p.label || p.name || p.key || p.id;
                            const desc = p.description || p.desc || '';
                            const ruleSections = [
                                { key: 'povRule', label: '📐 视角规则', val: p.povRule },
                                { key: 'dialogueRule', label: '💬 对话规则', val: p.dialogueRule },
                                { key: 'behaviorRule', label: '🧸 行为规则', val: p.behaviorRule },
                                { key: 'toneRule', label: '📝 文风规则', val: p.toneRule },
                                { key: 'reviewFocus', label: '🔍 审核清单', val: p.reviewFocus },
                                { key: 'constraintOverrides', label: '🔒 关联约束', val: p.constraintOverrides ? p.constraintOverrides.join(', ') : null },
                            ].filter(s => s.val);
                            const rulesObj = p.rules || {};
                            const extraRules = Object.entries(rulesObj).filter(([k]) => !['povRule','dialogueRule','behaviorRule','toneRule','reviewFocus','constraintOverrides'].includes(k));
                            return (
                            <div key={p.id} className="cyber-card"
                                onClick={() => setSelectedProfile(selectedProfile?.id === p.id ? null : p)}
                                style={{ cursor: 'pointer', borderLeft: selectedProfile?.id === p.id ? '3px solid var(--neon-purple)' : '3px solid transparent' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{name}</h4>
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        {currentProject?.id && (
                                            <button className="cyber-btn cyber-btn-sm cyber-btn-primary" style={{ fontSize: 10, padding: '2px 8px' }}
                                                disabled={applying}
                                                onClick={e => { e.stopPropagation(); applyProfileToProject(p.key); }}>
                                                应用到项目
                                            </button>
                                        )}
                                        <span className="cyber-badge cyber-badge-purple">{p.key}</span>
                                    </div>
                                </div>
                                {desc && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>{desc}</div>}
                                {p.constraintOverrides && (
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                                        {p.constraintOverrides.slice(0, 5).map((co, i) => <span key={i} className="cyber-tag" style={{ fontSize: 10 }}>{co}</span>)}
                                        {p.constraintOverrides.length > 5 && <span className="cyber-tag" style={{ fontSize: 10 }}>+{p.constraintOverrides.length - 5}</span>}
                                    </div>
                                )}
                                {selectedProfile?.id === p.id && ruleSections.length > 0 && (
                                    <div style={{ marginTop: 8 }}>
                                        {ruleSections.map(section => (
                                            <div key={section.key} style={{ marginBottom: 8 }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-purple)', marginBottom: 2 }}>{section.label}</div>
                                                <div style={{ padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 11, whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 120, overflow: 'auto' }}>
                                                    {typeof section.val === 'string' ? section.val : JSON.stringify(section.val, null, 2)}
                                                </div>
                                            </div>
                                        ))}
                                        {extraRules.length > 0 && extraRules.map(([key, val]) => (
                                            <div key={key} style={{ marginBottom: 8 }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-purple)', marginBottom: 2 }}>{key}</div>
                                                <div style={{ padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 11, whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 120, overflow: 'auto' }}>
                                                    {typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            );
                        })}
                    </div>
                )}
            </>)}
        </div>
    );
}
