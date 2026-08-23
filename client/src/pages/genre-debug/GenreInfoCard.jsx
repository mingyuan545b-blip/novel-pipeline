import s from './layout.module.css';

function TagGroup({ label, labelClass, items, badgeStyle }) {
    if (!items?.length) return null;
    return (
        <div className={s.tagGroup}>
            <span className={`${s.tagLabel} ${labelClass}`}>{label}</span>{' '}
            {items.map((t, i) => (
                <span key={i} className="cyber-badge" style={{ fontSize: 10, ...badgeStyle, marginRight: 4 }}>{t}</span>
            ))}
        </div>
    );
}

export default function GenreInfoCard({ genreInfo, selectedGenreId, agents, materialFocus, requiredConstraints, incompatibleConstraints }) {
    if (!genreInfo) return null;

    return (
        <div className={`cyber-card ${s.infoCard}`}>
            <div className={s.infoHeader}>
                <div>
                    <h3 className={s.infoTitle}>{genreInfo.label || genreInfo.name || selectedGenreId}</h3>
                    <div className={s.infoMeta}>
                        ID: {selectedGenreId} {genreInfo.mode ? `· 模式: ${genreInfo.mode}` : ''}
                    </div>
                </div>
                <span className="cyber-badge cyber-badge-blue">{agents.length} 个Agent</span>
            </div>
            {genreInfo.description && <div className={s.infoDesc}>{genreInfo.description}</div>}
            <div className={s.infoTags}>
                <TagGroup
                    label="主要素材:" labelClass={s.tagLabelGreen}
                    items={materialFocus.primary}
                    badgeStyle={{ background: 'rgba(0,255,100,0.1)', color: 'var(--neon-green)' }}
                />
                <TagGroup
                    label="跳过素材:" labelClass={s.tagLabelOrange}
                    items={materialFocus.skip}
                    badgeStyle={{ background: 'rgba(255,165,0,0.1)', color: 'var(--neon-orange)' }}
                />
            </div>
            {(requiredConstraints.length > 0 || incompatibleConstraints.length > 0) && (
                <div className={s.infoTags} style={{ marginTop: 8 }}>
                    <TagGroup
                        label="🔒 必须约束:" labelClass={s.tagLabelGreen}
                        items={requiredConstraints}
                        badgeStyle={{ background: 'rgba(0,255,100,0.1)', color: 'var(--neon-green)' }}
                    />
                    <TagGroup
                        label="🚫 移除约束:" labelClass={s.tagLabelRed}
                        items={incompatibleConstraints}
                        badgeStyle={{ background: 'rgba(255,0,60,0.1)', color: 'var(--neon-red)' }}
                    />
                </div>
            )}
        </div>
    );
}
