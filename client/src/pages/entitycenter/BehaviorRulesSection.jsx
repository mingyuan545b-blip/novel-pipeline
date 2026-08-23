function BehaviorRulesSection({ behaviorRules }) {
    if (!behaviorRules) {
        return (
            <div className="cyber-card ec-border-green">
                <h4 className="ec-section-title ec-color-green">
                    <span aria-hidden="true">🎯</span> 行为约束
                    <span className="ec-badge ec-badge-muted ec-ml-8">未定义</span>
                </h4>
                <div className="ec-text-12 ec-text-muted">
                    行为约束是执笔和审核agent的统一标准源，定义后所有agent自动加载
                </div>
            </div>
        );
    }

    const lines = behaviorRules.split('\n').filter(l => l.trim());
    if (lines.length === 0) {
        return (
            <div className="cyber-card ec-border-green">
                <h4 className="ec-section-title ec-color-green">
                    <span aria-hidden="true">🎯</span> 行为约束
                    <span className="ec-badge ec-badge-muted ec-ml-8">空</span>
                </h4>
                <div className="ec-text-12 ec-text-muted">行为约束内容为空</div>
            </div>
        );
    }

    return (
        <div className="cyber-card ec-border-green">
            <h4 className="ec-section-title ec-color-green">
                <span aria-hidden="true">🎯</span> 行为约束
                <span className="ec-count-badge">({behaviorRules.length}字)</span>
                <span className="ec-badge ec-badge-green ec-ml-8" title="此约束已加载到执笔和审核agent的system prompt中">统一标准源</span>
            </h4>
            <div className="ec-behavior-source-hint">
                此约束由题材插件定义，通过styleInjector注入到writer/reviser/reviewer/final-editor的system prompt中，前端可见=后端已加载
            </div>
            <div className="ec-behavior-rules">
                {lines.map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    const isHeader = trimmed.startsWith('【') || trimmed.startsWith('┌') || trimmed.startsWith('└');
                    const isRule = trimmed.startsWith('│') || trimmed.startsWith('✗');
                    const isCore = trimmed.startsWith('核心原则');
                    return (
                        <div key={i} className={`ec-behavior-line ${isHeader ? 'ec-behavior-header' : ''} ${isRule ? 'ec-behavior-rule' : ''} ${isCore ? 'ec-behavior-core' : ''}`}>
                            {trimmed}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export { BehaviorRulesSection };
