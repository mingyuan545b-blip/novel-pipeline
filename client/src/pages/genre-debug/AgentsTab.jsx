import { useState } from 'react';
import { DETAIL_LABELS } from './constants';
import s from './agents.module.css';
import c from './common.module.css';

function PromptSection({ label, color, content, length }) {
    const [expanded, setExpanded] = useState(false);
    const showExpandBtn = !expanded && content && content.length > 500;

    return (
        <div style={{ marginBottom: 8 }}>
            <div
                className={s.promptSectionHeader}
                style={{ color }}
                onClick={() => setExpanded(prev => !prev)}
            >
                <span className={`${s.promptSectionArrow} ${expanded ? s.promptSectionArrowExpanded : ''}`}>▶</span>
                {label}
                {length != null && <span className={s.promptSectionLength}> ({length || 0} 字符)</span>}
            </div>
            <pre className={`${s.promptSectionPre} ${expanded ? s.promptSectionPreExpanded : s.promptSectionPreCollapsed}`}>
                {content}
            </pre>
            {showExpandBtn && (
                <div className={s.promptExpandAll} style={{ color }} onClick={() => setExpanded(true)}>
                    展开全部 ({content.length} 字符)
                </div>
            )}
        </div>
    );
}

export default function AgentsTab({ agents, expandedAgent, onToggle, promptQuery }) {
    if (agents.length === 0) {
        return <div className={`${c.cardItem} ${c.loadingCenter}`}>该题材下暂无Agent配置</div>;
    }

    return (
        <div>
            {agents.map(agent => {
                const agentType = agent.type || agent.agentType;
                const isExpanded = expandedAgent === agentType;
                const color = agent.color || 'var(--neon-blue)';
                const icon = agent.icon || '⚙';
                const needs = agent.needs || [];
                const detailLevel = agent.detail || 'index';
                const loadedTypes = agent.loadedTypes || [];
                const skippedTypes = agent.skippedTypes || [];

                return (
                    <div
                        key={agentType}
                        className={`cyber-card ${s.agentCard}`}
                        style={{ borderLeft: `3px solid ${color}` }}
                        onClick={() => onToggle(agentType)}
                    >
                        <div className={s.agentHeader}>
                            <div className={s.agentInfo}>
                                <div className={s.agentIcon} style={{ border: `1px solid ${color}`, color, background: `${color}11` }}>
                                    {icon}
                                </div>
                                <div>
                                    <div className={s.agentName}>{agent.name || agentType}</div>
                                    <div className={s.agentMeta}>
                                        {agentType} · 详情级别: <span style={{ color: 'var(--neon-cyan)' }}>{DETAIL_LABELS[detailLevel] || detailLevel}</span>
                                        {' · '}<span style={{ color: 'var(--neon-green)' }}>加载{loadedTypes.length}</span>
                                        {skippedTypes.length > 0 && <span style={{ color: 'var(--neon-orange)' }}> · 跳过{skippedTypes.length}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className={`${s.agentArrow} ${isExpanded ? s.agentArrowExpanded : ''}`}>▶</div>
                        </div>

                        <div className={s.agentNeeds}>
                            {needs.map((need, i) => {
                                const isSkipped = skippedTypes.includes(need);
                                return (
                                    <span key={i} className="cyber-badge" style={{
                                        fontSize: 10,
                                        background: isSkipped ? 'rgba(255,165,0,0.1)' : 'rgba(0,200,255,0.1)',
                                        color: isSkipped ? 'var(--neon-orange)' : 'var(--neon-cyan)',
                                        textDecoration: isSkipped ? 'line-through' : 'none',
                                    }}>
                                        {isSkipped ? '⏭' : '📎'} {need}
                                    </span>
                                );
                            })}
                        </div>

                        {isExpanded && (
                            <div className={s.agentExpandArea} onClick={e => e.stopPropagation()}>
                                <div className={s.promptHeader}>
                                    <div className={s.promptTitle}>📝 提示词预览</div>
                                    {promptQuery.data?.totalLength != null && (
                                        <div className={s.promptLength}>总长度: {promptQuery.data.totalLength} 字符</div>
                                    )}
                                </div>
                                {promptQuery.isLoading && (
                                    <div className={c.loadingCenter}><span className="cyber-loading"></span> 加载提示词...</div>
                                )}
                                {!promptQuery.isLoading && promptQuery.isError && (
                                    <div className={c.errorCenter}>加载失败: {promptQuery.error?.response?.data?.error || promptQuery.error?.message || '未知错误'}</div>
                                )}
                                {!promptQuery.isLoading && !promptQuery.isError && promptQuery.data && (
                                    <>
                                        <PromptSection label="📐 基础提示词 (Foundation)" color="var(--neon-blue)" content={promptQuery.data.foundation || ''} length={promptQuery.data.foundationLength} />
                                        <PromptSection label="🔒 约束注入 (Constraints)" color="var(--neon-purple)" content={promptQuery.data.constraints || ''} length={promptQuery.data.constraintLength} />
                                        <PromptSection label="🎨 题材注入 (Genre Style)" color="var(--neon-orange)" content={promptQuery.data.genreInjection || ''} length={promptQuery.data.genreInjectionLength} />
                                        <PromptSection label="📄 完整提示词预览 (Full Preview)" color="var(--neon-cyan)" content={promptQuery.data.fullPreview || ''} length={promptQuery.data.totalLength} />
                                        {!promptQuery.data.foundation && !promptQuery.data.constraints && !promptQuery.data.genreInjection && (
                                            <div className={c.loadingCenter}>无提示词数据</div>
                                        )}
                                    </>
                                )}
                                {!promptQuery.isLoading && !promptQuery.isError && !promptQuery.data && (
                                    <div className={c.loadingCenter}>点击加载提示词</div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
