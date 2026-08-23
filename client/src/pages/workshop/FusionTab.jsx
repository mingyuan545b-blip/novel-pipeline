import s from './workshop.module.css';

export default function FusionTab({
    loading,
    loadingStep,
    fusionState,
    setFusionState,
    handleFuseText,
    handleFuseFiles,
    addFusionNovel,
    removeFusionNovel,
    updateFusionNovel
}) {
    const updateField = (field, value) => {
        setFusionState(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div>
            <div className="cyber-section-title">小说融合分析</div>
            <div className={`cyber-card ${s.cardSpacing}`}>
                <p className={s.description}>
                    上传或粘贴2本以上的小说文本，系统会提炼出写作手法（叙事、节奏、人物塑造等）和写作元素（世界观模板、人物原型、情节模式等），
                    并生成融合分析方案，帮你创造出新的写作思路。
                </p>

                <div className="form-group">
                    <label className="form-label">小说文本（至少2本）</label>
                    {fusionState.novels.map((novel, index) => (
                        <div key={index} className={s.novelEntry}>
                            <div className={s.novelHeader}>
                                <span className={s.novelLabel}>小说 {index + 1}</span>
                                {fusionState.novels.length > 2 && (
                                    <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-red)' }}
                                        onClick={() => removeFusionNovel(index)}>删除</button>
                                )}
                            </div>
                            <textarea
                                className={`cyber-textarea ${s.monoTextSm}`}
                                value={novel}
                                onChange={e => updateFusionNovel(index, e.target.value)}
                                rows={6}
                                placeholder={`粘贴第${index + 1}本小说的文本内容...`}
                            />
                        </div>
                    ))}
                    <button className="cyber-btn cyber-btn-sm" onClick={addFusionNovel}>
                        + 添加小说
                    </button>
                </div>

                <div className="form-group">
                    <label className="form-label">上传小说文件（至少2个，支持 .txt .md）</label>
                    <input
                        type="file"
                        multiple
                        accept=".txt,.md,.text"
                        onChange={e => updateField('files', Array.from(e.target.files))}
                        className={s.fileInput}
                    />
                    {fusionState.files.length > 0 && (
                        <div className={s.fileSelected}>
                            已选择: {fusionState.files.map(f => f.name).join(', ')}
                        </div>
                    )}
                </div>

                <div className={s.checkboxRow}>
                    <label className={s.checkboxLabel}>
                        <input type="checkbox" checked={fusionState.extractTechniques}
                            onChange={e => updateField('extractTechniques', e.target.checked)} />
                        提炼写作手法
                    </label>
                    <label className={s.checkboxLabel}>
                        <input type="checkbox" checked={fusionState.extractElements}
                            onChange={e => updateField('extractElements', e.target.checked)} />
                        提炼写作元素
                    </label>
                    <label className={s.checkboxLabel}>
                        <input type="checkbox" checked={fusionState.fusionAnalysis}
                            onChange={e => updateField('fusionAnalysis', e.target.checked)} />
                        融合分析
                    </label>
                </div>

                <div className={s.buttonRow}>
                    <button className="cyber-btn cyber-btn-primary" onClick={handleFuseText}
                        disabled={loading || fusionState.novels.filter(n => n.trim()).length < 2}>
                        {loading ? <><span className="cyber-loading"></span> {loadingStep || '分析中'}</> : '◈ 从文本分析'}
                    </button>
                    <button className="cyber-btn" onClick={handleFuseFiles}
                        disabled={loading || fusionState.files.length < 2}>
                        {loading ? <><span className="cyber-loading"></span> 处理中</> : '◈ 从文件分析'}
                    </button>
                </div>
            </div>
        </div>
    );
}
