import { useState } from 'react';
import { GenerativeAvatar, RadialProgress, StrengthBar } from './UiComponents';
import { REL_TYPE_COLORS, REL_TYPE_LABELS } from './constants';

function RelationArrow({ color, strength }) {
    return (
        <svg width="20" height="10" aria-hidden="true" className="ec-shrink-0">
            <line x1="0" y1="5" x2="14" y2="5" stroke={color} strokeWidth="1.5" strokeDasharray={strength > 60 ? 'none' : '3 2'} />
            <polygon points="14,2 20,5 14,8" fill={color} />
        </svg>
    );
}

function RelationItem({ rel, getCharName }) {
    const relColor = REL_TYPE_COLORS[rel.relType] || '#888';
    const toId = rel._adapted?.toCharacterId || rel.toCharacterId;
    return (
        <div className="cyber-card" style={{ borderLeft: `3px solid ${relColor}` }}>
            <div className="ec-flex ec-justify-between ec-items-center ec-mb-6">
                <div className="ec-flex ec-items-center ec-gap-8 ec-min-w-0">
                    <GenerativeAvatar name={getCharName(rel.fromCharacterId)} size={24} />
                    <span className="ec-text-13 ec-ellipsis ec-font-500">{getCharName(rel.fromCharacterId)}</span>
                    <RelationArrow color={relColor} strength={rel.strength} />
                    <GenerativeAvatar name={getCharName(toId)} size={24} />
                    <span className="ec-text-13 ec-ellipsis ec-font-500">{getCharName(toId)}</span>
                </div>
                <div className="ec-flex ec-gap-4 ec-items-center ec-shrink-0">
                    <span className="ec-badge-lg ec-badge-dynamic" style={{ '--badge-bg': `${relColor}15`, '--badge-color': relColor }}>
                        {REL_TYPE_LABELS[rel.relType] || rel.relType}
                    </span>
                    {rel.relLabel && (
                        <span className="ec-badge ec-badge-muted">{rel.relLabel}</span>
                    )}
                </div>
            </div>
            <div className="ec-flex ec-gap-16 ec-items-center">
                <div className="ec-flex-1">
                    <div className="ec-text-10 ec-text-muted ec-mb-2">强度</div>
                    <StrengthBar value={rel.strength || 50} />
                </div>
                {rel.trustLevel !== undefined && (
                    <div className="ec-flex-1">
                        <div className="ec-flex ec-items-center ec-gap-6">
                            <RadialProgress value={rel.trustLevel} size={20} strokeWidth={2} color="var(--neon-green)" />
                            <span className="ec-text-10 ec-text-muted">信任度 <span className="ec-tabular">{rel.trustLevel}</span></span>
                        </div>
                    </div>
                )}
            </div>
            {rel.notes && <div className="ec-text-12 ec-text-muted ec-mt-6">{rel.notes}</div>}
        </div>
    );
}

function RelationStats({ relations }) {
    const typeCounts = {};
    for (const r of relations) {
        const type = r.relType || 'other';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    return (
        <div className="ec-flex ec-gap-8 ec-flex-wrap ec-mb-12">
            <span className="ec-badge ec-badge-muted">共 {relations.length} 条关系</span>
            {Object.entries(typeCounts).map(([type, count]) => {
                const color = REL_TYPE_COLORS[type] || '#888';
                const label = REL_TYPE_LABELS[type] || type;
                return (
                    <span key={type} className="ec-summary-tag" style={{ '--tag-color': color, '--tag-bg': `${color}15` }}>
                        <span className="ec-summary-tag-label">{label}</span>
                        <span className="ec-summary-tag-value">{count}</span>
                    </span>
                );
            })}
        </div>
    );
}

function CreateRelationForm({ characters, getCharName: _getCharName, onSubmit, onCancel }) {
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
                        {characters.map(c => (
                            <option key={c.id} value={c.id}>{c._adapted?.name || c.name || c.id}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="ec-text-12 ec-text-muted ec-mb-4">角色B</label>
                    <select className="cyber-select ec-w-full" value={toId} onChange={e => setToId(e.target.value)}>
                        <option value="">选择角色</option>
                        {characters.map(c => (
                            <option key={c.id} value={c.id}>{c._adapted?.name || c.name || c.id}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="ec-text-12 ec-text-muted ec-mb-4">关系类型</label>
                    <select className="cyber-select ec-w-full" value={relType} onChange={e => setRelType(e.target.value)}>
                        {Object.entries(REL_TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
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

export default function EntityGraph({ allRelations, getCharName, characters, onCreateRelation }) {
    const [showCreateForm, setShowCreateForm] = useState(false);

    if (!allRelations.length && !showCreateForm) {
        return (
            <div>
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon" aria-hidden="true">🔗</div>
                    <div>暂无关系数据</div>
                    <div className="ec-text-12 ec-text-muted ec-mt-8">
                        关系数据在大纲生成和Pipeline运行时自动创建。
                        <br />也可以手动添加角色之间的关系。
                    </div>
                    <button className="cyber-btn cyber-btn-sm ec-mt-12" onClick={() => setShowCreateForm(true)}>
                        手动创建关系
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="ec-flex ec-justify-between ec-items-center ec-mb-12">
                <RelationStats relations={allRelations} />
                <button className="cyber-btn cyber-btn-sm" onClick={() => setShowCreateForm(!showCreateForm)}>
                    {showCreateForm ? '收起' : '新建关系'}
                </button>
            </div>

            {showCreateForm && (
                <CreateRelationForm
                    characters={characters}
                    getCharName={getCharName}
                    onSubmit={(data) => {
                        if (onCreateRelation) onCreateRelation(data);
                        setShowCreateForm(false);
                    }}
                    onCancel={() => setShowCreateForm(false)}
                />
            )}

            <div className="ec-flex-col ec-gap-8">
                {allRelations.map(rel => (
                    <RelationItem key={rel.id} rel={rel} getCharName={getCharName} />
                ))}
            </div>
        </div>
    );
}
