import { useState, useRef } from 'react';
import useAppStore from '../store/useAppStore';
import { workshopApi, materialsApi, chaptersApi } from '../services/api';

const TABS = [
    { key: 'import', label: '设定导入', icon: '◈', color: 'var(--neon-blue)' },
    { key: 'template', label: '范本导入/导出', icon: '⬡', color: 'var(--neon-purple)' },
    { key: 'fusion', label: '小说融合', icon: '⬡', color: 'var(--neon-pink)' }
];

export default function WorkshopPage() {
    const { currentProject, setMaterials, setChapters } = useAppStore();
    const [activeTab, setActiveTab] = useState('import');
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState('');
    const [result, setResult] = useState(null);

    const [importState, setImportState] = useState({
        settingText: '',
        files: [],
        generateMaterials: true,
        generateOutlines: true,
        chapterCount: 10
    });

    const [fusionState, setFusionState] = useState({
        novels: ['', ''],
        files: [],
        extractTechniques: true,
        extractElements: true,
        fusionAnalysis: true
    });

    const [templateState, setTemplateState] = useState({
        validationResult: null,
        importResult: null,
        overwrite: false
    });
    const templateFileRef = useRef(null);

    const refreshData = async () => {
        if (!currentProject) return;
        try {
            const matRes = await materialsApi.list({ projectId: currentProject.id });
            setMaterials(matRes.data || []);
            const chRes = await chaptersApi.list({ projectId: currentProject.id });
            setChapters(chRes.data || []);
        } catch (e) {
            console.error('Refresh data error:', e);
        }
    };

    const handleImportText = async () => {
        if (!currentProject) { alert('请先选择项目'); return; }
        if (!importState.settingText.trim()) { alert('请输入世界观设定文本'); return; }
        setLoading(true);
        setResult(null);

        try {
            if (importState.generateMaterials && importState.generateOutlines) {
                setLoadingStep('正在生成素材库和大纲...');
                const res = await workshopApi.importSettingText({
                    projectId: currentProject.id,
                    settingText: importState.settingText,
                    generateMaterials: true,
                    generateOutlines: true,
                    chapterCount: importState.chapterCount
                });
                setResult(res.data);
            } else if (importState.generateMaterials) {
                setLoadingStep('正在生成素材库...');
                const res = await workshopApi.generateMaterials({
                    projectId: currentProject.id,
                    settingText: importState.settingText
                });
                setResult({ materials: res.data });
            } else if (importState.generateOutlines) {
                setLoadingStep('正在生成章节大纲...');
                const res = await workshopApi.generateOutlines({
                    projectId: currentProject.id,
                    settingText: importState.settingText,
                    chapterCount: importState.chapterCount
                });
                setResult({ outlines: res.data });
            }
            await refreshData();
        } catch (e) {
            let errorMsg = e.message;
            if (e.response?.data?.error) errorMsg = e.response.data.error;
            if (errorMsg.includes('timeout') || errorMsg.includes('超时')) {
                errorMsg = 'AI请求超时，请尝试：1) 缩短设定文本 2) 只勾选"生成素材库"单独生成 3) 稍后重试';
            }
            setResult({ error: errorMsg });
        } finally {
            setLoading(false);
            setLoadingStep('');
        }
    };

    const handleImportFiles = async () => {
        if (!currentProject) { alert('请先选择项目'); return; }
        if (importState.files.length === 0 && !importState.settingText.trim()) { alert('请上传文件或输入文本'); return; }
        setLoading(true);
        setResult(null);
        setLoadingStep('正在处理文件并生成...');

        try {
            const formData = new FormData();
            formData.append('projectId', currentProject.id);
            formData.append('generateMaterials', importState.generateMaterials);
            formData.append('generateOutlines', importState.generateOutlines);
            formData.append('chapterCount', importState.chapterCount);
            if (importState.settingText.trim()) {
                formData.append('settingText', importState.settingText);
            }
            for (const file of importState.files) {
                formData.append('files', file);
            }
            const res = await workshopApi.importSettingFiles(formData);
            setResult(res.data);
            await refreshData();
        } catch (e) {
            let errorMsg = e.message;
            if (e.response?.data?.error) errorMsg = e.response.data.error;
            if (errorMsg.includes('timeout') || errorMsg.includes('超时')) {
                errorMsg = 'AI请求超时，请尝试缩短设定文本或分步生成';
            }
            setResult({ error: errorMsg });
        } finally {
            setLoading(false);
            setLoadingStep('');
        }
    };

    const handleFuseText = async () => {
        const validNovels = fusionState.novels.filter(n => n.trim());
        if (validNovels.length < 2) { alert('请至少输入2本小说文本'); return; }
        setLoading(true);
        setResult(null);
        setLoadingStep('正在分析小说...');

        try {
            const res = await workshopApi.fuseNovelsText({
                novels: validNovels,
                extractTechniques: fusionState.extractTechniques,
                extractElements: fusionState.extractElements,
                fusionAnalysis: fusionState.fusionAnalysis
            });
            setResult(res.data);
        } catch (e) {
            let errorMsg = e.message;
            if (e.response?.data?.error) errorMsg = e.response.data.error;
            if (errorMsg.includes('timeout') || errorMsg.includes('超时')) {
                errorMsg = 'AI请求超时，请尝试：1) 减少小说文本长度 2) 只勾选一项分析 3) 稍后重试';
            }
            setResult({ error: errorMsg });
        } finally {
            setLoading(false);
            setLoadingStep('');
        }
    };

    const handleFuseFiles = async () => {
        if (fusionState.files.length < 2) { alert('请至少上传2个小说文件'); return; }
        setLoading(true);
        setResult(null);
        setLoadingStep('正在处理文件并分析...');

        try {
            const formData = new FormData();
            formData.append('extractTechniques', fusionState.extractTechniques);
            formData.append('extractElements', fusionState.extractElements);
            formData.append('fusionAnalysis', fusionState.fusionAnalysis);
            for (const file of fusionState.files) {
                formData.append('files', file);
            }
            const res = await workshopApi.fuseNovelsFiles(formData);
            setResult(res.data);
        } catch (e) {
            let errorMsg = e.message;
            if (e.response?.data?.error) errorMsg = e.response.data.error;
            setResult({ error: errorMsg });
        } finally {
            setLoading(false);
            setLoadingStep('');
        }
    };

    const addFusionNovel = () => {
        setFusionState(prev => ({ ...prev, novels: [...prev.novels, ''] }));
    };

    const removeFusionNovel = (index) => {
        setFusionState(prev => ({
            ...prev,
            novels: prev.novels.filter((_, i) => i !== index)
        }));
    };

    const updateFusionNovel = (index, value) => {
        setFusionState(prev => ({
            ...prev,
            novels: prev.novels.map((n, i) => i === index ? value : n)
        }));
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">创作工坊</h1>
                <p className="page-subtitle">设定导入自动生成素材库 | 多本小说融合提炼写作手法与元素</p>
            </div>

            <div className="cyber-tabs" style={{ marginBottom: 24 }}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`cyber-tab ${activeTab === tab.key ? 'cyber-tab-active' : ''}`}
                        onClick={() => { setActiveTab(tab.key); setResult(null); }}
                        style={activeTab === tab.key ? { borderColor: tab.color, color: tab.color } : {}}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'import' && (
                <div>
                    <div className="cyber-section-title">世界观设定导入</div>
                    <div className="cyber-card" style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                            粘贴或上传世界观设定文档，系统会自动分析设定内容，生成完整的素材库（人物、装备、势力、战力体系等）和章节大纲。
                            支持直接粘贴文本或上传 .txt/.md 文件。
                        </p>

                        {!currentProject && (
                            <div style={{ padding: 16, background: 'rgba(255,0,68,0.1)', borderRadius: 8, marginBottom: 16, color: 'var(--neon-red)' }}>
                                请先在仪表盘选择一个项目
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">设定文本</label>
                            <textarea
                                className="cyber-textarea"
                                value={importState.settingText}
                                onChange={e => setImportState(prev => ({ ...prev, settingText: e.target.value }))}
                                rows={12}
                                placeholder="在此粘贴世界观设定、人物设定、装备体系、势力分布等文档内容..."
                                style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                            />
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                当前字数: {importState.settingText.length} / 20000（超出部分将自动截断）
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">上传设定文件（支持 .txt .md，可多选）</label>
                            <input
                                type="file"
                                multiple
                                accept=".txt,.md,.text"
                                onChange={e => setImportState(prev => ({ ...prev, files: Array.from(e.target.files) }))}
                                style={{ color: 'var(--text-secondary)', fontSize: 13 }}
                            />
                            {importState.files.length > 0 && (
                                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--neon-green)' }}>
                                    已选择: {importState.files.map(f => f.name).join(', ')}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
                                <input type="checkbox" checked={importState.generateMaterials}
                                    onChange={e => setImportState(prev => ({ ...prev, generateMaterials: e.target.checked }))} />
                                生成素材库
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
                                <input type="checkbox" checked={importState.generateOutlines}
                                    onChange={e => setImportState(prev => ({ ...prev, generateOutlines: e.target.checked }))} />
                                生成章节大纲
                            </label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <label className="form-label" style={{ margin: 0 }}>章节数:</label>
                                <input className="cyber-input" type="number" value={importState.chapterCount}
                                    onChange={e => setImportState(prev => ({ ...prev, chapterCount: parseInt(e.target.value) || 10 }))}
                                    min={1} max={100} style={{ width: 60 }} />
                            </div>
                        </div>

                        <div style={{ padding: 10, background: 'rgba(0,240,255,0.05)', borderRadius: 6, marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                            提示：如果同时生成素材库和大纲超时，可以先只勾选"生成素材库"，生成完成后再只勾选"生成章节大纲"分步执行。
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
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
            )}

            {activeTab === 'template' && (
                <div>
                    <div className="cyber-section-title">范本导入</div>
                    <div className="cyber-card" style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                            上传标准范本JSON文件，系统会自动校验完整性并一键创建可运行的项目。范本包含：项目配置、约束预设、风格配置、Agent模板、素材、章节大纲等全部数据。
                        </p>

                        <div className="form-group">
                            <label className="form-label">上传范本文件（.json）</label>
                            <input
                                ref={templateFileRef}
                                type="file"
                                accept=".json"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                        const text = await file.text();
                                        const template = JSON.parse(text);
                                        const res = await workshopApi.validateTemplate(template);
                                        setTemplateState(prev => ({ ...prev, validationResult: { ...res.data, template }, importResult: null }));
                                    } catch (err) {
                                        setTemplateState(prev => ({ ...prev, validationResult: { valid: false, errors: ['JSON解析失败: ' + err.message], warnings: [], summary: {} }, importResult: null }));
                                    }
                                }}
                                style={{ color: 'var(--text-secondary)', fontSize: 13 }}
                            />
                        </div>

                        {templateState.validationResult && (
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                    <span className={`cyber-badge ${templateState.validationResult.valid ? 'cyber-badge-green' : 'cyber-badge-red'}`}>
                                        {templateState.validationResult.valid ? '✓ 校验通过' : '✗ 校验失败'}
                                    </span>
                                </div>

                                {templateState.validationResult.errors?.length > 0 && (
                                    <div style={{ padding: '8px 12px', background: 'rgba(255,0,68,0.1)', borderRadius: 6, marginBottom: 8 }}>
                                        {templateState.validationResult.errors.map((e, i) => (
                                            <div key={i} style={{ fontSize: 12, color: 'var(--neon-red)', lineHeight: 1.8 }}>✗ {e}</div>
                                        ))}
                                    </div>
                                )}

                                {templateState.validationResult.warnings?.length > 0 && (
                                    <div style={{ padding: '8px 12px', background: 'rgba(255,165,0,0.1)', borderRadius: 6, marginBottom: 8 }}>
                                        {templateState.validationResult.warnings.map((w, i) => (
                                            <div key={i} style={{ fontSize: 12, color: 'var(--neon-orange)', lineHeight: 1.8 }}>⚠ {w}</div>
                                        ))}
                                    </div>
                                )}

                                {templateState.validationResult.summary && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
                                        {Object.entries(templateState.validationResult.summary).map(([key, val]) => (
                                            <div key={key} style={{ padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12 }}>
                                                <span style={{ color: 'var(--text-muted)' }}>{key}</span>
                                                <span style={{ float: 'right', color: 'var(--neon-blue)', fontWeight: 600 }}>
                                                    {typeof val === 'boolean' ? (val ? '✓' : '✗') : val}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {templateState.validationResult.valid && (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
                                            <input type="checkbox" checked={templateState.overwrite}
                                                onChange={e => setTemplateState(prev => ({ ...prev, overwrite: e.target.checked }))} />
                                            覆盖已有数据
                                        </label>
                                        <button className="cyber-btn cyber-btn-primary" disabled={loading}
                                            onClick={async () => {
                                                setLoading(true);
                                                try {
                                                    const res = await workshopApi.importTemplate(
                                                        templateState.validationResult.template,
                                                        { overwrite: templateState.overwrite }
                                                    );
                                                    setTemplateState(prev => ({ ...prev, importResult: res.data }));
                                                    await refreshData();
                                                } catch (err) {
                                                    setTemplateState(prev => ({ ...prev, importResult: { errors: [err.response?.data?.error || err.message] } }));
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}>
                                            {loading ? '导入中...' : '⬡ 导入范本并创建项目'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {templateState.importResult && (
                            <div style={{ padding: '12px 16px', background: templateState.importResult.errors?.length > 0 ? 'rgba(255,0,68,0.1)' : 'rgba(0,255,100,0.1)', borderRadius: 8 }}>
                                {templateState.importResult.errors?.length > 0 ? (
                                    templateState.importResult.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--neon-red)' }}>✗ {e}</div>)
                                ) : (
                                    <>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neon-green)', marginBottom: 8 }}>✓ 范本导入成功！</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>项目ID: {templateState.importResult.projectId?.substring(0, 8)}...</div>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                                            {Object.entries(templateState.importResult.created || {}).map(([key, count]) => (
                                                <span key={key} className="cyber-badge cyber-badge-green">{key}: {count}</span>
                                            ))}
                                        </div>
                                        {Object.keys(templateState.importResult.skipped || {}).length > 0 && (
                                            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                                                跳过: {Object.entries(templateState.importResult.skipped).map(([k, v]) => `${k}(${v})`).join(', ')}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="cyber-section-title">范本导出</div>
                    <div className="cyber-card">
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                            将当前项目的全部配置和数据导出为标准范本JSON文件，可用于备份或分享给其他项目。
                        </p>
                        {!currentProject ? (
                            <div style={{ padding: 16, background: 'rgba(255,0,68,0.1)', borderRadius: 8, color: 'var(--neon-red)' }}>
                                请先选择一个项目
                            </div>
                        ) : (
                            <button className="cyber-btn cyber-btn-primary" disabled={loading}
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        const res = await workshopApi.exportTemplate(currentProject.id);
                                        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${currentProject.name || 'template'}_template.json`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    } catch (err) {
                                        alert('导出失败: ' + (err.response?.data?.error || err.message));
                                    } finally {
                                        setLoading(false);
                                    }
                                }}>
                                ⬡ 导出「{currentProject.name}」为范本
                            </button>
                        )}
                    </div>

                    <div style={{ marginTop: 20 }}>
                        <div className="cyber-section-title">范本格式规范</div>
                        <div className="cyber-card">
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{`{
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
}`}</div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'fusion' && (
                <div>
                    <div className="cyber-section-title">小说融合分析</div>
                    <div className="cyber-card" style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                            上传或粘贴2本以上的小说文本，系统会提炼出写作手法（叙事、节奏、人物塑造等）和写作元素（世界观模板、人物原型、情节模式等），
                            并生成融合分析方案，帮你创造出新的写作思路。
                        </p>

                        <div className="form-group">
                            <label className="form-label">小说文本（至少2本）</label>
                            {fusionState.novels.map((novel, index) => (
                                <div key={index} style={{ marginBottom: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span style={{ fontSize: 13, color: 'var(--neon-blue)', fontWeight: 600 }}>
                                            小说 {index + 1}
                                        </span>
                                        {fusionState.novels.length > 2 && (
                                            <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-red)' }}
                                                onClick={() => removeFusionNovel(index)}>删除</button>
                                        )}
                                    </div>
                                    <textarea
                                        className="cyber-textarea"
                                        value={novel}
                                        onChange={e => updateFusionNovel(index, e.target.value)}
                                        rows={6}
                                        placeholder={`粘贴第${index + 1}本小说的文本内容...`}
                                        style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
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
                                onChange={e => setFusionState(prev => ({ ...prev, files: Array.from(e.target.files) }))}
                                style={{ color: 'var(--text-secondary)', fontSize: 13 }}
                            />
                            {fusionState.files.length > 0 && (
                                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--neon-green)' }}>
                                    已选择: {fusionState.files.map(f => f.name).join(', ')}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
                                <input type="checkbox" checked={fusionState.extractTechniques}
                                    onChange={e => setFusionState(prev => ({ ...prev, extractTechniques: e.target.checked }))} />
                                提炼写作手法
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
                                <input type="checkbox" checked={fusionState.extractElements}
                                    onChange={e => setFusionState(prev => ({ ...prev, extractElements: e.target.checked }))} />
                                提炼写作元素
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
                                <input type="checkbox" checked={fusionState.fusionAnalysis}
                                    onChange={e => setFusionState(prev => ({ ...prev, fusionAnalysis: e.target.checked }))} />
                                融合分析
                            </label>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
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
            )}

            {result && (
                <div style={{ marginTop: 20 }}>
                    <div className="cyber-section-title">分析结果</div>
                    {result.error ? (
                        <div className="cyber-card" style={{ borderColor: 'var(--neon-red)' }}>
                            <div style={{ color: 'var(--neon-red)', fontWeight: 700, marginBottom: 8 }}>错误</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{result.error}</div>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'import' && (
                                <div className="cyber-card">
                                    {result.materials && (
                                        <div style={{ marginBottom: 16 }}>
                                            <h4 style={{ color: 'var(--neon-blue)', marginBottom: 8 }}>素材库生成</h4>
                                            <span className={`cyber-badge ${result.materials.count > 0 ? 'cyber-badge-green' : 'cyber-badge-red'}`}>
                                                {result.materials.count > 0 ? `成功生成 ${result.materials.count} 个素材` : '生成失败'}
                                            </span>
                                            {result.materials.error && (
                                                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--neon-red)' }}>
                                                    错误: {result.materials.error}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {result.outlines && (
                                        <div style={{ marginBottom: 16 }}>
                                            <h4 style={{ color: 'var(--neon-green)', marginBottom: 8 }}>章节大纲生成</h4>
                                            <span className={`cyber-badge ${result.outlines.count > 0 ? 'cyber-badge-green' : 'cyber-badge-red'}`}>
                                                {result.outlines.count > 0 ? `成功生成 ${result.outlines.count} 章大纲` : '生成失败'}
                                            </span>
                                            {result.outlines.created?.length > 0 && (
                                                <div style={{ marginTop: 8 }}>
                                                    {result.outlines.created.map((ch, i) => (
                                                        <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0' }}>
                                                            第{ch.chapterNumber}章: {ch.title}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {result.outlines.error && (
                                                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--neon-red)' }}>
                                                    错误: {result.outlines.error}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {result.settingFile && (
                                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                            设定文件已保存: {result.settingFile}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'fusion' && (
                                <>
                                    {result.techniques && (
                                        <div className="cyber-card" style={{ marginBottom: 16 }}>
                                            <h4 style={{ color: 'var(--neon-blue)', marginBottom: 12 }}>写作手法分析</h4>
                                            {result.techniques.error ? (
                                                <div style={{ color: 'var(--neon-red)', fontSize: 13 }}>{result.techniques.error}</div>
                                            ) : result.techniques.techniques ? (
                                                <div>
                                                    <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                                                        {result.techniques.styleSummary}
                                                    </div>
                                                    {result.techniques.techniques.map((tech, i) => (
                                                        <div key={i} style={{ padding: '8px 12px', marginBottom: 8, background: 'rgba(0,240,255,0.05)', borderRadius: 6, borderLeft: '3px solid var(--neon-blue)' }}>
                                                            <div style={{ fontWeight: 700, color: 'var(--neon-blue)', fontSize: 13 }}>
                                                                [{tech.category}] {tech.name}
                                                            </div>
                                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
                                                                {tech.description}
                                                            </div>
                                                            {tech.examples?.length > 0 && (
                                                                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                                    示例: {tech.examples[0].substring(0, 100)}...
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {result.techniques.commonPatterns?.length > 0 && (
                                                        <div style={{ marginTop: 12 }}>
                                                            <div style={{ fontWeight: 600, color: 'var(--neon-green)', fontSize: 13, marginBottom: 6 }}>共同模式</div>
                                                            {result.techniques.commonPatterns.map((p, i) => (
                                                                <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0' }}>• {p}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-muted)', maxHeight: 300, overflow: 'auto' }}>
                                                    {typeof result.techniques.raw === 'string' ? result.techniques.raw : JSON.stringify(result.techniques, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    )}

                                    {result.elements && (
                                        <div className="cyber-card" style={{ marginBottom: 16 }}>
                                            <h4 style={{ color: 'var(--neon-green)', marginBottom: 12 }}>写作元素提炼</h4>
                                            {result.elements.error ? (
                                                <div style={{ color: 'var(--neon-red)', fontSize: 13 }}>{result.elements.error}</div>
                                            ) : result.elements.elements ? (
                                                <div>
                                                    <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                                                        {result.elements.elementSummary}
                                                    </div>
                                                    {result.elements.elements.map((elem, i) => (
                                                        <div key={i} style={{ padding: '8px 12px', marginBottom: 8, background: 'rgba(0,255,100,0.05)', borderRadius: 6, borderLeft: '3px solid var(--neon-green)' }}>
                                                            <div style={{ fontWeight: 700, color: 'var(--neon-green)', fontSize: 13 }}>
                                                                [{elem.category}] {elem.name}
                                                            </div>
                                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
                                                                {elem.description}
                                                            </div>
                                                            {elem.reusability && (
                                                                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--neon-orange)' }}>
                                                                    可复用性: {elem.reusability}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {result.elements.recommendedCombinations?.length > 0 && (
                                                        <div style={{ marginTop: 12 }}>
                                                            <div style={{ fontWeight: 600, color: 'var(--neon-orange)', fontSize: 13, marginBottom: 6 }}>推荐组合</div>
                                                            {result.elements.recommendedCombinations.map((c, i) => (
                                                                <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0' }}>• {c}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-muted)', maxHeight: 300, overflow: 'auto' }}>
                                                    {typeof result.elements.raw === 'string' ? result.elements.raw : JSON.stringify(result.elements, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    )}

                                    {result.fusion && (
                                        <div className="cyber-card" style={{ marginBottom: 16 }}>
                                            <h4 style={{ color: 'var(--neon-pink)', marginBottom: 12 }}>融合分析方案</h4>
                                            {result.fusion.error ? (
                                                <div style={{ color: 'var(--neon-red)', fontSize: 13 }}>{result.fusion.error}</div>
                                            ) : result.fusion.fusionStrategy ? (
                                                <div>
                                                    <div style={{ padding: '12px 16px', marginBottom: 12, background: 'rgba(255,0,255,0.05)', borderRadius: 8, borderLeft: '3px solid var(--neon-pink)' }}>
                                                        <div style={{ fontWeight: 700, color: 'var(--neon-pink)', fontSize: 14, marginBottom: 8 }}>融合核心理念</div>
                                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                                            {result.fusion.fusionStrategy.coreIdea}
                                                        </div>
                                                    </div>

                                                    {result.fusion.novelStrengths?.length > 0 && (
                                                        <div style={{ marginBottom: 12 }}>
                                                            <div style={{ fontWeight: 600, color: 'var(--neon-blue)', fontSize: 13, marginBottom: 6 }}>各小说优势</div>
                                                            {result.fusion.novelStrengths.map((ns, i) => (
                                                                <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0' }}>
                                                                    小说{ns.novelIndex}: {ns.strengths?.join(', ')} | 独特价值: {ns.uniqueValue}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {result.fusion.writingPlan && (
                                                        <div style={{ marginBottom: 12 }}>
                                                            <div style={{ fontWeight: 600, color: 'var(--neon-green)', fontSize: 13, marginBottom: 6 }}>写作方案</div>
                                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                                                <div>推荐类型: {result.fusion.writingPlan.recommendedGenre}</div>
                                                                <div>目标读者: {result.fusion.writingPlan.targetAudience}</div>
                                                                <div>开篇策略: {result.fusion.writingPlan.openingStrategy}</div>
                                                                {result.fusion.writingPlan.keySellingPoints?.length > 0 && (
                                                                    <div>卖点: {result.fusion.writingPlan.keySellingPoints.join(' | ')}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {result.fusion.innovationPoints?.length > 0 && (
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: 'var(--neon-orange)', fontSize: 13, marginBottom: 6 }}>创新点</div>
                                                            {result.fusion.innovationPoints.map((ip, i) => (
                                                                <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0' }}>• {ip}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-muted)', maxHeight: 300, overflow: 'auto' }}>
                                                    {typeof result.fusion.raw === 'string' ? result.fusion.raw : JSON.stringify(result.fusion, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    )}

                                    {result.outputDir && (
                                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                            分析结果已保存至: {result.outputDir}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
