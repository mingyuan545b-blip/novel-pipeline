import { useState } from 'react';
import { MATERIAL_TYPE_LABELS } from './materialConstants';

export default function CreateMaterialForm({ onSubmit, onCancel }) {
    const [form, setForm] = useState({
        name: '',
        type: 'character',
        initialContent: '',
        currentContent: '',
        tags: []
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSubmit(form);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="form-group">
                <label className="form-label">素材名称</label>
                <input className="cyber-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
                <label className="form-label">类型</label>
                <select className="cyber-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    {Object.entries(MATERIAL_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
            </div>
            <div className="form-group">
                <label className="form-label">内容</label>
                <textarea className="cyber-textarea" value={form.currentContent} onChange={e => setForm({ ...form, currentContent: e.target.value, initialContent: e.target.value })} rows={6} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="cyber-btn" onClick={onCancel}>取消</button>
                <button type="submit" className="cyber-btn cyber-btn-primary">创建</button>
            </div>
        </form>
    );
}
