import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../store/useAppStore';
import { styleTemplateApi, projectsApi } from '../services/api';

const RULE_LABELS = {
    sentenceStyle: '句式风格',
    paragraphStyle: '段落风格',
    dialogueStyle: '对话风格',
    descriptionStyle: '描写风格',
    emotionStyle: '情感表达',
    pacing: '节奏控制',
    vocabulary: '词汇风格'
};

const SOURCE_LABELS = {
    manual: '✏ 手动创建',
    analyze: '📥 AI分析',
    direct: '📄 直接导入',
    learn: '🧠 自动学习',
    default: '📋 系统预设'
};

export default function StyleTemplatesPage() {
    const { currentProject, projects, setProjects } = useAppStore();
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [showAnalyze, setShowAnalyze] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');

    const [form, setForm] = useState({
        name: '', description: '', tags: [],
        rules: {
            sentenceStyle: '', paragraphStyle: '', dialogueStyle: '',
            descriptionStyle: '', emotionStyle: '', pacing: '', vocabulary: '', forbidden: []
        },
        example: ''
    });

    const [analyzeText, setAnalyzeText] = useState('');
    const [analyzeName, setAnalyzeName] = useState('');
    const [analyzeMode, setAnalyzeMode] = useState('ai');
    const [newForbidden, setNewForbidden] = useState('');
    const [newTag, setNewTag] = useState('');

    const loadTemplates = useCallback(async () => {
        try {
            const res = await styleTemplateApi.listTemplates();
            setTemplates(res.data || []);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setLoading(true);
        try {
            if (selectedTemplate) {
                await styleTemplateApi.updateTemplate(selectedTemplate.id, form);
            } else {
                await styleTemplateApi.createTemplate(form);
            }
            setShowForm(false);
            setSelectedTemplate(null);
            loadTemplates();
        } catch (e) { alert('保存失败: ' + e.message); }
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (!confirm('确定删除此风格模板？')) return;
        try {
            await styleTemplateApi.deleteTemplate(id);
            if (selectedTemplate?.id === id) setSelectedTemplate(null);
            loadTemplates();
        } catch (e) { alert('删除失败: ' + (e.response?.data?.error || e.message)); }
    };

    const handleAnalyze = async () => {
        const minLen = analyzeMode === 'ai' ? 500 : 50;
        if (analyzeText.length < minLen) { alert(`文本至少需要${minLen}字`); return; }
        if (analyzeMode === 'direct' && !analyzeName.trim()) { alert('直接导入需要填写风格名称'); return; }
        setLoading(true);
        setProgress(analyzeMode === 'ai' ? 'AI正在分析写作风格...' : '正在导入文本...');
        try {
            if (analyzeMode === 'ai') {
                await styleTemplateApi.analyze({ text: analyzeText, name: analyzeName });
            } else {
                await styleTemplateApi.importDirect({ text: analyzeText, name: analyzeName });
            }
            setShowAnalyze(false);
            setAnalyzeText('');
            setAnalyzeName('');
            setAnalyzeMode('ai');
            loadTemplates();
        } catch (e) { alert('操作失败: ' + (e.response?.data?.error || e.message)); }
        setLoading(false);
        setProgress('');
    };

    const handleLearnFromProject = async () => {
        if (!currentProject) { alert('请先选择项目'); return; }
        setLoading(true);
        setProgress('AI正在从已定稿章节中学习风格...');
        try {
            await styleTemplateApi.learnFromChapter({ projectId: currentProject.id });
            loadTemplates();
        } catch (e) { alert('学习失败: ' + (e.response?.data?.error || e.message)); }
        setLoading(false);
        setProgress('');
    };

    const handleApplyToProject = async (templateId) => {
        if (!currentProject) { alert('请先选择项目'); return; }
        try {
            await styleTemplateApi.applyToProject({ projectId: currentProject.id, templateId });
            const res = await projectsApi.list();
            setProjects(res.data);
            alert('风格模板已应用到当前项目');
        } catch (e) { alert('应用失败: ' + e.message); }
    };

    const openEdit = (template) => {
        setSelectedTemplate(template);
        setForm({
            name: template.name,
            description: template.description || '',
            tags: template.tags || [],
            rules: {
                sentenceStyle: template.rules?.sentenceStyle || '',
                paragraphStyle: template.rules?.paragraphStyle || '',
                dialogueStyle: template.rules?.dialogueStyle || '',
                descriptionStyle: template.rules?.descriptionStyle || '',
                emotionStyle: template.rules?.emotionStyle || '',
                pacing: template.rules?.pacing || '',
                vocabulary: template.rules?.vocabulary || '',
                forbidden: template.rules?.forbidden || []
            },
            example: template.example || ''
        });
        setShowForm(true);
    };

    const openCreate = () => {
        setSelectedTemplate(null);
        setForm({
            name: '', description: '', tags: [],
            rules: { sentenceStyle: '', paragraphStyle: '', dialogueStyle: '', descriptionStyle: '', emotionStyle: '', pacing: '', vocabulary: '', forbidden: [] },
            example: ''
        });
        setShowForm(true);
    };

    const currentStyleId = currentProject?.styleTemplateId;

    return (
        <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700 }}>🎨 写作风格模板</h2>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                        定义写作风格规则，执笔人将严格按照模板执行
                        {currentProject && <span style={{ color: 'var(--neon-blue)' }}> · 当前项目: {currentProject.name}</span>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="cyber-btn" onClick={() => setShowAnalyze(true)}>📥 导入分析</button>
                    <button className="cyber-btn" onClick={handleLearnFromProject} disabled={loading || !currentProject}>🧠 自动学习</button>
                    <button className="cyber-btn cyber-btn-primary" onClick={openCreate}>+ 新建模板</button>
                </div>
            </div>

            {progress && (
                <div style={{ padding: '10px 14px', background: 'rgba(0,240,255,0.05)', borderRadius: 6, marginBottom: 16, fontSize: 13, color: 'var(--neon-blue)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="cyber-loading"></span> {progress}
                </div>
            )}

            {currentProject && (
                <div className="cyber-card" style={{ marginBottom: 20, padding: 16, borderLeft: '4px solid var(--neon-blue)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>当前项目风格：</span>
                        {currentStyleId ? (
                            <span className="cyber-badge cyber-badge-blue">
                                {templates.find(t => t.id === currentStyleId)?.name || '未知模板'}
                            </span>
                        ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>未设置风格模板（使用默认）</span>
                        )}
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                {templates.map(template => (
                    <div key={template.id} className="cyber-card" style={{
                        borderLeft: `4px solid ${template.id === currentStyleId ? 'var(--neon-green)' : template.isDefault ? 'var(--neon-purple)' : 'var(--neon-blue)'}`,
                        opacity: template.isDefault ? 0.9 : 1
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <h4 style={{ fontSize: 15, fontWeight: 600 }}>{template.name}</h4>
                                    {template.id === currentStyleId && <span className="cyber-badge cyber-badge-green">当前</span>}
                                    {template.isDefault && <span className="cyber-badge cyber-badge-purple">预设</span>}
                                    <span className="cyber-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: 10 }}>
                                        {SOURCE_LABELS[template.source] || template.source}
                                    </span>
                                </div>
                                {template.description && (
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{template.description}</div>
                                )}
                            </div>
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            {Object.entries(RULE_LABELS).map(([key, label]) => (
                                template.rules?.[key] ? (
                                    <div key={key} style={{ marginBottom: 2 }}>
                                        <span style={{ color: 'var(--neon-blue)', fontWeight: 500 }}>{label}：</span>
                                        {template.rules[key].length > 60 ? template.rules[key].substring(0, 60) + '...' : template.rules[key]}
                                    </div>
                                ) : null
                            ))}
                            {template.rules?.forbidden?.length > 0 && (
                                <div style={{ color: 'var(--neon-red)', marginTop: 4 }}>
                                    🚫 禁止：{template.rules.forbidden.join('、')}
                                </div>
                            )}
                        </div>

                        {template.example && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 10px', background: 'rgba(0,240,255,0.03)', borderRadius: 4, marginBottom: 8, borderLeft: '2px solid var(--neon-blue)' }}>
                                {template.example.length > 120 ? template.example.substring(0, 120) + '...' : template.example}
                            </div>
                        )}

                        {template.tags?.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                                {template.tags.map((tag, i) => <span key={i} className="cyber-tag">{tag}</span>)}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                            {currentProject && template.id !== currentStyleId && (
                                <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-green)' }}
                                    onClick={() => handleApplyToProject(template.id)}>应用到项目</button>
                            )}
                            <button className="cyber-btn cyber-btn-sm" onClick={() => openEdit(template)}>编辑</button>
                            {!template.isDefault && (
                                <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={() => handleDelete(template.id)}>删除</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {templates.length === 0 && (
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon">🎨</div>
                    <div>暂无风格模板，点击上方按钮创建或导入</div>
                </div>
            )}

            {showForm && (
                <div className="cyber-modal-overlay">
                    <div className="cyber-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '85vh', overflow: 'auto' }}>
                        <h2>{selectedTemplate ? '编辑风格模板' : '新建风格模板'}</h2>
                        <div className="form-group">
                            <label className="form-label">风格名称</label>
                            <input className="cyber-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：热血爽文、暗黑深沉..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">风格描述</label>
                            <input className="cyber-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="简短描述风格特点..." />
                        </div>

                        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 8px', color: 'var(--neon-blue)' }}>📝 风格规则（越具体，执行越严格）</h3>
                        {Object.entries(RULE_LABELS).map(([key, label]) => (
                            <div key={key} className="form-group">
                                <label className="form-label">{label}</label>
                                <input className="cyber-input" value={form.rules[key] || ''} onChange={e => setForm({ ...form, rules: { ...form.rules, [key]: e.target.value } })} placeholder={`描述${label}要求...`} />
                            </div>
                        ))}

                        <div className="form-group">
                            <label className="form-label">🚫 禁止写法</label>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                                {(form.rules.forbidden || []).map((f, i) => (
                                    <span key={i} className="cyber-tag" style={{ background: 'rgba(255,60,60,0.1)', color: 'var(--neon-red)', cursor: 'pointer' }}
                                        onClick={() => setForm({ ...form, rules: { ...form.rules, forbidden: form.rules.forbidden.filter((_, j) => j !== i) } })}>
                                        {f} ×
                                    </span>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="cyber-input" value={newForbidden} onChange={e => setNewForbidden(e.target.value)} placeholder="添加禁止写法..." onKeyDown={e => {
                                    if (e.key === 'Enter' && newForbidden.trim()) {
                                        setForm({ ...form, rules: { ...form.rules, forbidden: [...(form.rules.forbidden || []), newForbidden.trim()] } });
                                        setNewForbidden('');
                                    }
                                }} />
                                <button className="cyber-btn cyber-btn-sm" onClick={() => {
                                    if (newForbidden.trim()) {
                                        setForm({ ...form, rules: { ...form.rules, forbidden: [...(form.rules.forbidden || []), newForbidden.trim()] } });
                                        setNewForbidden('');
                                    }
                                }}>添加</button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">风格示例（执笔人会模仿此风格）</label>
                            <textarea className="cyber-textarea" value={form.example} onChange={e => setForm({ ...form, example: e.target.value })} rows={4} placeholder="写一段体现该风格的示例文字..." />
                        </div>

                        <div className="form-group">
                            <label className="form-label">标签</label>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                                {(form.tags || []).map((t, i) => (
                                    <span key={i} className="cyber-tag" style={{ cursor: 'pointer' }} onClick={() => setForm({ ...form, tags: form.tags.filter((_, j) => j !== i) })}>{t} ×</span>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="cyber-input" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="添加标签..." onKeyDown={e => {
                                    if (e.key === 'Enter' && newTag.trim()) {
                                        setForm({ ...form, tags: [...(form.tags || []), newTag.trim()] });
                                        setNewTag('');
                                    }
                                }} />
                                <button className="cyber-btn cyber-btn-sm" onClick={() => {
                                    if (newTag.trim()) { setForm({ ...form, tags: [...(form.tags || []), newTag.trim()] }); setNewTag(''); }
                                }}>添加</button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                            <button className="cyber-btn" onClick={() => { setShowForm(false); setSelectedTemplate(null); }}>取消</button>
                            <button className="cyber-btn cyber-btn-primary" onClick={handleSave} disabled={loading || !form.name.trim()}>
                                {selectedTemplate ? '保存' : '创建'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAnalyze && (
                <div className="cyber-modal-overlay">
                    <div className="cyber-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 650 }}>
                        <h2>📥 导入文本</h2>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                            <button className={`cyber-btn ${analyzeMode === 'ai' ? 'cyber-btn-primary' : ''}`} onClick={() => setAnalyzeMode('ai')}>🧠 AI分析提炼</button>
                            <button className={`cyber-btn ${analyzeMode === 'direct' ? 'cyber-btn-primary' : ''}`} onClick={() => setAnalyzeMode('direct')}>📄 直接使用</button>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, padding: '8px 12px', background: 'rgba(0,240,255,0.03)', borderRadius: 6, borderLeft: '2px solid var(--neon-blue)' }}>
                            {analyzeMode === 'ai'
                                ? '粘贴一段你喜欢的小说文本（至少500字），AI将自动分析其写作风格并提炼为结构化模板'
                                : '直接将文本作为风格参考导入，不经过AI分析。文本将保存为风格示例，后续可手动补充规则'}
                        </div>
                        <div className="form-group">
                            <label className="form-label">风格名称{analyzeMode === 'direct' && <span style={{ color: 'var(--neon-red)' }}> *</span>}</label>
                            <input className="cyber-input" value={analyzeName} onChange={e => setAnalyzeName(e.target.value)} placeholder={analyzeMode === 'ai' ? '可选，AI会自动命名...' : '必填，给风格起个名字...'} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">文本内容（至少{analyzeMode === 'ai' ? 500 : 50}字）</label>
                            <textarea className="cyber-textarea" value={analyzeText} onChange={e => setAnalyzeText(e.target.value)} rows={10} placeholder={analyzeMode === 'ai' ? '粘贴小说文本，AI将分析句式、节奏、情感等风格要素...' : '粘贴风格参考文本，将直接保存为风格示例...'} />
                            <div style={{ fontSize: 11, color: analyzeText.length < (analyzeMode === 'ai' ? 500 : 50) ? 'var(--neon-red)' : 'var(--text-muted)', marginTop: 4 }}>
                                已输入 {analyzeText.length} 字
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button className="cyber-btn" onClick={() => setShowAnalyze(false)}>取消</button>
                            <button className="cyber-btn cyber-btn-primary" onClick={handleAnalyze} disabled={loading || analyzeText.length < (analyzeMode === 'ai' ? 500 : 50) || (analyzeMode === 'direct' && !analyzeName.trim())}>
                                {loading ? (analyzeMode === 'ai' ? 'AI分析中...' : '导入中...') : (analyzeMode === 'ai' ? '🧠 开始分析' : '📄 直接导入')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
