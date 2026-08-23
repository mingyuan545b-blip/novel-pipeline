import { AGENT_ICONS, AGENT_COLORS } from './agentConstants';

export default function AgentCard({ agent, isSelected, onClick }) {
    return (
        <div className="agent-card" onClick={onClick}
            style={isSelected ? { borderColor: AGENT_COLORS[agent.type] } : {}}>
            <div className="agent-card-header">
                <div className="agent-card-icon" style={{ color: agent.color || AGENT_COLORS[agent.type], borderColor: agent.color || AGENT_COLORS[agent.type] }}>
                    {agent.icon || AGENT_ICONS[agent.type] || '?'}
                </div>
                <div>
                    <div className="agent-card-name">{agent.name || agent.role}</div>
                    <div className="agent-card-role">{agent.type} · {agent.category || agent.mode}</div>
                </div>
            </div>
            <div className="agent-card-desc">
                {agent.systemPrompt ? agent.systemPrompt.substring(0, 100) + '...' : '暂无提示词'}
            </div>
            <div className="flex gap-6 flex-wrap mt-10">
                <span className="cyber-badge cyber-badge-blue">{agent.tool}</span>
                {agent.hasCustomTemplate && <span className="cyber-badge" style={{ background: 'rgba(0,200,255,0.1)', color: 'var(--neon-cyan)' }}>已自定义</span>}
                {agent.source === 'fallback' && <span className="cyber-badge" style={{ background: 'rgba(255,165,0,0.1)', color: 'var(--neon-orange)' }}>默认</span>}
            </div>
        </div>
    );
}
