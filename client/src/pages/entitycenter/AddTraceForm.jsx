import { useState } from 'react';
import { ORIGIN_METHODS, TRACE_ENTITY_TYPES } from './crossWorldTraceConstants';

/**
 * 添加跨世界溯源表单
 * 文件位置：client/src/pages/entitycenter/AddTraceForm.jsx
 */
function AddTraceForm({ onSubmit, onCancel }) {
    const [form, setForm] = useState({
        entityName: '', entityType: 'equipment', characterName: '',
        originWorldId: 'main-world', originWorldName: '主世界',
        originChapter: 1, originMethod: 'picked', originNote: ''
    });
    const upd = (k, v) => setForm({ ...form, [k]: v });

    return (
        <div className="cwt-add-form">
            <div className="cwt-add-row">
                <input className="cwt-input" placeholder="物品/功法名称"
                    value={form.entityName} onChange={e => upd('entityName', e.target.value)} />
                <select className="cwt-select" value={form.entityType} onChange={e => upd('entityType', e.target.value)}>
                    {Object.values(TRACE_ENTITY_TYPES).map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                </select>
            </div>
            <div className="cwt-add-row">
                <input className="cwt-input" placeholder="持有者角色名"
                    value={form.characterName} onChange={e => upd('characterName', e.target.value)} />
                <input className="cwt-input" placeholder="来源世界ID"
                    value={form.originWorldId} onChange={e => upd('originWorldId', e.target.value)} />
                <input className="cwt-input" placeholder="来源世界名"
                    value={form.originWorldName} onChange={e => upd('originWorldName', e.target.value)} />
            </div>
            <div className="cwt-add-row">
                <input className="cwt-input" type="number" min="1" placeholder="章节"
                    value={form.originChapter} onChange={e => upd('originChapter', parseInt(e.target.value) || 0)} />
                <select className="cwt-select" value={form.originMethod} onChange={e => upd('originMethod', e.target.value)}>
                    {Object.values(ORIGIN_METHODS).map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
                </select>
            </div>
            <input className="cwt-input" placeholder="获取场景简述(可选)"
                value={form.originNote} onChange={e => upd('originNote', e.target.value)} />
            <div className="cwt-add-btns">
                <button className="cyber-btn cyber-btn-sm"
                    onClick={() => form.entityName && onSubmit(form)}>创建</button>
                <button className="cyber-btn cyber-btn-sm cyber-btn-outline" onClick={onCancel}>取消</button>
            </div>
        </div>
    );
}

export default AddTraceForm;
