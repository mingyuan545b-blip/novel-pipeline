import { ROLE_COLORS } from './constants';

const TRAIT_FIELDS = [
    { key: 'position', label: '身份', icon: '💼' },
    { key: 'factionName', label: '阵营', icon: '🏛' },
    { key: 'locationSlot', label: '所在位置', icon: '📍' },
    { key: 'personality', label: '性格', icon: '🎭' },
    { key: 'speakingTone', label: '语气', icon: '💬' },
    { key: 'signatureDetail', label: '标志', icon: '✨' },
    { key: 'craftStyle', label: '风格', icon: '🎨' },
    { key: 'charisma', label: '人格魅力', icon: '🔥' },
    { key: 'philosophy', label: '哲学观', icon: '🧠' },
    { key: 'entranceDesign', label: '出场设计', icon: '🎬' },
];

const PROFILE_FIELDS = [
    { key: 'appearance', label: '外貌', icon: '👁' },
    { key: 'background', label: '背景', icon: '📜' },
    { key: 'motivation', label: '动机', icon: '🎯' },
];

function TraitTag({ label, value, color }) {
    if (!value) return null;
    return (
        <div className="ec-trait-tag" style={{ '--tag-accent': color || 'var(--neon-cyan)' }}>
            <span className="ec-trait-label">{label}</span>
            <span className="ec-trait-value">{value}</span>
        </div>
    );
}

function QuotesList({ quotes }) {
    return (
        <ul className="ec-quote-list">
            {quotes.map((q, idx) => {
                const qq = typeof q === 'string' ? { quote: q } : q;
                return (
                    <li key={idx} className="ec-quote-item">
                        <span className="ec-quote-scene">【{qq.scene || '通用场景'}】</span>
                        <span className="ec-quote-text">{qq.quote}</span>
                        {qq.why && <span className="ec-quote-why">↳ {qq.why}</span>}
                    </li>
                );
            })}
        </ul>
    );
}

function QuoteLibrarySection({ quotes, roleColor }) {
    if (!Array.isArray(quotes) || quotes.length === 0) return null;
    return (
        <div className="ec-quote-section">
            <div className="ec-quote-title" style={{ color: roleColor }}>
                <span aria-hidden="true">💬</span> 金句库 ({quotes.length})
            </div>
            <QuotesList quotes={quotes} />
        </div>
    );
}

function HighlightScenesSection({ highlights, roleColor }) {
    if (!Array.isArray(highlights) || highlights.length === 0) return null;
    return (
        <div className="ec-quote-section">
            <div className="ec-quote-title" style={{ color: roleColor }}>
                <span aria-hidden="true">✨</span> 高光时刻 ({highlights.length})
            </div>
            <ul className="ec-quote-list">
                {highlights.map((h, idx) => (
                    <li key={idx} className="ec-quote-item">
                        <span className="ec-quote-scene">【{h.scene || '名场面'}】</span>
                        <span className="ec-quote-text">{h.what}</span>
                        {h.why && <span className="ec-quote-why">↳ {h.why}</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function CharacterTraits({ adapted }) {
    if (!adapted) return null;

    const roleColor = ROLE_COLORS[adapted.roleLevel] || '#888';
    const hasTraits = TRAIT_FIELDS.some(f => adapted[f.key]);
    const profile = adapted.profile || {};
    const hasProfile = PROFILE_FIELDS.some(f => profile[f.key]);
    const hasQuotes = Array.isArray(adapted.quoteLibrary) && adapted.quoteLibrary.length > 0;
    const hasHighlights = Array.isArray(adapted.highlightScenes) && adapted.highlightScenes.length > 0;
    const hasSource = adapted.sourceContent && adapted.sourceContent.length > 10;

    if (!hasTraits && !hasProfile && !hasQuotes && !hasHighlights && !hasSource) {
        return (
            <div className="cyber-card ec-border-purple">
                <h4 className="ec-section-title ec-color-purple">
                    <span aria-hidden="true">🎭</span> 人设特征
                </h4>
                <div className="ec-text-12 ec-text-muted">暂无人设数据，Pipeline生成素材后自动填充</div>
            </div>
        );
    }

    return (
        <div className="cyber-card ec-border-purple">
            <h4 className="ec-section-title ec-color-purple">
                <span aria-hidden="true">🎭</span> 人设特征
            </h4>
            {hasTraits && (
                <div className="ec-traits-grid">
                    {TRAIT_FIELDS.map(f => (
                        <TraitTag key={f.key} label={`${f.icon} ${f.label}`} value={adapted[f.key]} color={roleColor} />
                    ))}
                </div>
            )}
            {hasProfile && (
                <div className="ec-profile-section">
                    {PROFILE_FIELDS.map(f => profile[f.key] ? (
                        <div key={f.key} className="ec-profile-item">
                            <span className="ec-profile-label">{f.icon} {f.label}</span>
                            <span className="ec-profile-value">{profile[f.key]}</span>
                        </div>
                    ) : null)}
                </div>
            )}
            {hasQuotes && <QuoteLibrarySection quotes={adapted.quoteLibrary} roleColor={roleColor} />}
            {hasHighlights && <HighlightScenesSection highlights={adapted.highlightScenes} roleColor={roleColor} />}
            {hasSource && (
                <details className="ec-source-details">
                    <summary className="ec-source-summary">素材原文 ({adapted.sourceContent.length}字)</summary>
                    <div className="ec-source-content">{adapted.sourceContent}</div>
                </details>
            )}
        </div>
    );
}

export { TraitTag, QuoteLibrarySection, HighlightScenesSection, QuotesList, TRAIT_FIELDS, PROFILE_FIELDS };
