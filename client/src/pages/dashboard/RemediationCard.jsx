export default function RemediationCard({ dragHandleProps, currentProject,
    reviewText, setReviewText, remediating, remediationResult, handleRemediate }) {
    return (
        <div className="cyber-card">
            <div className="card-header" {...dragHandleProps}>
                <div className="card-title-row">
                    <span className="drag-handle">⋮⋮</span>
                    <h3 className="card-title card-title-red">🔧 评测整改</h3>
                </div>
            </div>
            {currentProject ? (
                <>
                    <div className="text-sm text-muted mb-8">粘贴评测意见，AI自动分析问题并分发到：执笔人规则、审核标准、约束、素材、风格指导</div>
                    <textarea className="cyber-input w-full mb-8" rows={6} value={reviewText}
                        onChange={e => setReviewText(e.target.value)}
                        placeholder="粘贴评测意见...如：开头太烂没有冲突、章末没有钩子、没有爽点、人物扁平说话一个语气..."
                        style={{ fontSize: 12 }} />
                    <button className="cyber-btn cyber-btn-sm cyber-btn-primary"
                        disabled={remediating || !reviewText.trim()} onClick={handleRemediate}>
                        {remediating ? '🔧 AI分析整改中...' : '🔧 一键整改分发'}
                    </button>
                    {remediationResult && (
                        <div className="mt-8">
                            <div className="text-sm font-semibold text-green mb-4">✅ 整改完成</div>
                            {remediationResult.problems?.map((p, i) => (
                                <div key={i} className={p.severity === 'critical' ? 'remediation-problem-critical' : 'remediation-problem-warning'}>
                                    {p.severity === 'critical' ? '🔴' : '🟡'} {p.title}
                                </div>
                            ))}
                            <div className="text-sm font-semibold text-blue mt-6 mb-4">📋 整改执行记录</div>
                            {remediationResult.executionLog?.map((log, i) => (
                                <div key={i} className="text-xs p-4 mb-4"
                                    style={{ color: log.status === 'applied' ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                                    {log.status === 'applied' ? '✅' : '❌'} [{log.target}] {log.detail || log.action}
                                </div>
                            ))}
                        </div>
                    )}
                    {(currentProject?.writerPromptAdditions?.length > 0 || currentProject?.reviewPromptAdditions?.length > 0) && (
                        <div className="remediation-rules-panel">
                            <div className="text-sm font-semibold text-blue mb-4">当前整改规则</div>
                            {currentProject.writerPromptAdditions?.map((r, i) => (
                                <div key={`w${i}`} className="text-xs text-secondary mb-4">✍️ {r.rule}</div>
                            ))}
                            {currentProject.reviewPromptAdditions?.map((r, i) => (
                                <div key={`r${i}`} className="text-xs text-secondary mb-4">✓ {r.rule}</div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="text-sm text-muted">请先选择产品</div>
            )}
        </div>
    );
}
