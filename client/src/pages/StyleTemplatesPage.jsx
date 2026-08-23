import useStyleTemplatesState from './style-templates/useStyleTemplatesState';
import { RULE_LABELS, SOURCE_LABELS } from './style-templates/useStyleTemplatesState';
import s from './style-templates/styleTemplates.module.css';

export default function StyleTemplatesPage() {
    const {
        currentProject, templates, selectedTemplate, showForm, showAnalyze, setShowAnalyze,
        loading, progress, form, setForm, analyzeText, setAnalyzeText,
        analyzeName, setAnalyzeName, analyzeMode, setAnalyzeMode,
        newForbidden, setNewForbidden, newTag, setNewTag, currentStyleId,
        handleSave, handleDelete, handleAnalyze, handleLearnFromProject,
        handleApplyToProject, openEdit, openCreate, addForbidden, removeForbidden,
        addTag, removeTag, closeForm, closeAnalyze,
    } = useStyleTemplatesState();

    return (
        <div className={s.pageContainer}>
            <div className="flex-between mb-20">
                <div>
                    <h2 className="text-2xl font-bold">🎨 写作风格模板</h2>
                    <div className="text-sm mt-4">
                        定义写作风格规则，执笔人将严格按照模板执行
                        {currentProject && <span className="text-blue"> · 当前项目: {currentProject.name}</span>}
                    </div>
                </div>
                <div className="flex gap-8">
                    <button className="cyber-btn" onClick={() => setShowAnalyze(true)}>📥 导入分析</button>
                    <button className="cyber-btn" onClick={handleLearnFromProject} disabled={loading || !currentProject}>🧠 自动学习</button>
                    <button className="cyber-btn cyber-btn-primary" onClick={openCreate}>+ 新建模板</button>
                </div>
            </div>

            {progress && <div className={s.progressBar}><span className="cyber-loading"></span> {progress}</div>}

            {currentProject && (
                <div className={`cyber-card ${s.currentStyleCard}`}>
                    <div className="flex gap-12">
                        <span className="text-md font-semibold">当前项目风格：</span>
                        {currentStyleId
                            ? <span className="cyber-badge cyber-badge-blue">{templates.find(t => t.id === currentStyleId)?.name || '未知模板'}</span>
                            : <span className="text-sm text-muted">未设置风格模板（使用默认）</span>}
                    </div>
                </div>
            )}

            <div className={s.templateGrid}>
                {templates.map(t => (
                    <div key={t.id} className="cyber-card" style={{ borderLeft: `4px solid ${t.id === currentStyleId ? 'var(--neon-green)' : t.isDefault ? 'var(--neon-purple)' : 'var(--neon-blue)'}`, opacity: t.isDefault ? 0.9 : 1 }}>
                        <div className="flex-between items-start mb-8">
                            <div>
                                <div className="flex gap-8 items-center mb-4">
                                    <h4 className="text-md font-semibold">{t.name}</h4>
                                    {t.id === currentStyleId && <span className="cyber-badge cyber-badge-green">当前</span>}
                                    {t.isDefault && <span className="cyber-badge cyber-badge-purple">预设</span>}
                                    <span className={`cyber-badge ${s.sourceBadge}`}>{SOURCE_LABELS[t.source] || t.source}</span>
                                </div>
                                {t.description && <div className="text-sm text-secondary lh-1-5">{t.description}</div>}
                            </div>
                        </div>
                        <div className="text-sm text-secondary mb-8">
                            {Object.entries(RULE_LABELS).map(([key, label]) => t.rules?.[key] ? (
                                <div key={key} className="mb-4"><span className="text-blue font-semibold">{label}：</span>{t.rules[key].length > 60 ? t.rules[key].substring(0, 60) + '...' : t.rules[key]}</div>
                            ) : null)}
                            {t.rules?.forbidden?.length > 0 && <div className="text-red mt-4">🚫 禁止：{t.rules.forbidden.join('、')}</div>}
                        </div>
                        {t.example && <div className={s.exampleBlock}>{t.example.length > 120 ? t.example.substring(0, 120) + '...' : t.example}</div>}
                        {t.tags?.length > 0 && <div className="flex gap-4 flex-wrap mb-8">{t.tags.map((tag, i) => <span key={i} className="cyber-tag">{tag}</span>)}</div>}
                        <div className={s.cardActions}>
                            {currentProject && t.id !== currentStyleId && <button className="cyber-btn cyber-btn-sm text-green" onClick={() => handleApplyToProject(t.id)}>应用到项目</button>}
                            <button className="cyber-btn cyber-btn-sm" onClick={() => openEdit(t)}>编辑</button>
                            {!t.isDefault && <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={() => handleDelete(t.id)}>删除</button>}
                        </div>
                    </div>
                ))}
            </div>

            {templates.length === 0 && <div className="cyber-card cyber-empty"><div className="cyber-empty-icon">🎨</div><div>暂无风格模板，点击上方按钮创建或导入</div></div>}

            {showForm && (
                <div className="cyber-modal-overlay">
                    <div className={`cyber-modal ${s.modalWide}`} onClick={e => e.stopPropagation()}>
                        <h2>{selectedTemplate ? '编辑风格模板' : '新建风格模板'}</h2>
                        <div className="form-group"><label className="form-label">风格名称</label><input className="cyber-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：热血爽文、暗黑深沉..." /></div>
                        <div className="form-group"><label className="form-label">风格描述</label><input className="cyber-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="简短描述风格特点..." /></div>
                        <h3 className={s.rulesTitle}>📝 风格规则（越具体，执行越严格）</h3>
                        {Object.entries(RULE_LABELS).map(([key, label]) => (
                            <div key={key} className="form-group"><label className="form-label">{label}</label><input className="cyber-input" value={form.rules[key] || ''} onChange={e => setForm({ ...form, rules: { ...form.rules, [key]: e.target.value } })} placeholder={`描述${label}要求...`} /></div>
                        ))}
                        <div className="form-group">
                            <label className="form-label">🚫 禁止写法</label>
                            <div className="flex gap-4 flex-wrap mb-6">{(form.rules.forbidden || []).map((f, i) => <span key={i} className={`cyber-tag ${s.forbiddenTag}`} onClick={() => removeForbidden(i)}>{f} ×</span>)}</div>
                            <div className="flex gap-8">
                                <input className="cyber-input" value={newForbidden} onChange={e => setNewForbidden(e.target.value)} placeholder="添加禁止写法..." onKeyDown={e => { if (e.key === 'Enter') addForbidden(); }} />
                                <button className="cyber-btn cyber-btn-sm" onClick={addForbidden}>添加</button>
                            </div>
                        </div>
                        <div className="form-group"><label className="form-label">风格示例（执笔人会模仿此风格）</label><textarea className="cyber-textarea" value={form.example} onChange={e => setForm({ ...form, example: e.target.value })} rows={4} placeholder="写一段体现该风格的示例文字..." /></div>
                        <div className="form-group">
                            <label className="form-label">标签</label>
                            <div className="flex gap-4 flex-wrap mb-6">{(form.tags || []).map((t, i) => <span key={i} className="cyber-tag cursor-pointer" onClick={() => removeTag(i)}>{t} ×</span>)}</div>
                            <div className="flex gap-8">
                                <input className="cyber-input" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="添加标签..." onKeyDown={e => { if (e.key === 'Enter') addTag(); }} />
                                <button className="cyber-btn cyber-btn-sm" onClick={addTag}>添加</button>
                            </div>
                        </div>
                        <div className="flex gap-12 justify-end mt-16">
                            <button className="cyber-btn" onClick={closeForm}>取消</button>
                            <button className="cyber-btn cyber-btn-primary" onClick={handleSave} disabled={loading || !form.name.trim()}>{selectedTemplate ? '保存' : '创建'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showAnalyze && (
                <div className="cyber-modal-overlay">
                    <div className={`cyber-modal ${s.analyzeModal}`} onClick={e => e.stopPropagation()}>
                        <h2>📥 导入文本</h2>
                        <div className="flex gap-4 mb-16">
                            <button className={`cyber-btn ${analyzeMode === 'ai' ? 'cyber-btn-primary' : ''}`} onClick={() => setAnalyzeMode('ai')}>🧠 AI分析提炼</button>
                            <button className={`cyber-btn ${analyzeMode === 'direct' ? 'cyber-btn-primary' : ''}`} onClick={() => setAnalyzeMode('direct')}>📄 直接使用</button>
                        </div>
                        <div className={s.analyzeInfo}>{analyzeMode === 'ai' ? '粘贴一段你喜欢的小说文本（至少500字），AI将自动分析其写作风格并提炼为结构化模板' : '直接将文本作为风格参考导入，不经过AI分析。文本将保存为风格示例，后续可手动补充规则'}</div>
                        <div className="form-group">
                            <label className="form-label">风格名称{analyzeMode === 'direct' && <span className="text-red"> *</span>}</label>
                            <input className="cyber-input" value={analyzeName} onChange={e => setAnalyzeName(e.target.value)} placeholder={analyzeMode === 'ai' ? '可选，AI会自动命名...' : '必填，给风格起个名字...'} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">文本内容（至少{analyzeMode === 'ai' ? 500 : 50}字）</label>
                            <textarea className="cyber-textarea" value={analyzeText} onChange={e => setAnalyzeText(e.target.value)} rows={10} placeholder={analyzeMode === 'ai' ? '粘贴小说文本，AI将分析句式、节奏、情感等风格要素...' : '粘贴风格参考文本，将直接保存为风格示例...'} />
                            <div className={analyzeText.length < (analyzeMode === 'ai' ? 500 : 50) ? s.charCountWarn : s.charCountOk}>已输入 {analyzeText.length} 字</div>
                        </div>
                        <div className="flex gap-12 justify-end">
                            <button className="cyber-btn" onClick={closeAnalyze}>取消</button>
                            <button className="cyber-btn cyber-btn-primary" onClick={handleAnalyze} disabled={loading || analyzeText.length < (analyzeMode === 'ai' ? 500 : 50) || (analyzeMode === 'direct' && !analyzeName.trim())}>{loading ? (analyzeMode === 'ai' ? 'AI分析中...' : '导入中...') : (analyzeMode === 'ai' ? '🧠 开始分析' : '📄 直接导入')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
