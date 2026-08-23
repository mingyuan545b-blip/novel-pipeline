export default function StyleGuideCard({ dragHandleProps, currentProject,
    styleSuggestion, setStyleSuggestion, analyzingStyle, handleAnalyzeStyle, handleClearStyleGuidance }) {
    return (
        <div className="cyber-card">
            <div className="card-header" {...dragHandleProps}>
                <div className="card-title-row">
                    <span className="drag-handle">⋮⋮</span>
                    <h3 className="card-title card-title-orange">🎯 风格指导</h3>
                </div>
            </div>
            {currentProject ? (
                <>
                    <div className="text-sm text-muted mb-8">输入修改建议，AI分析已有章节并生成定向改善指导，后续章节自动遵循</div>
                    <textarea className="cyber-input w-full mb-8" rows={3} value={styleSuggestion}
                        onChange={e => setStyleSuggestion(e.target.value)}
                        placeholder="如：对话太生硬、节奏偏慢、打斗描写不够燃、主角太圣母..."
                        style={{ fontSize: 12 }} />
                    <button className="cyber-btn cyber-btn-sm cyber-btn-primary" disabled={analyzingStyle}
                        onClick={handleAnalyzeStyle}>
                        {analyzingStyle ? '🔍 AI分析中...' : '🔍 AI分析并生成指导'}
                    </button>
                    {currentProject?.styleGuidance && (
                        <div className="style-guidance-box">{currentProject.styleGuidance}</div>
                    )}
                    {currentProject?.styleGuidance && (
                        <button className="cyber-btn cyber-btn-sm cyber-btn-danger mt-4"
                            style={{ fontSize: 10 }} onClick={handleClearStyleGuidance}>清除指导</button>
                    )}
                </>
            ) : (
                <div className="text-sm text-muted">请先选择产品</div>
            )}
        </div>
    );
}
