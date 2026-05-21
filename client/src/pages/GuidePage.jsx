import { useState, useEffect } from 'react';
import { guideApi } from '../services/api';

export default function GuidePage() {
    const [activeTab, setActiveTab] = useState('quickStart');
    const [guideData, setGuideData] = useState(null);

    useEffect(() => {
        guideApi.getAll().then(res => setGuideData(res.data)).catch(console.error);
    }, []);

    const tabs = [
        { key: 'quickStart', label: '🚀 快速开始' },
        { key: 'templateGuide', label: '📋 模板生成' },
        { key: 'styleTemplateGuide', label: '🎨 风格模板' },
        { key: 'pipelineFlow', label: '⚙ 流水线流程' },
        { key: 'comicGuide', label: '🎬 漫剧指南' },
        { key: 'agentRoles', label: '🤖 Agent角色' }
    ];

    if (!guideData) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>加载中...</div>;

    const quickStart = guideData.quickStart || {};
    const templateGuide = guideData.templateGuide || {};
    const styleGuide = guideData.styleTemplateGuide || {};
    const pipelineFlow = guideData.pipelineFlow || {};
    const comicGuide = guideData.comicGuide || {};
    const agentRoles = guideData.agentRoles || {};
    const aipyProGuide = guideData.aipyProGuide || {};

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">操作指南</h1>
                <p className="page-subtitle">完整的使用指南 - 从配置到生产全流程</p>
            </div>

            <div className="cyber-tabs" style={{ flexWrap: 'wrap' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`cyber-tab ${activeTab === tab.key ? 'cyber-tab-active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'quickStart' && quickStart.steps && (
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--neon-blue)' }}>
                        {quickStart.title || '快速开始'}
                    </h3>
                    {quickStart.steps.map(step => (
                        <div key={step.step} className="guide-step">
                            <div className="guide-step-number">{step.step}</div>
                            <div className="guide-step-content">
                                <div className="guide-step-title">{step.title}</div>
                                <div className="guide-step-desc" style={{ whiteSpace: 'pre-wrap' }}>{step.description}</div>
                                {step.page && <a href={step.page} style={{ fontSize: 12, marginTop: 6, display: 'inline-block' }}>前往此页面 →</a>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'templateGuide' && templateGuide.inputs && (
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--neon-blue)' }}>
                        {templateGuide.title || '模板一键生成'}
                    </h3>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                        {templateGuide.description || ''}
                    </p>
                    <div className="cyber-grid cyber-grid-2" style={{ marginBottom: 24 }}>
                        <div className="cyber-card">
                            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--neon-blue)', marginBottom: 12 }}>📥 输入项</h4>
                            {templateGuide.inputs.map(inp => (
                                <div key={inp.name} style={{ marginBottom: 10, padding: '8px 10px', background: 'rgba(0,240,255,0.03)', borderRadius: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{inp.name}</span>
                                        {inp.required && <span className="cyber-badge cyber-badge-red" style={{ fontSize: 9 }}>必填</span>}
                                        {!inp.required && <span className="cyber-badge" style={{ fontSize: 9, background: 'rgba(255,255,255,0.05)' }}>可选</span>}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{inp.description}</div>
                                    {inp.options && (
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                            {inp.options.map(o => <span key={o} className="cyber-tag">{o}</span>)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="cyber-card">
                            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--neon-green)', marginBottom: 12 }}>📤 AI自动生成</h4>
                            {(templateGuide.outputs || []).map(out => (
                                <div key={out.type} style={{ marginBottom: 12, padding: '8px 10px', background: 'rgba(0,255,100,0.03)', borderRadius: 4, borderLeft: '3px solid var(--neon-green)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{out.type}</span>
                                        <span className="cyber-badge cyber-badge-green" style={{ fontSize: 9 }}>{out.count}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {(out.items || []).map(item => <span key={item} className="cyber-tag">{item}</span>)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'styleTemplateGuide' && styleGuide.concepts && (
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--neon-blue)' }}>
                        {styleGuide.title || '写作风格模板'}
                    </h3>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                        {styleGuide.description || ''}
                    </p>
                    {styleGuide.concepts.map((concept, idx) => (
                        <div key={idx} className="cyber-card" style={{ marginBottom: 16 }}>
                            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--neon-orange)', marginBottom: 8 }}>{concept.name}</h4>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{concept.description}</div>
                        </div>
                    ))}
                    <div className="cyber-card" style={{ marginBottom: 16 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--neon-blue)', marginBottom: 12 }}>使用流程</h4>
                        {(styleGuide.workflow || []).map(w => (
                            <div key={w.step} className="guide-step">
                                <div className="guide-step-number">{w.step}</div>
                                <div className="guide-step-content">
                                    <div className="guide-step-title">{w.action}</div>
                                    <div className="guide-step-desc">{w.description}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="cyber-card">
                        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--neon-pink)', marginBottom: 12 }}>风格模板JSON格式参考</h4>
                        <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: 16, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.8, color: 'var(--text-secondary)', overflow: 'auto' }}>
{`{
  "name": "风格名称",
  "description": "风格描述",
  "rules": {
    "sentenceStyle": "句式风格（具体到长度、节奏）",
    "paragraphStyle": "段落风格（长度、结构）",
    "dialogueStyle": "对话风格（比例、表达）",
    "descriptionStyle": "描写风格（侧重、手法）",
    "emotionStyle": "情感表达（内敛/外放）",
    "pacing": "节奏控制（快慢分布）",
    "vocabulary": "词汇风格（常用词、修辞）",
    "forbidden": ["禁止写法1", "禁止写法2"]
  },
  "example": "风格示例文字（few-shot）"
}`}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'pipelineFlow' && pipelineFlow.flow && (
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--neon-blue)' }}>
                        {pipelineFlow.title || '流水线执行流程'}
                    </h3>
                    <div className="cyber-card" style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {pipelineFlow.flow.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'stretch' }}>
                                    <div style={{ width: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16 }}>
                                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#000', flexShrink: 0 }}>{idx + 1}</div>
                                        {idx < pipelineFlow.flow.length - 1 && <div style={{ width: 2, flex: 1, background: 'linear-gradient(180deg, var(--neon-blue), var(--neon-purple))', opacity: 0.3, minHeight: 30 }} />}
                                    </div>
                                    <div style={{ flex: 1, padding: '12px 16px', marginBottom: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <span style={{ fontWeight: 600, fontSize: 14 }}>{item.step}</span>
                                            <span className="cyber-badge cyber-badge-pink">{item.agent}</span>
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="cyber-card">
                        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--neon-orange)', marginBottom: 12 }}>循环机制说明</h4>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                            <p>每章执行一轮完整流水线（执笔人→初审→复审→定稿→素材更新）。</p>
                            <p>如果定稿人未通过，则回到执笔人重新创作（携带审核反馈），直到通过或达到最大轮次。</p>
                            <p>通过后素材管理员更新素材库，然后进入下一章。</p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'comicGuide' && comicGuide.steps && (
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--neon-blue)' }}>
                        {comicGuide.title || '漫剧模块操作指南'}
                    </h3>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                        {comicGuide.description || ''}
                    </p>
                    {comicGuide.steps.map(step => (
                        <div key={step.step} className="guide-step">
                            <div className="guide-step-number">{step.step}</div>
                            <div className="guide-step-content">
                                <div className="guide-step-title">{step.title}</div>
                                <div className="guide-step-desc" style={{ whiteSpace: 'pre-wrap' }}>{step.description}</div>
                                {step.page && <a href={step.page} style={{ fontSize: 12, marginTop: 6, display: 'inline-block' }}>前往此页面 →</a>}
                            </div>
                        </div>
                    ))}
                    {comicGuide.tips && comicGuide.tips.length > 0 && (
                        <div style={{ marginTop: 24 }}>
                            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--neon-orange)', marginBottom: 12 }}>💡 实用技巧</h4>
                            {comicGuide.tips.map((tip, idx) => (
                                <div key={idx} className="cyber-card" style={{ marginBottom: 12, borderLeft: '3px solid var(--neon-orange)' }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{tip.title}</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{tip.description}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'agentRoles' && agentRoles.roles && (
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--neon-blue)' }}>
                        {agentRoles.title || 'Agent角色说明'}
                    </h3>
                    <div className="cyber-grid cyber-grid-2">
                        {agentRoles.roles.map(role => (
                            <div key={role.type} className="cyber-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                                        {role.type === 'writer' ? '✍' : role.type === 'first-review' ? '✓' : role.type === 'second-review' ? '★' : role.type === 'final-editor' ? '♛' : '⬡'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 16 }}>{role.name}</div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <span className="cyber-badge cyber-badge-purple">{role.type}</span>
                                            {role.styleAware && <span className="cyber-badge cyber-badge-blue">风格感知</span>}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>{role.description}</div>
                                <div style={{ fontSize: 12 }}>
                                    <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}><strong>输入:</strong> {role.input}</div>
                                    <div style={{ color: 'var(--text-muted)' }}><strong>输出:</strong> {role.output}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'aipyProGuide' && aipyProGuide.steps && (
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--neon-blue)' }}>
                        {aipyProGuide.title || 'AiPy Pro 操作指南'}
                    </h3>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>{aipyProGuide.description || ''}</p>
                    {aipyProGuide.steps.map(step => (
                        <div key={step.step} className="guide-step">
                            <div className="guide-step-number">{step.step}</div>
                            <div className="guide-step-content">
                                <div className="guide-step-title">{step.title}</div>
                                <div className="guide-step-desc" style={{ whiteSpace: 'pre-wrap' }}>{step.description}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
