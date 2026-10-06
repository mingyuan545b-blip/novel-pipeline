import { useState } from 'react';

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
                            {t.channel && <span className="ws-timeline-channel">渠道: {t.channel}</span>}
                            {t.medium && <span className="ws-timeline-channel">媒介: {t.medium}</span>}
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

export { TransitionTimeline, ViolationPanel, AddWorldForm, FactionsPanel };
