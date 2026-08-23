const RULE_SECTION_KEYS = ['povRule', 'dialogueRule', 'behaviorRule', 'toneRule', 'reviewFocus', 'constraintOverrides'];

const RULE_SECTIONS = [
    { key: 'povRule', label: '📐 视角规则' },
    { key: 'dialogueRule', label: '💬 对话规则' },
    { key: 'behaviorRule', label: '🧸 行为规则' },
    { key: 'toneRule', label: '📝 文风规则' },
    { key: 'reviewFocus', label: '🔍 审核清单' },
    { key: 'constraintOverrides', label: '🔒 关联约束', format: (val) => val ? val.join(', ') : null },
];

export default function ProfileList({ profiles, selectedProfile, setSelectedProfile, currentProject, applying, applyProfileToProject }) {
    if (profiles.length === 0) {
        return <div className="cyber-card cyber-empty"><div className="cyber-empty-icon">🎨</div><div>暂无风格配置</div></div>;
    }

    return (
        <div className="grid-auto-360">
            {profiles.map(p => {
                const name = p.label || p.name || p.key || p.id;
                const desc = p.description || p.desc || '';
                const ruleSections = RULE_SECTIONS
                    .map(s => ({ ...s, val: s.format ? s.format(p[s.key]) : p[s.key] }))
                    .filter(s => s.val);
                const extraRules = Object.entries(p.rules || {}).filter(([k]) => !RULE_SECTION_KEYS.includes(k));
                return (
                    <ProfileCard key={p.id} profile={p} name={name} desc={desc}
                        ruleSections={ruleSections} extraRules={extraRules}
                        isSelected={selectedProfile?.id === p.id}
                        onSelect={() => setSelectedProfile(selectedProfile?.id === p.id ? null : p)}
                        currentProject={currentProject} applying={applying}
                        applyProfileToProject={applyProfileToProject}
                    />
                );
            })}
        </div>
    );
}

function ProfileCard({ profile, name, desc, ruleSections, extraRules, isSelected, onSelect, currentProject, applying, applyProfileToProject }) {
    return (
        <div className="cyber-card cursor-pointer" onClick={onSelect}
            style={{ borderLeft: isSelected ? '3px solid var(--neon-purple)' : '3px solid transparent' }}>
            <div className="flex-between mb-6">
                <h4 className="text-md font-semibold" style={{ margin: 0 }}>{name}</h4>
                <div className="flex gap-4 items-center">
                    {currentProject?.id && (
                        <button className="cyber-btn cyber-btn-sm cyber-btn-primary text-sm" disabled={applying}
                            onClick={e => { e.stopPropagation(); applyProfileToProject(profile.key); }}>应用到项目</button>
                    )}
                    <span className="cyber-badge cyber-badge-purple">{profile.key}</span>
                </div>
            </div>
            {desc && <div className="text-sm lh-1-5 mb-6 text-secondary">{desc}</div>}
            {profile.constraintOverrides && (
                <div className="flex gap-4 flex-wrap mb-6">
                    {profile.constraintOverrides.slice(0, 5).map((co, i) => <span key={i} className="cyber-tag text-sm">{co}</span>)}
                    {profile.constraintOverrides.length > 5 && <span className="cyber-tag text-sm">+{profile.constraintOverrides.length - 5}</span>}
                </div>
            )}
            {isSelected && ruleSections.length > 0 && (
                <div className="mt-8">
                    {ruleSections.map(section => (
                        <RuleSection key={section.key} label={section.label} value={section.val} />
                    ))}
                    {extraRules.map(([key, val]) => (
                        <RuleSection key={key} label={key} value={val} />
                    ))}
                </div>
            )}
        </div>
    );
}

function RuleSection({ label, value }) {
    return (
        <div className="mb-8">
            <div className="text-sm font-semibold text-purple mb-4">{label}</div>
            <div className="p-8 rounded text-sm pre-wrap lh-1-5 max-h-120 overflow-auto" style={{ background: 'var(--bg-secondary)' }}>
                {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            </div>
        </div>
    );
}
