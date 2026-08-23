/* eslint-disable react-refresh/only-export-components */
import { GenerativeAvatar, RadialProgress } from './UiComponents';
import { ROLE_COLORS, ROLE_LABELS } from './constants';

const LIFECYCLE_LABELS = {
    active: { label: '活跃', color: '#00ff88', icon: '' },
    injured: { label: '受伤', color: '#ffaa00', icon: '🩹' },
    comatose: { label: '昏迷', color: '#ff6600', icon: '💤' },
    missing: { label: '失踪', color: '#888888', icon: '❓' },
    departed: { label: '离场', color: '#6666cc', icon: '🚪' },
    dead: { label: '死亡', color: '#ff0000', icon: '💀' },
    archived: { label: '归档', color: '#444444', icon: '📦' },
};

function RoleBadge({ roleColor, label }) {
    return (
        <span className="ec-badge ec-badge-dynamic" style={{ '--badge-bg': `${roleColor}15`, '--badge-color': roleColor, '--badge-border': `${roleColor}40` }}>
            {label}
        </span>
    );
}

function WorldScopeBadge({ primary, name, color, isVisitor }) {
    return (
        <span className="ec-badge ec-badge-worldscope">
            <span className="ec-badge-worldscope-dot" style={{ background: color || '#a29bfe' }} />
            {name || primary}
            {isVisitor && <span className="ec-badge-visitor-tag">穿越</span>}
        </span>
    );
}

function formatTime(isoStr) {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
}

function CharacterHeader({ adapted, roleColor }) {
    const lc = LIFECYCLE_LABELS[adapted?.lifecycleState] || LIFECYCLE_LABELS.active;
    const isNonActive = adapted?.lifecycleState && adapted.lifecycleState !== 'active';

    return (
        <div className="ec-char-header">
            <GenerativeAvatar name={adapted?.name || ''} size={56} />
            <div className="ec-char-header-info">
                <h3 className="ec-char-name">{adapted?.name || '未知'}</h3>
                <div className="ec-char-meta">
                    <RoleBadge roleColor={roleColor} label={ROLE_LABELS[adapted?.roleLevel] || 'NPC'} />
                    {isNonActive && (
                        <span className="ec-badge" style={{ background: `${lc.color}20`, color: lc.color, border: `1px solid ${lc.color}40` }}>
                            {lc.icon} {lc.label}
                        </span>
                    )}
                    {adapted?.worldScopePrimary && adapted.worldScopePrimary !== 'main-world' && (
                        <WorldScopeBadge primary={adapted.worldScopePrimary} name={adapted.worldScopeName} color={adapted.worldScopeColor} isVisitor={adapted.worldScopeIsVisitor} />
                    )}
                    {adapted?.position && <span className="ec-badge ec-badge-muted">{adapted.position}</span>}
                    {adapted?.appearCount !== undefined && (
                        <span className="ec-text-11 ec-text-muted ec-tabular">出场 {adapted.appearCount} 次</span>
                    )}
                </div>
                <div className="ec-char-time">
                    {adapted?.createdAt && <span className="ec-text-10 ec-text-muted">创建 {formatTime(adapted.createdAt)}</span>}
                    {adapted?.updatedAt && <span className="ec-text-10 ec-text-muted">更新 {formatTime(adapted.updatedAt)}</span>}
                </div>
            </div>
            {adapted?.appearCount !== undefined && (
                <RadialProgress value={Math.min(100, adapted.appearCount)} color={roleColor} />
            )}
        </div>
    );
}

export { CharacterHeader, RoleBadge, WorldScopeBadge, formatTime };
