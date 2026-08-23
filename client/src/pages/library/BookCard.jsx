import { SLOT_LABELS } from './useLibraryState';

export function TreeNode({ label, icon, color, count, expanded, onToggle, children, depth = 0 }) {
    return (
        <div style={{ marginLeft: depth * 16 }}>
            <div
                onClick={onToggle}
                className="flex gap-8 items-center p-8 cursor-pointer rounded no-select"
                style={{ background: expanded ? 'var(--bg-secondary)' : 'transparent', fontSize: 13, fontWeight: 600 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = expanded ? 'var(--bg-secondary)' : 'transparent'}
            >
                <span className="tree-toggle-icon" style={{ fontSize: 10, transition: 'transform 0.2s', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block', width: 12, textAlign: 'center' }}>▼</span>
                {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
                <span className="flex-1" style={{ color }}>{label}</span>
                {count !== undefined && (
                    <span className="text-sm text-secondary" style={{ background: 'var(--bg-secondary)', padding: '1px 7px', borderRadius: 10, minWidth: 24, textAlign: 'center' }}>{count}</span>
                )}
            </div>
            {expanded && <div>{children}</div>}
        </div>
    );
}

export function TechLeaf({ tech, selected, onClick }) {
    const meta = tech._meta;
    const disabled = meta?.auto_disabled;
    return (
        <div
            onClick={onClick}
            className="flex gap-8 items-center cursor-pointer rounded"
            style={{ padding: '5px 10px 5px 28px', fontSize: 13, background: selected ? 'var(--accent-primary)22' : 'transparent', borderLeft: selected ? '3px solid var(--accent-primary)' : '3px solid transparent', opacity: disabled ? 0.5 : 1 }}
            onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
            onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
        >
            <span style={{ fontSize: 12 }}>📖</span>
            <span className="flex-1">{tech.display_name}</span>
            {disabled && <span className="text-xs text-red" style={{ background: 'rgba(255,71,87,0.1)', padding: '1px 6px', borderRadius: 4 }}>禁用</span>}
            <span className="text-sm text-muted">{SLOT_LABELS[tech.context_slot] || ''}</span>
        </div>
    );
}
