import { GENRE_PRESETS, STYLE_PRESETS, TONE_PRESETS, POV_PRESETS } from './createProjectConstants';

function PresetButtons({ label, presets, value, onChange }) {
    return (
        <div className="form-group">
            <label className="form-label">{label}</label>
            <div className="flex flex-wrap gap-6">
                {presets.map(p => (
                    <button key={p.value} type="button" className={`cyber-btn cyber-btn-sm ${value === p.value ? 'cyber-btn-primary' : ''}`}
                        onClick={() => onChange(p.value)}>{p.label}</button>
                ))}
            </div>
        </div>
    );
}

function ElementField({ currentElementPresets, selectedElements, setSelectedElements, form, setForm, toggleElement }) {
    return (
        <div className="form-group">
            <label className="form-label">核心元素（选择或输入，最多5个）</label>
            {currentElementPresets.length > 0 && (
                <div className="flex flex-wrap gap-6 mb-8">
                    {currentElementPresets.map(el => <button key={el} type="button" className={`cyber-btn cyber-btn-sm ${selectedElements.includes(el) ? 'cyber-btn-primary' : ''}`} onClick={() => toggleElement(el)}>{el}</button>)}
                </div>
            )}
            <input className="cyber-input" value={form.elements} onChange={e => { setForm(f => ({ ...f, elements: e.target.value })); setSelectedElements(e.target.value.split(/[、,，\s]+/).filter(Boolean)); }} placeholder="如：异能、唯一、未来科技（用顿号或逗号分隔）" />
        </div>
    );
}

function ConstraintSection({ selectedConstraints, setSelectedConstraints, constraintPresets, toggleConstraint }) {
    return (
        <div className="form-group">
            <div className="flex-between mb-8">
                <label className="form-label" style={{ marginBottom: 0 }}>🔒 写作约束</label>
                <button type="button" className="cyber-btn cyber-btn-sm text-sm" onClick={() => setSelectedConstraints(selectedConstraints.length === constraintPresets.length ? [] : constraintPresets.map(c => c.id))}>{selectedConstraints.length === constraintPresets.length ? '取消全选' : '全选'}</button>
            </div>
            <div className="grid-2-gap-6">
                {constraintPresets.map(c => <button key={c.id} type="button" className={`cyber-btn cyber-btn-sm ${selectedConstraints.includes(c.id) ? 'cyber-btn-primary' : ''} justify-start text-left text-sm`} style={{ padding: '6px 10px' }} title={c.desc} onClick={() => toggleConstraint(c.id)}>{c.label}</button>)}
            </div>
            {selectedConstraints.length > 0 && (
                <div className="info-panel-cyan">{selectedConstraints.map(id => constraintPresets.find(c => c.id === id)).filter(Boolean).map(c => <div key={c.id}><span className="text-blue">{c.label}</span> {c.desc}</div>)}</div>
            )}
        </div>
    );
}

