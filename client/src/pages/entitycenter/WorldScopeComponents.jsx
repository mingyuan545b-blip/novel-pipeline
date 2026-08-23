import { useState } from 'react';
import { POWER_SYSTEMS, TECH_LEVELS, DANGER_LEVELS, WORLD_TYPES, getPowerSystemLabels, getWorldTypeLabel } from './worldConstants';

const ENTITY_TYPE_ICONS = {
    character: '👤', npc: '🧑', equipment: '⚔', pet: '🐾', servant: '🧑‍💼'
};

function WorldAttributeRow({ label, children }) {
    if (!children) return null;
    return (
        <div className="ws-world-attr-row">
            <span className="ws-world-attr-label">{label}</span>
            <span className="ws-world-attr-value">{children}</span>
        </div>
    );
}

function WorldCard({ world, entities }) {
    const residents = entities.filter(e => e.status !== 'visitor');
    const visitors = entities.filter(e => e.status === 'visitor');
    const powerLabels = getPowerSystemLabels(world.powerSystem);
    const hasAttributes = powerLabels.length > 0 || world.culture || world.rules || world.techLevel || world.dangerLevel || world.description;

    return (
        <div className="ws-world-card" style={{ borderLeftColor: world.color || '#888' }}>
            <div className="ws-world-header">
                <div className="ws-world-dot" style={{ background: world.color || '#888' }} />
                <div className="ws-world-name" style={{ color: world.color || '#888' }}>{world.name}</div>
                {world.worldType && world.worldType !== 'main' && (
                    <span className="ws-badge-type">{WORLD_TYPES[world.worldType]?.icon} {getWorldTypeLabel(world.worldType)}</span>
                )}
                {world.isDefault && <span className="ws-badge-default">默认</span>}
            </div>

            {/* 世界属性区域（武力体系/文化/科技/规则等） */}
            {hasAttributes && (
                <div className="ws-world-attrs">
                    {powerLabels.length > 0 && (
                        <WorldAttributeRow label="武力体系">
                            <div className="ws-power-tags">
                                {powerLabels.map((label, i) => (
                                    <span key={i} className="ws-power-tag">
                                        {POWER_SYSTEMS[world.powerSystem[i]]?.icon} {label}
                                    </span>
                                ))}
                            </div>
                        </WorldAttributeRow>
                    )}
                    {world.techLevel && TECH_LEVELS[world.techLevel] && (
                        <WorldAttributeRow label="科技水平">
                            {TECH_LEVELS[world.techLevel].icon} {TECH_LEVELS[world.techLevel].label}
                        </WorldAttributeRow>
                    )}
                    {world.dangerLevel && DANGER_LEVELS[world.dangerLevel] && (
                        <WorldAttributeRow label="危险等级">
                            {DANGER_LEVELS[world.dangerLevel].icon} {DANGER_LEVELS[world.dangerLevel].label}
                        </WorldAttributeRow>
                    )}
                    {world.culture && <WorldAttributeRow label="文化">{world.culture}</WorldAttributeRow>}
                    {world.rules && <WorldAttributeRow label="世界规则">{world.rules}</WorldAttributeRow>}
                    {world.entryMethod && <WorldAttributeRow label="进入方式">{world.entryMethod}</WorldAttributeRow>}
                    {world.description && <WorldAttributeRow label="简介">{world.description}</WorldAttributeRow>}
                </div>
            )}

            <div className="ws-world-stats">
                <span className="ws-stat-resident">{residents.length} 归属</span>
                {visitors.length > 0 && <span className="ws-stat-visitor">{visitors.length} 穿越</span>}
            </div>
            {entities.length > 0 && (
                <div className="ws-entity-list">
                    {entities.map((e, i) => (
                        <div key={i} className="ws-entity-item">
                            <span className="ws-entity-icon">{ENTITY_TYPE_ICONS[e.entityType] || '📋'}</span>
                            <span className="ws-entity-name">{e.entityName}</span>
                            <span className={`ws-entity-badge ${e.status === 'visitor' ? 'ws-badge-visitor' : 'ws-badge-resident'}`}>
                                {e.status === 'visitor' ? '穿越' : '归属'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function TransitionTimeline({ events }) {
    if (!events || events.length === 0) return null;
    const transitions = events.flatMap(e => (e.transitions || []).map(t => ({ ...t, _eventId: e.id })));
    if (transitions.length === 0) return null;
    return (
        <div className="ws-section">
            <div className="ws-section-title">穿越事件</div>
            <div className="ws-timeline">
                {transitions.map((t, i) => (
                    <div key={i} className="ws-timeline-item">
                        <div className="ws-timeline-dot" />
                        <div className="ws-timeline-content">
                            <span className="ws-timeline-char">{t.character}</span>
                            <span className="ws-timeline-arrow">→</span>
                            <span className="ws-timeline-to">{t.to}</span>
                            {t.from && <span className="ws-timeline-from">（从 {t.from}）</span>}
                            <span className="ws-timeline-ch">第{t.chapterNumber}章</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ViolationPanel({ violations }) {
    if (!violations || violations.length === 0) return null;
    return (
        <div className="ws-section">
            <div className="ws-section-title ws-title-danger">跨世界串台警告</div>
            <div className="ws-violations">
                {violations.map((v, i) => (
                    <div key={i} className="ws-violation-item">
                        <span className="ws-violation-entity">{v.entity}</span>
                        <span className="ws-violation-arrow">归属 {v.homeWorld}</span>
                        {v.appearedIn && <span className="ws-violation-appear">出现在 {v.appearedIn}</span>}
                        {v.description && <span className="ws-violation-desc">{v.description}</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}

function AddWorldForm({ onAdd, onCancel }) {
    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [color, setColor] = useState('#a29bfe');

    const handleSubmit = () => {
        if (!id.trim() || !name.trim()) return;
        onAdd({ id: id.trim(), name: name.trim(), color, isDefault: false });
    };

    return (
        <div className="ws-add-form">
            <div className="ws-add-form-row">
                <input className="ws-add-input" value={id} onChange={e => setId(e.target.value)} placeholder="世界ID (如 dungeon-001)" />
                <input className="ws-add-input" value={name} onChange={e => setName(e.target.value)} placeholder="世界名称 (如 白瓷赌坊)" />
                <input className="ws-add-input ws-add-color" type="color" value={color} onChange={e => setColor(e.target.value)} />
            </div>
            <div className="ws-add-form-btns">
                <button className="cyber-btn cyber-btn-sm" onClick={handleSubmit}>添加</button>
                <button className="cyber-btn cyber-btn-sm cyber-btn-outline" onClick={onCancel}>取消</button>
            </div>
        </div>
    );
}

const FACTION_STATUS_LABELS = {
    active: '活跃', declining: '衰退', destroyed: '覆灭', hidden: '隐世', emerging: '新兴'
};
const POWER_SYSTEM_LABELS = {
    cultivation: '修炼', immortal: '修仙', tech: '科技', magic: '魔法',
    'ancient-ritual': '古老祭祀', martial: '武道', psionic: '异能', faith: '信仰'
};

function FactionsPanel({ factionsByWorld, worlds }) {
    const worldIds = Object.keys(factionsByWorld || {}).filter(wid => (factionsByWorld[wid] || []).length > 0);
    if (worldIds.length === 0) return null;
    const worldNameMap = {};
    for (const w of (worlds || [])) worldNameMap[w.id] = w.name;
    return (
        <div className="ws-section ws-factions-section">
            <div className="ws-section-title">势力格局</div>
            {worldIds.map(wid => (
                <div key={wid} className="ws-factions-group">
                    <div className="ws-factions-group-title">
                        🏛 {worldNameMap[wid] || wid}
                        <span className="ws-faction-type">{factionsByWorld[wid].length}个势力</span>
                    </div>
                    {factionsByWorld[wid].map(f => (
                        <div key={f.id} className="ws-faction-item">
                            <span className="ws-faction-name">{f.name}</span>
                            <span className="ws-faction-type">{POWER_SYSTEM_LABELS[f.type] || f.type}</span>
                            <span className={`ws-faction-status ws-faction-status-${f.status}`}>
                                {FACTION_STATUS_LABELS[f.status] || f.status}
                            </span>
                            {f.leader && <span className="ws-faction-leader">首领: {f.leader}</span>}
                            {f.description && <div className="ws-faction-desc">{f.description}</div>}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export { WorldCard, TransitionTimeline, ViolationPanel, AddWorldForm, FactionsPanel };
