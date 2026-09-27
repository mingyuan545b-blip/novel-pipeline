/**
 * RelationPairRow.jsx — "一对角色"的关系行（可含多条边=复合关系）
 * 点开可看每条边的方向/描述/强度/信任/章节。解决"关系都是单一、看不出复合"的问题。
 */
import { useState } from 'react';
import { GenerativeAvatar, RadialProgress, StrengthBar } from './UiComponents';
import { relMeta } from './relationUtils';

function Arrow({ color, strength }) {
    return (
        <svg width="18" height="10" aria-hidden="true" className="ec-shrink-0">
            <line x1="0" y1="5" x2="12" y2="5" stroke={color} strokeWidth="1.5" strokeDasharray={strength > 60 ? 'none' : '3 2'} />
            <polygon points="12,2 18,5 12,8" fill={color} />
        </svg>
    );
}

export function EdgeDetail({ rel, getCharName }) {
    const m = relMeta(rel.relType);
    const toId = rel._adapted?.toCharacterId || rel.toCharacterId;
    return (
        <div className="rp-edge" style={{ borderLeftColor: m.color }}>
            <div className="rp-edge-head">
                <GenerativeAvatar name={getCharName(rel.fromCharacterId)} size={20} />
                <span className="ec-text-12 ec-ellipsis">{getCharName(rel.fromCharacterId)}</span>
                <Arrow color={m.color} strength={rel.strength || 50} />
                <GenerativeAvatar name={getCharName(toId)} size={20} />
                <span className="ec-text-12 ec-ellipsis">{getCharName(toId)}</span>
                <span className="rp-badge" style={{ '--badge-bg': `${m.color}1a`, '--badge-color': m.color }}>{m.label}</span>
                {rel.relLabel && <span className="rp-label">{rel.relLabel}</span>}
                {rel.isSecret && <span className="rp-secret">秘密</span>}
                {(rel.startChapter > 0) && <span className="rp-chapter">Ch{rel.startChapter}{rel.endChapter ? `–${rel.endChapter}` : '起'}</span>}
            </div>
            <div className="rp-edge-meta">
                <div className="rp-meter"><span className="rp-meter-label">强度</span><StrengthBar value={rel.strength || 50} /></div>
                {rel.trustLevel !== undefined && (
                    <div className="rp-trust">
                        <RadialProgress value={rel.trustLevel} size={18} strokeWidth={2} color="var(--neon-green)" />
                        <span className="rp-meter-label">信任 {rel.trustLevel}</span>
                    </div>
                )}
            </div>
            {rel.notes && <div className="rp-notes">{rel.notes}</div>}
        </div>
    );
}

export default function RelationPairRow({ pair, getCharName, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    const primary = relMeta(pair.types[0]);
    const toggle = () => setOpen(o => !o);
    return (
        <div className="cyber-card rp-card" style={{ borderLeft: `3px solid ${primary.color}` }}>
            <div className="rp-head" role="button" tabIndex={0} onClick={toggle}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                aria-expanded={open}>
                <GenerativeAvatar name={pair.a.name} size={24} />
                <span className="ec-text-13 ec-ellipsis ec-font-500">{pair.a.name}</span>
                <span className="rp-link">↔</span>
                <GenerativeAvatar name={pair.b.name} size={24} />
                <span className="ec-text-13 ec-ellipsis ec-font-500">{pair.b.name}</span>
                <div className="rp-types">
                    {pair.types.map(t => {
                        const m = relMeta(t);
                        return <span key={t} className="rp-badge" style={{ '--badge-bg': `${m.color}1a`, '--badge-color': m.color }}>{m.label}</span>;
                    })}
                </div>
                {pair.compound && <span className="rp-compound">复合 · {pair.edges.length} 条</span>}
                <span className="rp-caret">{open ? '▾' : '▸'}</span>
            </div>
            {open && (
                <div className="rp-edges">
                    {pair.edges.map(e => <EdgeDetail key={e.id} rel={e} getCharName={getCharName} />)}
                </div>
            )}
        </div>
    );
}
