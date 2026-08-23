import s from './workshop.module.css';
import { MAX_TEXT_LENGTH } from './constants';

export default function ImportTab({
    currentProject,
    loading,
    loadingStep,
    importState,
    setImportState,
    handleImportText,
    handleImportFiles
}) {
    const updateField = (field, value) => {
        setImportState(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div>
            <div className="cyber-section-title">世界观设定导入</div>
            <div className={`cyber-card ${s.cardSpacing}`}>
                <p className={s.description}>
                    粘贴或上传世界观设定文档，系统会自动分析设定内容，生成完整的素材库（人物、装备、势力、战力体系等）和章节大纲。
                    支持直接粘贴文本或上传 .txt/.md 文件。
                </p>

                {!currentProject && (
                    <div className={s.warningBox}>请先在仪表盘选择一个项目</div>
                )}

                <div className="form-group">
                    <label className="form-label">设定文本</label>
                    <textarea
                        className={`cyber-textarea ${s.monoText}`}
                        value={importState.settingText}
                        onChange={e => updateField('settingText', e.target.value)}
                        rows={12}
                        placeholder="在此粘贴世界观设定、人物设定、装备体系、势力分布等文档内容..."
                    />
                    <div className={s.charCount}>
                        当前字数: {importState.settingText.length} / {MAX_TEXT_LENGTH}（超出部分将自动截断）
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">上传设定文件（支持 .txt .md，可多选）</label>
                    <input
                        type="file"
                        multiple
                        accept=".txt,.md,.text"
                        onChange={e => updateField('files', Array.from(e.target.files))}
                        className={s.fileInput}
                    />
                    {importState.files.length > 0 && (
                        <div className={s.fileSelected}>
                            已选择: {importState.files.map(f => f.name).join(', ')}
                        </div>
                    )}
                </div>

                <div className={s.checkboxRow}>
                    <label className={s.checkboxLabel}>
                        <input type="checkbox" checked={importState.generateMaterials}
                            onChange={e => updateField('generateMaterials', e.target.checked)} />
                        生成素材库
                    </label>
                    <label className={s.checkboxLabel}>
                        <input type="checkbox" checked={importState.generateOutlines}
                            onChange={e => updateField('generateOutlines', e.target.checked)} />
                        生成章节大纲
                    </label>
                    <div className={s.chapterCountGroup}>
                        <label className={`form-label ${s.noMargin}`}>章节数:</label>
                        <input className={`cyber-input ${s.narrowInput}`} type="number" value={importState.chapterCount}
                            onChange={e => updateField('chapterCount', parseInt(e.target.value) || 10)}
                            min={1} max={100} />
                    </div>
                </div>

                <div className={s.tipBox}>
                    提示：如果同时生成素材库和大纲超时，可以先只勾选"生成素材库"，生成完成后再只勾选"生成章节大纲"分步执行。
                </div>

                <div className={s.buttonRow}>
                    <button className="cyber-btn cyber-btn-primary" onClick={handleImportText}
                        disabled={loading || !currentProject || !importState.settingText.trim()}>
                        {loading ? <><span className="cyber-loading"></span> {loadingStep || '分析生成中'}</> : '◈ 从文本生成'}
                    </button>
                    <button className="cyber-btn" onClick={handleImportFiles}
                        disabled={loading || !currentProject || (importState.files.length === 0 && !importState.settingText.trim())}>
                        {loading ? <><span className="cyber-loading"></span> 处理中</> : '◈ 从文件生成'}
                    </button>
                </div>
            </div>
        </div>
    );
}
