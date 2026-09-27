/**
 * CreateRelationForm.jsx — 手动新建关系（从 EntityGraph 拆出，保证单文件≤200行）
 */
import { useState } from 'react';
import { REL_TYPE_LABELS } from './constants';

export default function CreateRelationForm({ characters, onSubmit, onCancel }) {
    const [fromId, setFromId] = useState('');
    const [toId, setToId] = useState('');
    const [relType, setRelType] = useState('ally');
    const [relLabel, setRelLabel] = useState('');
    const [notes, setNotes] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!fromId || !toId || fromId === toId) return;
        onSubmit({ fromCharacterId: fromId, toCharacterId: toId, relType, relLabel, notes, strength: 50, trustLevel: 50 });
    };

    return (
        <form onSubmit={handleSubmit} className="cyber-card ec-border-cyan">
            <h4 className="ec-text-14 ec-font-600 ec-mb-12 ec-color-cyan">新建关系</h4>
            <div className="ec-grid-2 ec-gap-12">
                <div>
                    <label className="ec-text-12 ec-text-muted ec-mb-4">角色A</label>
                    <select className="cyber-select ec-w-full" value={fromId} onChange={e => setFromId(e.target.value)}>
                        <option value="">选择角色</option>
                        {characters.map(c => <option key={c.id} value={c.id}>{c._adapted?.name || c.name || c.id}</option>)}
                    </select>
                </div>
                <div>
                    <label className="ec-text-12 ec-text-muted ec-mb-4">角色B</label>
                    <select className="cyber-select ec-w-full" value={toId} onChange={e => setToId(e.target.value)}>
                        <option value="">选择角色</option>
                        {characters.map(c => <option key={c.id} value={c.id}>{c._adapted?.name || c.name || c.id}</option>)}
                    </select>
                </div>
                <div>
                    <label className="ec-text-12 ec-text-muted ec-mb-4">关系类型</label>
                    <select className="cyber-select ec-w-full" value={relType} onChange={e => setRelType(e.target.value)}>
                        {Object.entries(REL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                <div>
                    <label className="ec-text-12 ec-text-muted ec-mb-4">关系描述</label>
                    <input className="cyber-input ec-w-full" value={relLabel} onChange={e => setRelLabel(e.target.value)} placeholder="如：师徒、恋人" />
                </div>
                <div className="ec-span-full">
                    <label className="ec-text-12 ec-text-muted ec-mb-4">备注</label>
                    <input className="cyber-input ec-w-full" value={notes} onChange={e => setNotes(e.target.value)} placeholder="关系说明（可选）" />
                </div>
            </div>
            <div className="ec-flex ec-gap-8 ec-mt-12">
                <button type="submit" className="cyber-btn cyber-btn-sm" disabled={!fromId || !toId || fromId === toId}>创建</button>
                <button type="button" className="cyber-btn cyber-btn-sm cyber-btn-ghost" onClick={onCancel}>取消</button>
            </div>
        </form>
    );
}
