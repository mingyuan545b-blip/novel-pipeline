import s from './guide.module.css';

const ROLE_ICONS = { writer: '✍', 'first-review': '✓', 'second-review': '★', 'final-editor': '♛' };

export function QuickStartTab({ data }) {
    if (!data.steps) return null;
    return (
        <div>
            <h3 className={s.tabSectionTitle}>{data.title || '快速开始'}</h3>
            {data.steps.map(step => (
                <div key={step.step} className="guide-step">
                    <div className="guide-step-number">{step.step}</div>
                    <div className="guide-step-content">
                        <div className="guide-step-title">{step.title}</div>
                        <div className={`${s.stepDesc} guide-step-desc`}>{step.description}</div>
                        {step.page && <a href={step.page} className="text-sm mt-6" style={{ display: 'inline-block' }}>前往此页面 →</a>}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function TemplateGuideTab({ data }) {
    if (!data.inputs) return null;
    return (
        <div>
            <h3 className={s.tabSectionTitleSm}>{data.title || '模板一键生成'}</h3>
            <p className="text-md text-secondary mb-20">{data.description || ''}</p>
            <div className="cyber-grid cyber-grid-2 mb-20">
                <div className="cyber-card">
                    <h4 className="text-md font-semibold text-blue mb-12">📥 输入项</h4>
                    {data.inputs.map(inp => (
                        <div key={inp.name} className={s.inputCard}>
                            <div className="flex gap-6 items-center mb-4">
                                <span className="font-semibold text-base">{inp.name}</span>
                                {inp.required ? <span className="cyber-badge cyber-badge-red" style={{ fontSize: 9 }}>必填</span> : <span className="cyber-badge" style={{ fontSize: 9, background: 'rgba(255,255,255,0.05)' }}>可选</span>}
                            </div>
                            <div className="text-sm text-secondary">{inp.description}</div>
                            {inp.options && <div className="flex gap-4 flex-wrap mt-4">{inp.options.map(o => <span key={o} className="cyber-tag">{o}</span>)}</div>}
                        </div>
                    ))}
                </div>
                <div className="cyber-card">
                    <h4 className="text-md font-semibold text-green mb-12">📤 AI自动生成</h4>
                    {(data.outputs || []).map(out => (
                        <div key={out.type} className={s.outputCard}>
                            <div className="flex gap-6 items-center mb-4"><span className="font-semibold text-base">{out.type}</span><span className="cyber-badge cyber-badge-green" style={{ fontSize: 9 }}>{out.count}</span></div>
                            <div className="flex gap-4 flex-wrap">{(out.items || []).map(item => <span key={item} className="cyber-tag">{item}</span>)}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function StyleTemplateGuideTab({ data }) {
    if (!data.concepts) return null;
    return (
        <div>
            <h3 className={s.tabSectionTitleSm}>{data.title || '写作风格模板'}</h3>
            <p className="text-md text-secondary mb-20">{data.description || ''}</p>
            {data.concepts.map((concept, idx) => (
                <div key={idx} className={`cyber-card ${s.conceptCard}`}>
                    <h4 className="text-md font-semibold text-orange mb-8">{concept.name}</h4>
                    <div className="text-base text-secondary lh-1-8 pre-wrap">{concept.description}</div>
                </div>
            ))}
            <div className={`cyber-card ${s.conceptCard}`}>
                <h4 className="text-md font-semibold text-blue mb-12">使用流程</h4>
                {(data.workflow || []).map(w => (
                    <div key={w.step} className="guide-step"><div className="guide-step-number">{w.step}</div><div className="guide-step-content"><div className="guide-step-title">{w.action}</div><div className="guide-step-desc">{w.description}</div></div></div>
                ))}
            </div>
            <div className="cyber-card">
                <h4 className="text-md font-semibold text-pink mb-12">风格模板JSON格式参考</h4>
                <div className={s.codeBlock}>{`{\n  "name": "风格名称",\n  "description": "风格描述",\n  "rules": {\n    "sentenceStyle": "句式风格（具体到长度、节奏）",\n    "paragraphStyle": "段落风格（长度、结构）",\n    "dialogueStyle": "对话风格（比例、表达）",\n    "descriptionStyle": "描写风格（侧重、手法）",\n    "emotionStyle": "情感表达（内敛/外放）",\n    "pacing": "节奏控制（快慢分布）",\n    "vocabulary": "词汇风格（常用词、修辞）",\n    "forbidden": ["禁止写法1", "禁止写法2"]\n  },\n  "example": "风格示例文字（few-shot）"\n}`}</div>
            </div>
        </div>
    );
}

export function PipelineFlowTab({ data }) {
    if (!data.flow) return null;
    return (
        <div>
            <h3 className={s.tabSectionTitle}>{data.title || '流水线执行流程'}</h3>
            <div className="cyber-card mb-20">
                <div className="flex-col gap-0">
                    {data.flow.map((item, idx) => (
                        <div key={idx} className={s.flowStep}>
                            <div className={s.flowStepNumber}>
                                <div className={s.flowStepDot}>{idx + 1}</div>
                                {idx < data.flow.length - 1 && <div className={s.flowStepLine} />}
                            </div>
                            <div className={s.flowStepContent}>
                                <div className="flex gap-8 items-center mb-4"><span className="font-semibold text-md">{item.step}</span><span className="cyber-badge cyber-badge-pink">{item.agent}</span></div>
                                <div className="text-base text-secondary">{item.description}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="cyber-card">
                <h4 className="text-md font-semibold text-orange mb-12">循环机制说明</h4>
                <div className="text-base text-secondary lh-1-8">
                    <p>每章执行一轮完整流水线（执笔人→初审→复审→定稿→素材更新）。</p>
                    <p>如果定稿人未通过，则回到执笔人重新创作（携带审核反馈），直到通过或达到最大轮次。</p>
                    <p>通过后素材管理员更新素材库，然后进入下一章。</p>
                </div>
            </div>
        </div>
    );
}

export function ComicGuideTab({ data }) {
    if (!data.steps) return null;
    return (
        <div>
            <h3 className={s.tabSectionTitleSm}>{data.title || '漫剧模块操作指南'}</h3>
            <p className="text-md text-secondary mb-20">{data.description || ''}</p>
            {data.steps.map(step => (
                <div key={step.step} className="guide-step"><div className="guide-step-number">{step.step}</div><div className="guide-step-content"><div className="guide-step-title">{step.title}</div><div className={`${s.stepDesc} guide-step-desc`}>{step.description}</div>{step.page && <a href={step.page} className="text-sm mt-6" style={{ display: 'inline-block' }}>前往此页面 →</a>}</div></div>
            ))}
            {data.tips?.length > 0 && (
                <div className="mt-20"><h4 className="text-md font-semibold text-orange mb-12">💡 实用技巧</h4>{data.tips.map((tip, idx) => (
                    <div key={idx} className={`cyber-card ${s.tipCard}`}><div className="font-semibold text-md mb-4">{tip.title}</div><div className="text-base text-secondary pre-wrap lh-1-6">{tip.description}</div></div>
                ))}</div>
            )}
        </div>
    );
}

export function AgentRolesTab({ data }) {
    if (!data.roles) return null;
    return (
        <div>
            <h3 className={s.tabSectionTitle}>{data.title || 'Agent角色说明'}</h3>
            <div className="cyber-grid cyber-grid-2">
                {data.roles.map(role => (
                    <div key={role.type} className="cyber-card">
                        <div className="flex gap-12 items-center mb-12">
                            <div className={s.roleIcon}>{ROLE_ICONS[role.type] || '⬡'}</div>
                            <div><div className="font-bold text-lg">{role.name}</div><div className="flex gap-4"><span className="cyber-badge cyber-badge-purple">{role.type}</span>{role.styleAware && <span className="cyber-badge cyber-badge-blue">风格感知</span>}</div></div>
                        </div>
                        <div className="text-base text-secondary mb-10">{role.description}</div>
                        <div className="text-sm"><div className="text-muted mb-4"><strong>输入:</strong> {role.input}</div><div className="text-muted"><strong>输出:</strong> {role.output}</div></div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function AipyProGuideTab({ data }) {
    if (!data.steps) return null;
    return (
        <div>
            <h3 className={s.tabSectionTitleSm}>{data.title || 'AiPy Pro 操作指南'}</h3>
            <p className="text-md text-secondary mb-16">{data.description || ''}</p>
            {data.steps.map(step => (
                <div key={step.step} className="guide-step"><div className="guide-step-number">{step.step}</div><div className="guide-step-content"><div className="guide-step-title">{step.title}</div><div className={`${s.stepDesc} guide-step-desc`}>{step.description}</div></div></div>
            ))}
        </div>
    );
}
