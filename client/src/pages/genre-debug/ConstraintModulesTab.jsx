import { SCOPE_COLORS, AGENT_TYPE_LABELS } from './constants';
import c from './common.module.css';
import m from './modules.module.css';
import a from './agents.module.css';

export default function ConstraintModulesTab({ modulesData, isLoading, isError, error, expandedModule, onToggleModule }) {
    const modules = modulesData?.modules || [];
    const agentMap = modulesData?.agentMap || {};

    return (
        <div>
            {isLoading && <div className={c.loadingCenter}><span className="cyber-loading"></span> 加载约束模块...</div>}
            {!isLoading && isError && (
                <div className={c.errorCenter}>加载失败: {error?.response?.data?.error || error?.message}</div>
            )}
            {!isLoading && !isError && (
                <>
                    <div className={`${c.warningBanner} ${c.bannerCyan}`}>
                        🧩 <strong>约束模块系统</strong>——每个约束独立成模块，各Agent按需声明。题材插件可通过 skipConstraints 跳过特定模块、通过 additionalRules 追加题材特有规则。
                        共 {modules.length} 个模块，{Object.keys(agentMap).length} 个Agent类型。
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <div className={c.listTitle} style={{ color: 'var(--neon-cyan)', marginBottom: 10 }}>
                            🤖 Agent → 模块映射
                        </div>
                        {Object.entries(agentMap).map(([agentType, moduleIds]) => (
                            <div key={agentType} className={m.moduleAgentRow}>
                                <span className={m.moduleAgentName}>
                                    {AGENT_TYPE_LABELS[agentType] || agentType}
                                </span>
                                <span className={m.moduleAgentCount}>({moduleIds.length}个)</span>
                                {moduleIds.map(id => {
                                    const mod = modules.find(mItem => mItem.id === id);
                                    const scopeInfo = SCOPE_COLORS[mod?.scope] || SCOPE_COLORS['universal'];
                                    return (
                                        <span
                                            key={id}
                                            className="cyber-badge"
                                            style={{ fontSize: 9, background: scopeInfo.bg, color: scopeInfo.color, cursor: 'pointer' }}
                                            onClick={() => onToggleModule(id === expandedModule ? null : id)}
                                        >
                                            {mod?.label || id}
                                        </span>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    <div className={c.listTitle} style={{ color: 'var(--neon-purple)', marginBottom: 10 }}>
                        🧩 全部约束模块 ({modules.length})
                    </div>
                    {modules.map(mod => {
                        const scopeInfo = SCOPE_COLORS[mod.scope] || SCOPE_COLORS['universal'];
                        const isExpanded = expandedModule === mod.id;
                        const usedByAgents = Object.entries(agentMap)
                            .filter(([, ids]) => ids.includes(mod.id))
                            .map(([type]) => AGENT_TYPE_LABELS[type] || type);

                        return (
                            <div
                                key={mod.id}
                                className={`${c.cardItem} ${m.moduleCard}`}
                                style={{ borderLeft: `3px solid ${scopeInfo.color}` }}
                                onClick={() => onToggleModule(isExpanded ? null : mod.id)}
                            >
                                <div className={m.moduleHeader}>
                                    <div className={m.moduleInfo}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{mod.label}</span>
                                        <span className="cyber-badge" style={{ fontSize: 9, background: scopeInfo.bg, color: scopeInfo.color }}>{scopeInfo.label}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{mod.charCount}字</span>
                                    </div>
                                    <div className={m.moduleRight}>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>使用: {usedByAgents.length}个Agent</span>
                                        <span className={`${a.agentArrow} ${isExpanded ? a.agentArrowExpanded : ''}`}>▶</span>
                                    </div>
                                </div>
                                {usedByAgents.length > 0 && (
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                                        {usedByAgents.join(' · ')}
                                    </div>
                                )}
                                {isExpanded && (
                                    <div className={m.moduleExpandArea} onClick={e => e.stopPropagation()}>
                                        <div className={m.moduleId}>ID: <code style={{ color: 'var(--neon-cyan)' }}>{mod.id}</code></div>
                                        <pre className={m.modulePre}>{mod.text || '(内容需从API获取)'}</pre>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
}
