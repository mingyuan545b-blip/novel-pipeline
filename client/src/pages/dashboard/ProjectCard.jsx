import { MODE_LABELS, SUBGENRE_LABELS } from './constants';

function formatCreatedAt(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch (_) { return ''; }
}

export default function ProjectCard({ project, isActive, onSelect, onDelete, onCleanup, variant }) {
    const modeInfo = MODE_LABELS[project.mode];
    const modeBadge = modeInfo
        ? <span className="mode-badge" style={{ color: modeInfo.color }}>{modeInfo.icon}{modeInfo.label}</span>
        : null;

    const subGenreBadge = project.subGenre
        ? <span className="subgenre-badge">{SUBGENRE_LABELS[project.subGenre] || project.subGenre}</span>
        : null;

    const seasonBadge = project.season
        ? <span className="season-badge">S{project.season}</span>
        : null;

    const createdAtText = formatCreatedAt(project.createdAt);

    if (variant === 'franchise-inner') {
        return (
            <div
                className={`cyber-card ${isActive ? 'cyber-card-glow' : ''} project-item-inner`}
                onClick={() => onSelect(project)}
            >
                <div>
                    <div className="font-semibold text-md">📖 {project.name}</div>
                    <div className="text-sm text-muted">第{project.franchiseSequence || '?'}部 · {project.targetChapters}章 · {project.status}{createdAtText ? ` · ${createdAtText}` : ''}</div>
                </div>
                <div className="flex gap-4">
                    <button className="cyber-btn cyber-btn-sm cleanup-btn" onClick={e => { e.stopPropagation(); onCleanup(project); }}>🧹 清理</button>
                    <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={e => onDelete(e, project.id)}>删除</button>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`cyber-card ${isActive ? 'cyber-card-glow' : ''} project-item`}
            onClick={() => onSelect(project)}
        >
            <div>
                <div className="font-semibold text-lg">{project.name}{modeBadge}{subGenreBadge}{seasonBadge}</div>
                <div className="text-sm text-muted">{project.genre || '未设定'} · 目标{project.targetChapters}章 · 状态: {project.status}{createdAtText ? ` · 创建: ${createdAtText}` : ''}</div>
            </div>
            <div className="flex gap-4">
                <button className="cyber-btn cyber-btn-sm cleanup-btn" onClick={e => { e.stopPropagation(); onCleanup(project); }}>🧹 清理</button>
                <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={e => onDelete(e, project.id)}>删除</button>
            </div>
        </div>
    );
}
