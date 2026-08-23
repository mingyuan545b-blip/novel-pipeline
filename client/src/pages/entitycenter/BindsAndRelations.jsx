import { MASTERY_MAP, REL_TYPE_COLORS, REL_TYPE_LABELS } from './constants';

function BindsSection({ charBinds }) {
    return (
        <div className="cyber-card ec-border-orange">
            <h4 className="ec-section-title ec-color-orange">
                <span aria-hidden="true">⚔</span> 绑定物
                <span className="ec-count-badge">({charBinds.length})</span>
            </h4>
            {!charBinds.length ? (
                <div className="ec-text-12 ec-text-muted">暂无绑定物</div>
            ) : (
                <div className="ec-flex-col ec-gap-6">
                    {charBinds.map(b => {
                        const mastery = MASTERY_MAP[b.masteryLevel] ?? (b.masteryProgress || 0);
                        return (
                            <div key={b.id} className="ec-bind-item">
                                <div className="ec-flex ec-justify-between ec-items-center ec-mb-4">
                                    <span className="ec-text-13 ec-font-500">{b.customName || b.defId}</span>
                                    <div className="ec-flex ec-gap-4">
                                        {b.bindType && <span className="ec-badge ec-badge-cyan">{b.bindType}</span>}
                                        {b.bindStatus && <span className="ec-badge ec-badge-green">{b.bindStatus}</span>}
                                    </div>
                                </div>
                                {b.masteryLevel && (
                                    <div className="ec-flex ec-items-center ec-gap-8">
                                        <span className="ec-text-11 ec-text-muted ec-shrink-0">{b.masteryLevel}</span>
                                        <div className="ec-bar-track ec-flex-1"><div className="ec-bar-fill" style={{ width: `${mastery}%`, background: mastery >= 85 ? '#ffd700' : mastery >= 60 ? 'var(--neon-purple)' : 'var(--neon-cyan)' }} /></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function RelationsSection({ charRelations, getCharName }) {
    return (
        <div className="cyber-card ec-border-pink">
            <h4 className="ec-section-title ec-color-pink">
                <span aria-hidden="true">🔗</span> 关系
                <span className="ec-count-badge">({charRelations.length})</span>
            </h4>
            {!charRelations.length ? (
                <div className="ec-text-12 ec-text-muted">暂无关系数据</div>
            ) : (
                <div className="ec-flex-col ec-gap-6">
                    {charRelations.map(r => {
                        const relColor = REL_TYPE_COLORS[r.relType] || '#888';
                        return (
                            <div key={r.id} className="ec-rel-item">
                                <div className="ec-flex ec-justify-between ec-items-center ec-mb-4">
                                    <span className="ec-text-13 ec-ellipsis ec-font-500">
                                        {getCharName(r._adapted?.toCharacterId || r.toCharacterId)}
                                    </span>
                                    <div className="ec-flex ec-gap-4 ec-shrink-0">
                                        <span className="ec-badge ec-badge-dynamic" style={{ '--badge-bg': `${relColor}15`, '--badge-color': relColor }}>
                                            {REL_TYPE_LABELS[r.relType] || r.relType}
                                        </span>
                                        {r.relLabel && <span className="ec-badge ec-badge-muted">{r.relLabel}</span>}
                                    </div>
                                </div>
                                <div className="ec-bar-track"><div className="ec-bar-fill" style={{ width: `${r.strength || 50}%`, background: `linear-gradient(90deg, #888, ${relColor})` }} /></div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export { BindsSection, RelationsSection };