export default function ProjectFormFields({ state, onClose }) {
    const {
        mode, setMode, loading, progress, selectedElements, setSelectedElements, selectedConstraints, setSelectedConstraints,
        form, setForm, styleTemplates, constraintPresets, namingStyles, inferredNaming,
        selectedNamingStyle, setSelectedNamingStyle, genreFullConfig,
        currentElementPresets, handleGenreSelect, handleCustomGenreInput, toggleElement,
        toggleConstraint, handleSubmit
    } = state;

    return (
        <form onSubmit={handleSubmit}>
            <div className="cyber-tabs mb-16">
                {['template', 'manual'].map(m => (
                    <button key={m} className={`cyber-tab ${mode === m ? 'cyber-tab-active' : ''}`}
                        onClick={() => setMode(m)}
                        style={mode === m ? { borderColor: m === 'template' ? 'var(--neon-blue)' : 'var(--neon-purple)', color: m === 'template' ? 'var(--neon-blue)' : 'var(--neon-purple)' } : {}}>
                        {m === 'template' ? '🚀 模板一键生成' : '✏ 手动创建'}
                    </button>
                ))}
            </div>

            <div className="form-group">
                <label className="form-label">小说名称 *</label>
                <input className="cyber-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="输入小说名称..." required />
            </div>

            <div className="form-group">
                <label className="form-label">题材/类型 *</label>
                <div className="flex flex-wrap gap-6">
                    {GENRE_PRESETS.map(g => (
                        <button key={g.value} type="button" className={`cyber-btn cyber-btn-sm ${form.genre === g.value ? 'cyber-btn-primary' : ''}`}
                            onClick={() => handleGenreSelect(g.value)}>{g.label}</button>
                    ))}
                </div>
                {!GENRE_PRESETS.find(g => g.value === form.genre) && form.genre && <div className="mt-6 text-sm text-blue">自定义: {form.genre}</div>}
                <input className="cyber-input mt-8" value={form.genre} onChange={e => handleCustomGenreInput(e.target.value)} placeholder="或输入自定义题材..." />
            </div>

            {form.genre && (
                <div className="info-panel-orange">
                    <div className="text-base font-semibold text-orange mb-6">✒️ 命名风格</div>
                    {inferredNaming && !selectedNamingStyle && (
                        <div className="text-sm text-secondary mb-8">🎯 题材「{form.genre}」推荐：<span className="text-orange font-semibold">{inferredNaming.label}</span>（{inferredNaming.tag}）— 系统将自动应用此风格为角色命名规范</div>
                    )}
                    <select className="cyber-select text-sm" value={selectedNamingStyle} onChange={e => setSelectedNamingStyle(e.target.value)}>
                        <option value="">{inferredNaming ? `自动推断：${inferredNaming.label}（${inferredNaming.tag}）` : '自动推断（选择题材后推荐）'}</option>
                        {namingStyles.map(s => <option key={s.id} value={s.id}>{s.label}（{s.tag}）</option>)}
                    </select>
                    {selectedNamingStyle && <div className="text-sm text-blue mt-4">✅ 已手动覆盖为：{namingStyles.find(s => s.id === selectedNamingStyle)?.label || selectedNamingStyle}</div>}
                </div>
            )}

            {genreFullConfig && form.genre && (
                <div className="info-panel-blue-light">
                    <div className="text-base font-semibold text-blue mb-8">🎯 题材「{form.genre}」自动适配配置</div>
                    <div className="grid-2-gap-6 text-sm text-secondary">
                        <div>🌍 世界观：<span className="text-blue">{genreFullConfig.worldviewTemplate || '自动推断'}</span></div>
                        <div>✒️ 命名：<span className="text-orange">{genreFullConfig.namingStyle || '自动推断'}</span></div>
                        <div>📖 模式：<span className="text-green">长篇</span></div>
                        <div>📝 字数：<span className="text-pink">{genreFullConfig.wordConfig?.targetWords || 2800}字/章</span></div>
                        <div>🤖 系统人格：<span className="text-purple">{genreFullConfig.defaultSystemPersona || '自动推断'}</span></div>
                    </div>
                    {genreFullConfig.defaultArchetypes?.length > 0 && <div className="mt-6 text-sm text-secondary">🃏 推荐人设：{genreFullConfig.defaultArchetypes.join('、')}</div>}
                    {genreFullConfig.reviewFocus?.length > 0 && <div className="mt-4 text-sm text-secondary">🔍 审核重点：{genreFullConfig.reviewFocus.slice(0, 3).join('；')}</div>}
                    <div className="mt-6 text-xs text-muted">以上配置将在创建项目时自动写入，可在项目设置中调整</div>
                </div>
            )}

            {mode === 'template' && (
                <>
                    <ElementField currentElementPresets={currentElementPresets} selectedElements={selectedElements} setSelectedElements={setSelectedElements} form={form} setForm={setForm} toggleElement={toggleElement} />
                    <div className="form-row">
                        <div className="form-group flex-0-140"><label className="form-label">目标章节数</label><input className="cyber-input" type="number" value={form.targetChapters} onChange={e => setForm({ ...form, targetChapters: parseInt(e.target.value) || 100 })} min={1} /></div>
                        <div className="form-group flex-0-140"><label className="form-label">目标字数</label><input className="cyber-input" value={form.targetWords} onChange={e => setForm({ ...form, targetWords: e.target.value })} placeholder="如：300万" /></div>
                        <div className="form-group"><label className="form-label">风格模板</label><select className="cyber-select" value={form.styleTemplateId} onChange={e => setForm({ ...form, styleTemplateId: e.target.value })}><option value="">不指定</option>{styleTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                    </div>
                    <PresetButtons label="写作风格" presets={STYLE_PRESETS} value={form.style} onChange={v => setForm(f => ({ ...f, style: f.style === v ? '' : v }))} />
                    <PresetButtons label="基调" presets={TONE_PRESETS} value={form.tone} onChange={v => setForm(f => ({ ...f, tone: f.tone === v ? '' : v }))} />
                    <PresetButtons label="叙事视角" presets={POV_PRESETS} value={form.pov} onChange={v => setForm(f => ({ ...f, pov: f.pov === v ? '' : v }))} />
                    <div className="form-group"><label className="form-label">世界设定方向（可选）</label><input className="cyber-input" value={form.setting} onChange={e => setForm({ ...form, setting: e.target.value })} placeholder="如：末世废土、星际帝国、修仙大陆..." /></div>
                    <div className="form-group"><label className="form-label">核心冲突（可选）</label><input className="cyber-input" value={form.conflict} onChange={e => setForm({ ...form, conflict: e.target.value })} placeholder="如：人类vs异族、正道vs魔道、个人vs命运..." /></div>
                    <div className="form-group"><label className="form-label">主题（可选）</label><input className="cyber-input" value={form.themes} onChange={e => setForm({ ...form, themes: e.target.value })} placeholder="如：成长、自由、正义、救赎..." /></div>
                    <ConstraintSection selectedConstraints={selectedConstraints} setSelectedConstraints={setSelectedConstraints} constraintPresets={constraintPresets} toggleConstraint={toggleConstraint} />
                </>
            )}
            {mode === 'manual' && (
                <>
                    <div className="form-group"><label className="form-label">描述</label><textarea className="cyber-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="描述你的小说需求、目标、选题..." rows={4} /></div>
                    <ElementField currentElementPresets={currentElementPresets} selectedElements={selectedElements} setSelectedElements={setSelectedElements} form={form} setForm={setForm} toggleElement={toggleElement} />
                    <div className="form-row">
                        <div className="form-group flex-0-140"><label className="form-label">目标章节数</label><input className="cyber-input" type="number" value={form.targetChapters} onChange={e => setForm({ ...form, targetChapters: parseInt(e.target.value) || 100 })} min={1} /></div>
                        <div className="form-group flex-0-140"><label className="form-label">审核轮次</label><input className="cyber-input" type="number" value={form.settings.chapterRounds} onChange={e => setForm({ ...form, settings: { ...form.settings, chapterRounds: parseInt(e.target.value) || 3 } })} min={1} max={10} /></div>
                        <div className="form-group"><label className="form-label">风格模板</label><select className="cyber-select" value={form.styleTemplateId} onChange={e => setForm({ ...form, styleTemplateId: e.target.value })}><option value="">不指定</option>{styleTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                    </div>
                    <PresetButtons label="写作风格" presets={STYLE_PRESETS} value={form.style} onChange={v => setForm(f => ({ ...f, style: f.style === v ? '' : v }))} />
                    <PresetButtons label="叙事视角" presets={POV_PRESETS} value={form.pov} onChange={v => setForm(f => ({ ...f, pov: f.pov === v ? '' : v }))} />
                    <ConstraintSection selectedConstraints={selectedConstraints} setSelectedConstraints={setSelectedConstraints} constraintPresets={constraintPresets} toggleConstraint={toggleConstraint} />
                    <div className="info-panel-purple">
                        <div className="text-base text-purple font-semibold mb-4">💡 自动补充设定</div>
                        <div className="text-sm text-secondary">勾选后，AI 将根据你的描述和元素自动生成世界观、人物、大纲等完整设定</div>
                        <label className="flex gap-8 mt-8 cursor-pointer text-md text-primary"><input type="checkbox" checked={form.autoSupplement || false} onChange={e => setForm({ ...form, autoSupplement: e.target.checked })} />启用AI自动补充完善设定</label>
                    </div>
                </>
            )}

            {progress && <div className="info-panel-progress"><span className="cyber-loading"></span>{progress}</div>}

            <div className="flex gap-12 justify-end mt-20">
                <button type="button" className="cyber-btn" onClick={onClose}>取消</button>
                <button type="submit" className="cyber-btn cyber-btn-primary" disabled={loading || !form.name.trim() || !form.genre.trim()}>
                    {loading ? <><span className="cyber-loading"></span> 生成中(3-5分钟)...</> : mode === 'template' ? '🚀 一键生成' : (form.autoSupplement ? '🚀 创建并AI补充设定' : '创建项目')}
                </button>
            </div>
        </form>
    );
}
