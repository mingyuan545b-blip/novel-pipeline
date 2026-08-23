export default function FlavorEditForm({
    flavorForm, setFlavorForm,
    flavorNamingStyles, flavorDialects, flavorSpeechStyles,
    worldviewTemplates, systemPersonas,
    saveFlavor, setEditingFlavor,
}) {
    return (
        <div>
            <div className="text-sm text-muted mb-10">配置项目级风味默认值，角色素材可单独覆盖</div>
            <FlavorSelectRow
                label1="✒️ 命名风格" value1={flavorForm.namingStyle} field1="namingStyle"
                options1={[{ value: '', label: '自动推断' }, ...flavorNamingStyles.map(s => ({ value: s.id, label: `${s.label}（${s.tag}）` }))]}
                label2="命名强度" value2={flavorForm.namingStyleIntensity} field2="namingStyleIntensity"
                options2={[{ value: 'light', label: '轻度' }, { value: 'medium', label: '中度' }, { value: 'heavy', label: '重度' }]}
                disabled2={!flavorForm.namingStyle}
                setFlavorForm={setFlavorForm}
            />
            <FlavorSelectRow
                label1="🗣 默认方言" value1={flavorForm.defaultDialect} field1="defaultDialect"
                options1={[{ value: '', label: '不指定' }, ...flavorDialects.map(d => ({ value: d.region, label: d.label }))]}
                label2="方言强度" value2={flavorForm.defaultDialectIntensity} field2="defaultDialectIntensity"
                options2={[{ value: 'light', label: '轻度' }, { value: 'medium', label: '中度' }, { value: 'heavy', label: '重度' }]}
                disabled2={!flavorForm.defaultDialect}
                setFlavorForm={setFlavorForm}
            />
            <FlavorSelectRow
                label1="🎭 默认说话风格" value1={flavorForm.defaultSpeechStyle} field1="defaultSpeechStyle"
                options1={[{ value: '', label: '不指定' }, ...flavorSpeechStyles.map(s => ({ value: s.id, label: s.label }))]}
                label2="风格强度" value2={flavorForm.defaultSpeechStyleIntensity} field2="defaultSpeechStyleIntensity"
                options2={[{ value: 'light', label: '轻度' }, { value: 'medium', label: '中度' }, { value: 'heavy', label: '重度' }]}
                disabled2={!flavorForm.defaultSpeechStyle}
                setFlavorForm={setFlavorForm}
            />
            <div className="flex-col gap-8 mb-8">
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label text-sm">🌍 世界观阶段模板</label>
                    <select className="cyber-select" value={flavorForm.worldviewTemplate}
                        onChange={e => setFlavorForm(f => ({ ...f, worldviewTemplate: e.target.value }))}>
                        <option value="">自动推断（根据题材）</option>
                        {worldviewTemplates.map(t => <option key={t.id} value={t.id}>{t.label}（{t.tag}）</option>)}
                    </select>
                    <div className="text-xs text-muted mt-4">控制前中后期战力天花板/地理范围/势力复杂度/叙事节奏</div>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label text-sm">🤖 系统人格</label>
                    <select className="cyber-select" value={flavorForm.systemPersona}
                        onChange={e => setFlavorForm(f => ({ ...f, systemPersona: e.target.value }))}>
                        <option value="">无系统/标准系统</option>
                        {systemPersonas.map(p => <option key={p.id} value={p.id}>{p.label}（{p.tag}）</option>)}
                    </select>
                    <div className="text-xs text-muted mt-4">系统通知格式/语气/互动规则/砍价/整蛊/隐藏福利</div>
                </div>
            </div>
            <div className="flex gap-8">
                <button className="cyber-btn cyber-btn-sm cyber-btn-primary" onClick={saveFlavor}>保存</button>
                <button className="cyber-btn cyber-btn-sm" onClick={() => setEditingFlavor(false)}>取消</button>
            </div>
        </div>
    );
}

function FlavorSelectRow({ label1, value1, field1, options1, label2, value2, field2, options2, disabled2, setFlavorForm }) {
    return (
        <div className="grid-2 gap-8 mb-8">
            <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label text-sm">{label1}</label>
                <select className="cyber-select" value={value1}
                    onChange={e => setFlavorForm(f => ({ ...f, [field1]: e.target.value }))}>
                    {options1.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label text-sm">{label2}</label>
                <select className="cyber-select" value={value2}
                    onChange={e => setFlavorForm(f => ({ ...f, [field2]: e.target.value }))}
                    disabled={disabled2}>
                    {options2.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>
        </div>
    );
}
