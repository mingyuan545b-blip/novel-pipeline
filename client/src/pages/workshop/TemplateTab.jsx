import s from './workshop.module.css';
import t from './template.module.css';

const TEMPLATE_SPEC = `{
  "version": "1.0",
  "project": {
    "name": "项目名称",
    "description": "项目描述",
    "genre": "题材类型",
    "mode": "novel|shuangwen|tomato-short",
    "targetChapters": 100
  },
  "constraints": ["no-derailment", "character-consistency", ...],
  "newConstraintPresets": [
    { "id": "自定义约束ID", "label": "约束名", "desc": "约束描述", "rules": "规则内容" }
  ],
  "styleProfile": {
    "key": "风格key",
    "label": "风格名",
    "povRule": "视角规则",
    "dialogueRule": "对话规则",
    "behaviorRule": "行为规则",
    "toneRule": "文风规则",
    "reviewFocus": "审核清单"
  },
  "agentTemplates": [
    { "agentType": "writer", "mode": "novel", "role": "执笔人", "system": "系统提示词" }
  ],
  "agentOverrides": { "writer": "项目级覆盖提示词" },
  "materials": [
    { "type": "character", "name": "角色名", "content": "角色描述" }
  ],
  "chapters": [
    { "chapterNumber": 1, "title": "章节标题", "outline": "章节大纲" }
  ],
  "quests": [{ "name": "任务名", "type": "main", "description": "描述" }],
  "timelines": [{ "name": "时间线名", "events": [] }],
  "mapNodes": [{ "name": "地点名", "type": "location" }]
}`;

function ValidationPanel({ validationResult, templateState, setTemplateState, loading, onImport }) {
    if (!validationResult) return null;

    return (
        <div style={{ marginBottom: 16 }}>
            <div className={t.validationHeader}>
                <span className={`cyber-badge ${validationResult.valid ? 'cyber-badge-green' : 'cyber-badge-red'}`}>
                    {validationResult.valid ? '✓ 校验通过' : '✗ 校验失败'}
                </span>
            </div>

            {validationResult.errors?.length > 0 && (
                <div className={s.errorList}>
                    {validationResult.errors.map((e, i) => (
                        <div key={i} className={s.errorItem}>✗ {e}</div>
                    ))}
                </div>
            )}

            {validationResult.warnings?.length > 0 && (
                <div className={s.warnList}>
                    {validationResult.warnings.map((w, i) => (
                        <div key={i} className={s.warnItem}>⚠ {w}</div>
                    ))}
                </div>
            )}

            {validationResult.summary && (
                <div className={t.summaryGrid}>
                    {Object.entries(validationResult.summary).map(([key, val]) => (
                        <div key={key} className={t.summaryItem}>
                            <span className={t.summaryKey}>{key}</span>
                            <span className={t.summaryValue}>
                                {typeof val === 'boolean' ? (val ? '✓' : '✗') : val}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {validationResult.valid && (
                <div className={t.importActions}>
                    <label className={s.checkboxLabel}>
                        <input type="checkbox" checked={templateState.overwrite}
                            onChange={e => setTemplateState(prev => ({ ...prev, overwrite: e.target.checked }))} />
                        覆盖已有数据
                    </label>
                    <button className="cyber-btn cyber-btn-primary" disabled={loading} onClick={onImport}>
                        {loading ? '导入中...' : '⬡ 导入范本并创建项目'}
                    </button>
                </div>
            )}
        </div>
    );
}

function ImportResultPanel({ importResult }) {
    if (!importResult) return null;
    const hasErrors = importResult.errors?.length > 0;

    return (
        <div className={hasErrors ? t.importResultError : t.importResultSuccess}>
            {hasErrors ? (
                importResult.errors.map((e, i) => <div key={i} className={s.errorItem}>✗ {e}</div>)
            ) : (
                <>
                    <div className={t.successTitle}>✓ 范本导入成功！</div>
                    <div className={s.infoText}>项目ID: {importResult.projectId?.substring(0, 8)}...</div>
                    <div className={t.badgeRow}>
                        {Object.entries(importResult.created || {}).map(([key, count]) => (
                            <span key={key} className="cyber-badge cyber-badge-green">{key}: {count}</span>
                        ))}
                    </div>
                    {Object.keys(importResult.skipped || {}).length > 0 && (
                        <div className={t.skippedInfo}>
                            跳过: {Object.entries(importResult.skipped).map(([k, v]) => `${k}(${v})`).join(', ')}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function TemplateTab({
    currentProject,
    loading,
    templateState,
    setTemplateState,
    templateFileRef,
    handleTemplateValidate,
    handleTemplateImport,
    handleExportTemplate
}) {
    return (
        <div>
            <div className="cyber-section-title">范本导入</div>
            <div className={`cyber-card ${s.cardSpacing}`}>
                <p className={s.description}>
                    上传标准范本JSON文件，系统会自动校验完整性并一键创建可运行的项目。范本包含：项目配置、约束预设、风格配置、Agent模板、素材、章节大纲等全部数据。
                </p>

                <div className="form-group">
                    <label className="form-label">上传范本文件（.json）</label>
                    <input
                        ref={templateFileRef}
                        type="file"
                        accept=".json"
                        onChange={e => handleTemplateValidate(e.target.files?.[0])}
                        className={s.fileInput}
                    />
                </div>

                <ValidationPanel
                    validationResult={templateState.validationResult}
                    templateState={templateState}
                    setTemplateState={setTemplateState}
                    loading={loading}
                    onImport={handleTemplateImport}
                />

                <ImportResultPanel importResult={templateState.importResult} />
            </div>

            <div className="cyber-section-title">范本导出</div>
            <div className="cyber-card">
                <p className={s.description}>
                    将当前项目的全部配置和数据导出为标准范本JSON文件，可用于备份或分享给其他项目。
                </p>
                {!currentProject ? (
                    <div className={s.warningBox}>请先选择一个项目</div>
                ) : (
                    <button className="cyber-btn cyber-btn-primary" disabled={loading} onClick={handleExportTemplate}>
                        ⬡ 导出「{currentProject.name}」为范本
                    </button>
                )}
            </div>

            <div className={s.sectionSpacing}>
                <div className="cyber-section-title">范本格式规范</div>
                <div className="cyber-card">
                    <div className={s.codeBlock}>{TEMPLATE_SPEC}</div>
                </div>
            </div>
        </div>
    );
}
