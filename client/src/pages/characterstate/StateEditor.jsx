import { ROLE_COLORS, ROLE_LABELS, ROLE_ICONS } from './characterStateConstants';

export default function StateEditor({ charactersData, selectedCharacter, setSelectedCharacter, meta: _meta }) {
    if (!charactersData?.characters?.length) {
        return (
            <div className="cyber-card cyber-empty">
                <div className="cyber-empty-icon">👤</div>
                <div>暂无角色状态数据。请先运行 Pipeline 的 material-manager 步骤生成数据。</div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex gap-8 mb-12">
                {['protagonist', 'supporting', 'npc'].map(level => {
                    const count = (charactersData?.characters || []).filter(c => c.roleLevel === level).length;
                    return (
                        <div key={level} className="flex-1 text-center rounded p-8" style={{ background: 'var(--bg-secondary)', borderLeft: `3px solid ${ROLE_COLORS[level]}` }}>
                            <div className="text-lg">{ROLE_ICONS[level]}</div>
                            <div className="text-sm text-muted">{ROLE_LABELS[level]}</div>
                            <div className="text-xl font-bold" style={{ color: ROLE_COLORS[level] }}>{count}</div>
                        </div>
                    );
                })}
            </div>
            <div className="grid-auto-380">
                {charactersData.characters.map(char => (
                    <div key={char.entityKey} className="cyber-card cursor-pointer"
                        style={{ borderLeft: `3px solid ${char.roleColor || ROLE_COLORS[char.roleLevel] || 'var(--border-color)'}`, transition: 'transform 0.15s' }}
                        onClick={() => setSelectedCharacter(selectedCharacter === char.entityKey ? null : char.entityKey)}>
                        <div className="flex-between flex-start mb-8">
                            <div className="flex-1">
                                <div className="flex items-center gap-6 mb-4">
                                    <span className="text-sm">{char.roleIcon || ROLE_ICONS[char.roleLevel]}</span>
                                    <h3 className="text-md font-semibold" style={{ margin: 0, color: char.isHot ? 'var(--neon-orange)' : 'var(--text-primary)' }}>
                                        {char.isHot && <span className="text-sm mr-4">🔥</span>}{char.name}
                                    </h3>
                                    <span className="text-sm rounded" style={{ padding: '2px 8px', borderRadius: 10, background: `${char.roleColor || ROLE_COLORS[char.roleLevel]}15`, color: char.roleColor || ROLE_COLORS[char.roleLevel], border: `1px solid ${char.roleColor || ROLE_COLORS[char.roleLevel]}40` }}>
                                        {char.roleLabel || ROLE_LABELS[char.roleLevel]}
                                    </span>
                                </div>
                                <div className="text-sm text-muted">第{char.chapterUpdated}章更新 · {char.importantFields?.length || 0} 项状态</div>
                            </div>
                        </div>
                        {char.importantFields?.length > 0 && (
                            <div className="grid-2 text-sm" style={{ gap: 4 }}>
                                {char.importantFields.map(f => (
                                    <div key={f.key} className="flex-between rounded p-4" style={{ background: 'var(--bg-secondary)' }}>
                                        <span className="text-muted">{f.label}</span>
                                        <span className="text-primary font-semibold">{String(f.value)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {selectedCharacter === char.entityKey && char.stateValues && (
                            <div className="mt-10 p-8 rounded" style={{ background: 'rgba(0,0,0,0.3)', borderLeft: '3px solid var(--neon-purple)' }}>
                                <div className="text-sm font-semibold text-purple mb-6">全部状态字段</div>
                                {Object.entries(char.stateValues).map(([key, field]) => (
                                    <div key={key} className="text-sm flex-between" style={{ padding: '2px 0' }}>
                                        <span className="text-muted">{field.label || key}</span>
                                        <span className="text-secondary font-mono">{String(field.value)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
