import { STYLE_RULE_LABELS } from './constants';

export default function StyleCard({ dragHandleProps, currentProject,
    styleTemplate, editingStyle, styleEditForm, setStyleEditForm,
    startEditingStyle, saveStyleEdits, setEditingStyle }) {
    return (
        <div className="cyber-card">
            <div className="card-header" {...dragHandleProps}>
                <div className="card-title-row">
                    <span className="drag-handle">⋮⋮</span>
                    <h3 className="card-title card-title-blue">🎨 写作风格</h3>
                </div>
                {currentProject && (
                    <button className="cyber-btn cyber-btn-sm" onClick={startEditingStyle}>
                        {styleTemplate ? '编辑' : '设置风格'}
                    </button>
                )}
            </div>
            {currentProject ? (
                editingStyle ? (
                    <div>
                        <div className="text-sm text-secondary mb-8">修改风格会增量叠加到原有设定上</div>
                        <div className="form-group">
                            <label className="form-label">叙事节奏</label>
                            <input className="cyber-input" value={styleEditForm.rules?.narrativePacing || ''}
                                onChange={e => setStyleEditForm(f => ({ ...f, rules: { ...f.rules, narrativePacing: e.target.value } }))}
                                placeholder="如：快节奏、张弛有度..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">描写风格</label>
                            <input className="cyber-input" value={styleEditForm.rules?.descriptionStyle || ''}
                                onChange={e => setStyleEditForm(f => ({ ...f, rules: { ...f.rules, descriptionStyle: e.target.value } }))}
                                placeholder="如：细腻写实、留白写意..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">对话风格</label>
                            <input className="cyber-input" value={styleEditForm.rules?.dialogueStyle || ''}
                                onChange={e => setStyleEditForm(f => ({ ...f, rules: { ...f.rules, dialogueStyle: e.target.value } }))}
                                placeholder="如：机智幽默、简洁有力..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">情感基调</label>
                            <input className="cyber-input" value={styleEditForm.rules?.emotionalTone || ''}
                                onChange={e => setStyleEditForm(f => ({ ...f, rules: { ...f.rules, emotionalTone: e.target.value } }))}
                                placeholder="如：热血激昂、幽默轻松..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">幽默程度</label>
                            <select className="cyber-select" value={styleEditForm.rules?.humorLevel || ''}
                                onChange={e => setStyleEditForm(f => ({ ...f, rules: { ...f.rules, humorLevel: e.target.value } }))}>
                                <option value="">不指定</option><option value="无">无幽默</option>
                                <option value="偶尔">偶尔幽默</option><option value="适中">适中幽默</option>
                                <option value="大量">大量幽默</option>
                            </select>
                        </div>
                        <div className="flex gap-8">
                            <button className="cyber-btn cyber-btn-sm cyber-btn-primary" onClick={saveStyleEdits}>保存</button>
                            <button className="cyber-btn cyber-btn-sm" onClick={() => setEditingStyle(false)}>取消</button>
                        </div>
                    </div>
                ) : styleTemplate ? (
                    <div>
                        <div className="text-base font-semibold mb-6 text-blue">{styleTemplate.name}</div>
                        <div className="tag-group">
                            {Object.entries(styleTemplate.rules || {}).filter(([k, v]) => k !== 'forbidden' && v).map(([k, v]) => (
                                <span key={k} className="tag-item tag-blue">
                                    {STYLE_RULE_LABELS[k] || k}: {v}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : <div className="text-sm text-muted">未设置风格模板</div>
            ) : (
                <div className="text-sm text-muted">请先选择产品</div>
            )}
        </div>
    );
}
