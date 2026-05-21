import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { projectsApi, chaptersApi, materialsApi, pipelineApi, styleTemplateApi, franchiseApi, promptConfigApi, flavorsApi } from '../services/api';
import CreateProjectModal from '../components/CreateProjectModal';

const MODE_LABELS = {
    shuangwen: { icon: '⚡', label: '爽文', color: 'var(--neon-orange)' },
    'tomato-short': { icon: '🍅', label: '番茄爽文', color: '#ff6348' },
    novel: { icon: '📖', label: '长篇', color: 'var(--neon-blue)' }
};

export default function Dashboard() {
    const navigate = useNavigate();
    const projects = useAppStore(s => s.projects) || [];
    const setProjects = useAppStore(s => s.setProjects);
    const setCurrentProject = useAppStore(s => s.setCurrentProject);
    const currentProject = useAppStore(s => s.currentProject);
    const setChapters = useAppStore(s => s.setChapters);
    const setMaterials = useAppStore(s => s.setMaterials);
    const chapters = useAppStore(s => s.chapters) || [];
    const materials = useAppStore(s => s.materials) || [];

    const [showCreate, setShowCreate] = useState(false);
    const [genLoading, setGenLoading] = useState({ materials: false, outlines: false });
    const [prompt, setPrompt] = useState('');
    const [errorMsg, setErrorMsg] = useState(null);
    const [editingConstraints, setEditingConstraints] = useState(false);
    const [editConstraints, setEditConstraints] = useState([]);
    const [styleSuggestion, setStyleSuggestion] = useState('');
    const [analyzingStyle, setAnalyzingStyle] = useState(false);
    const [reviewText, setReviewText] = useState('');
    const [remediating, setRemediating] = useState(false);
    const [remediationResult, setRemediationResult] = useState(null);
    const [styleTemplate, setStyleTemplate] = useState(null);
    const [editingStyle, setEditingStyle] = useState(false);
    const [styleEditForm, setStyleEditForm] = useState({ rules: {}, example: '' });
    const [constraintPresets, setConstraintPresets] = useState([]);
    const activeModule = useAppStore(s => s.activeModule);
    const setActiveModule = useAppStore(s => s.setActiveModule);

    const [franchises, setFranchises] = useState([]);
    const [showCreateFranchise, setShowCreateFranchise] = useState(false);
    const [franchiseForm, setFranchiseForm] = useState({ name: '', description: '', genre: '' });
    const [importSourceProjectId, setImportSourceProjectId] = useState('');
    const [importOverview, setImportOverview] = useState(null);
    const [importCategories, setImportCategories] = useState([]);
    const [loadingOverview, setLoadingOverview] = useState(false);
    const [fileParsedData, setFileParsedData] = useState(null);
    const [fileCategories, setFileCategories] = useState([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [expandedFranchises, setExpandedFranchises] = useState({});
    const [showCreateProduct, setShowCreateProduct] = useState(null);
    const [cleanupModal, setCleanupModal] = useState(null);
    const [cleanupStats, setCleanupStats] = useState(null);
    const [cleanupTargets, setCleanupTargets] = useState([]);
    const [cleanupKeepLocked, setCleanupKeepLocked] = useState(true);
    const [cleanupLoading, setCleanupLoading] = useState(false);
    const [cleanupResult, setCleanupResult] = useState(null);
    const [productForm, setProductForm] = useState({ name: '', targetChapters: 100, newSeriesFocus: '', importWorldview: true });
    const [availableCharacters, setAvailableCharacters] = useState([]);
    const [selectedCharacters, setSelectedCharacters] = useState([]);
    const [loadingChars, setLoadingChars] = useState(false);
    const [creatingProduct, setCreatingProduct] = useState(false);
    const [flavorNamingStyles, setFlavorNamingStyles] = useState([]);
    const [flavorDialects, setFlavorDialects] = useState([]);
    const [flavorSpeechStyles, setFlavorSpeechStyles] = useState([]);
    const [worldviewTemplates, setWorldviewTemplates] = useState([]);
    const [systemPersonas, setSystemPersonas] = useState([]);
    const [editingFlavor, setEditingFlavor] = useState(false);
    const [flavorForm, setFlavorForm] = useState({ namingStyle: '', namingStyleIntensity: 'medium', defaultDialect: '', defaultDialectIntensity: 'medium', defaultSpeechStyle: '', defaultSpeechStyleIntensity: 'medium', worldviewTemplate: '', systemPersona: '' });

    useEffect(() => {
        loadProjects();
        loadFranchises();
        promptConfigApi.listConstraintPresets().then(res => setConstraintPresets(res.data || [])).catch(() => {});
        flavorsApi.getNamingStyles().then(res => setFlavorNamingStyles(res.data || [])).catch(() => {});
        flavorsApi.getDialects().then(res => setFlavorDialects(res.data || [])).catch(() => {});
        flavorsApi.getStyles().then(res => setFlavorSpeechStyles(res.data || [])).catch(() => {});
        flavorsApi.getWorldviewTemplates().then(res => setWorldviewTemplates(res.data || [])).catch(() => {});
        flavorsApi.getSystemPersonas().then(res => setSystemPersonas(res.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        if (currentProject?.styleTemplateId) {
            styleTemplateApi.getTemplate(currentProject.styleTemplateId)
                .then(res => setStyleTemplate(res.data))
                .catch(() => setStyleTemplate(null));
        } else {
            setStyleTemplate(null);
        }
    }, [currentProject?.styleTemplateId]);

    const loadProjects = async () => {
        try {
            const res = await projectsApi.list();
            setProjects(res.data || []);
        } catch (e) { console.error(e); }
    };

    const loadFranchises = async () => {
        try {
            const res = await franchiseApi.list();
            setFranchises(res.data?.data || res.data || []);
        } catch (e) { console.error(e); }
    };

    const selectProject = async (project) => {
        try {
            const freshRes = await projectsApi.get(project.id);
            setCurrentProject(freshRes.data);
            const mode = freshRes.data?.mode || project.mode || 'novel';
            if (mode === 'shuangwen') setActiveModule('shuangwen');
            else if (mode === 'tomato-short') setActiveModule('tomato-short');
            else setActiveModule('novel');
        } catch (e) {
            setCurrentProject(project);
            const mode = project.mode || 'novel';
            if (mode === 'shuangwen') setActiveModule('shuangwen');
            else if (mode === 'tomato-short') setActiveModule('tomato-short');
            else setActiveModule('novel');
        }
        try {
            const [chRes, matRes] = await Promise.all([
                chaptersApi.list({ projectId: project.id }).catch(() => ({ data: [] })),
                materialsApi.list({ projectId: project.id }).catch(() => ({ data: [] }))
            ]);
            setChapters(chRes.data || []);
            setMaterials(matRes.data || []);
        } catch (e) { console.error(e); }
    };

    const deleteProject = async (e, id) => {
        e.stopPropagation();
        if (!confirm('确定删除此产品？')) return;
        try {
            await projectsApi.delete(id);
            if (currentProject?.id === id) setCurrentProject(null);
            loadProjects();
            loadFranchises();
        } catch (err) {
            setErrorMsg('删除失败: ' + (err.message || '未知错误'));
            setTimeout(() => setErrorMsg(null), 5000);
        }
    };

    const openCleanupModal = async (project) => {
        setCleanupModal(project);
        setCleanupTargets([]);
        setCleanupKeepLocked(true);
        setCleanupResult(null);
        setCleanupLoading(true);
        try {
            const res = await projectsApi.getCleanupStats(project.id);
            setCleanupStats(res.data);
        } catch {
            setCleanupStats(null);
        }
        setCleanupLoading(false);
    };

    const executeCleanup = async () => {
        if (!cleanupModal || cleanupTargets.length === 0) return;
        if (!confirm(`确定清理「${cleanupModal.name}」的选中项目？\n\n此操作不可撤销！`)) return;
        setCleanupLoading(true);
        try {
            const res = await projectsApi.cleanup(cleanupModal.id, cleanupTargets, cleanupKeepLocked);
            setCleanupResult(res.data);
            const projRes = await projectsApi.list();
            setProjects(projRes.data);
            setChapters([]);
            try {
                const statsRes = await projectsApi.getCleanupStats(cleanupModal.id);
                setCleanupStats(statsRes.data);
            } catch {}
        } catch (err) {
            alert('清理失败: ' + (err.message || '未知错误'));
        }
        setCleanupLoading(false);
    };

    const createFranchise = async () => {
        if (!franchiseForm.name.trim()) return;
        try {
            const payload = { ...franchiseForm };
            if (importSourceProjectId && importCategories.length > 0) {
                payload.importFromProjectId = importSourceProjectId;
                payload.importCategories = importCategories;
            }
            const res = await franchiseApi.create(payload);
            const franchiseId = res.data?.data?.id;
            const counts = res.data?.importCounts;

            let projectId = null;
            if (franchiseId) {
                const frRes = await franchiseApi.get(franchiseId);
                const frData = frRes.data?.data;
                if (frData?.projects && frData.projects.length > 0) {
                    projectId = frData.projects[0].id;
                } else {
                    try {
                        const prodRes = await franchiseApi.createProduct(franchiseId, {
                            name: franchiseForm.name + ' 第一部',
                            targetChapters: 100,
                            newSeriesFocus: franchiseForm.description || '',
                            importWorldview: true
                        });
                        projectId = prodRes.data?.data?.id;
                    } catch (e) {
                        console.error('Auto-create product error:', e);
                    }
                }
            }

            if (fileParsedData && fileCategories.length > 0 && (franchiseId || projectId)) {
                try {
                    const importPayload = {
                        parsedData: fileParsedData,
                        importCategories: fileCategories
                    };
                    if (projectId) importPayload.projectId = projectId;
                    if (franchiseId) importPayload.franchiseId = franchiseId;

                    const importRes = await franchiseApi.importParsed(importPayload);
                    const fileCounts = importRes.data?.importCounts;
                    if (fileCounts) {
                        const allCounts = { ...counts };
                        for (const [k, v] of Object.entries(fileCounts)) {
                            allCounts[k] = (allCounts[k] || 0) + v;
                        }
                        const imported = Object.entries(allCounts).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(', ');
                        if (imported) alert(`导入完成: ${imported}`);
                    }
                } catch (e) {
                    console.error('File import error:', e);
                    alert('文件导入失败: ' + (e.response?.data?.error || e.message));
                }
            } else if (counts) {
                const imported = Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(', ');
                if (imported) alert(`导入完成: ${imported}`);
            }

            setFranchiseForm({ name: '', description: '', genre: '' });
            setImportSourceProjectId('');
            setImportOverview(null);
            setImportCategories([]);
            setFileParsedData(null);
            setFileCategories([]);
            setShowCreateFranchise(false);
            loadFranchises();
        } catch (e) {
            setErrorMsg('创建世界观失败: ' + (e.response?.data?.error || e.message));
            setTimeout(() => setErrorMsg(null), 5000);
        }
    };

    const loadProjectOverview = async (projectId) => {
        if (!projectId) {
            setImportOverview(null);
            setImportCategories([]);
            return;
        }
        setLoadingOverview(true);
        try {
            const res = await franchiseApi.getProjectOverview(projectId);
            const overview = res.data?.data;
            setImportOverview(overview);
            if (overview?.categories) {
                setImportCategories(overview.categories.map(c => c.key));
            }
        } catch (e) {
            console.error(e);
            setImportOverview(null);
        }
        setLoadingOverview(false);
    };

    const toggleImportCategory = (key) => {
        setImportCategories(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleFileUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadingFile(true);
        try {
            const formData = new FormData();
            for (const file of files) {
                formData.append('files', file);
            }
            const res = await franchiseApi.parseFile(formData);
            const data = res.data?.data;
            if (data) {
                setFileParsedData(data.parsedData);
                setFileCategories(data.categories.map(c => c.key));
                setImportSourceProjectId('');
                setImportOverview(null);
            }
        } catch (err) {
            alert('文件解析失败: ' + (err.response?.data?.error || err.message));
        }
        setUploadingFile(false);
    };

    const toggleFileCategory = (key) => {
        setFileCategories(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const deleteFranchise = async (e, id) => {
        e.stopPropagation();
        if (!confirm('确定删除此世界观？需先删除旗下所有产品')) return;
        try {
            await franchiseApi.delete(id);
            loadFranchises();
        } catch (err) {
            setErrorMsg('删除失败: ' + (err.response?.data?.error || err.message));
            setTimeout(() => setErrorMsg(null), 5000);
        }
    };

    const toggleFranchise = (id) => {
        setExpandedFranchises(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const openCreateProduct = async (franchiseId) => {
        setShowCreateProduct(franchiseId);
        setLoadingChars(true);
        setSelectedCharacters([]);
        setProductForm({ name: '', targetChapters: 100, newSeriesFocus: '' });
        try {
            const res = await franchiseApi.getCharacters(franchiseId);
            setAvailableCharacters(res.data?.data?.characters || res.data?.characters || []);
        } catch (e) {
            setAvailableCharacters([]);
        }
        setLoadingChars(false);
    };

    const toggleCharacter = (charId) => {
        setSelectedCharacters(prev =>
            prev.includes(charId) ? prev.filter(id => id !== charId) : [...prev, charId]
        );
    };

    const selectAllCharacters = () => {
        if (selectedCharacters.length === availableCharacters.length) {
            setSelectedCharacters([]);
        } else {
            setSelectedCharacters(availableCharacters.map(c => c.id));
        }
    };

    const createProduct = async () => {
        if (!productForm.name.trim()) return;
        setCreatingProduct(true);
        try {
            const res = await franchiseApi.createProduct(showCreateProduct, {
                name: productForm.name,
                targetChapters: productForm.targetChapters,
                newSeriesFocus: productForm.newSeriesFocus,
                inheritCharacterIds: selectedCharacters,
                importWorldview: productForm.importWorldview
            });
            setShowCreateProduct(null);
            loadProjects();
            loadFranchises();
            if (res.data?.id) {
                const projRes = await projectsApi.list();
                const newProj = projRes.data?.find(p => p.id === res.data.id);
                if (newProj) selectProject(newProj);
            }
        } catch (e) {
            setErrorMsg('创建产品失败: ' + (e.response?.data?.error || e.message));
            setTimeout(() => setErrorMsg(null), 5000);
        }
        setCreatingProduct(false);
    };

    const generateMaterials = async () => {
        if (!currentProject) return;
        setGenLoading(prev => ({ ...prev, materials: true }));
        setErrorMsg(null);
        try {
            await pipelineApi.generateMaterials({
                projectId: currentProject.id,
                prompt: prompt || `请为《${currentProject.name}》生成完整的素材库，包括世界观、主要人物、装备、战力体系、人物关系等。类型：${currentProject.genre}，描述：${currentProject.description}`
            });
            const matRes = await materialsApi.list({ projectId: currentProject.id }).catch(() => ({ data: materials }));
            setMaterials(matRes.data || []);
        } catch (e) {
            console.error('Generate materials error:', e);
            setErrorMsg('素材生成失败: ' + (e.message || '未知错误'));
        } finally {
            setGenLoading(prev => ({ ...prev, materials: false }));
        }
    };

    const generateOutlines = async () => {
        if (!currentProject) return;
        setGenLoading(prev => ({ ...prev, outlines: true }));
        setErrorMsg(null);
        try {
            const res = await pipelineApi.generateOutlines({
                projectId: currentProject.id,
                prompt: prompt || `请为《${currentProject.name}》规划章节大纲，共${currentProject.targetChapters}章。`
            });
            if (res.data && res.data.error && res.data.count === 0) {
                setErrorMsg('大纲生成失败: ' + res.data.error + (res.data.raw ? '\n\nAI原始输出: ' + res.data.raw.substring(0, 300) : ''));
            } else {
                const chRes = await chaptersApi.list({ projectId: currentProject.id }).catch(() => ({ data: chapters }));
                setChapters(chRes.data || []);
            }
        } catch (e) {
            console.error('Generate outlines error:', e);
            setErrorMsg('大纲生成失败: ' + (e.message || '未知错误'));
        } finally {
            setGenLoading(prev => ({ ...prev, outlines: false }));
        }
    };

    const startEditConstraints = () => {
        setEditConstraints(currentProject?.constraints || []);
        setEditingConstraints(true);
    };

    const toggleEditConstraint = (id) => {
        setEditConstraints(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    };

    const saveConstraints = async () => {
        try {
            await projectsApi.update(currentProject.id, { constraints: editConstraints });
            setCurrentProject({ ...currentProject, constraints: editConstraints });
            setEditingConstraints(false);
            loadProjects();
        } catch (e) {
            setErrorMsg('保存约束失败');
            setTimeout(() => setErrorMsg(null), 3000);
        }
    };

    const startEditingStyle = () => {
        setStyleEditForm({
            rules: styleTemplate?.rules || {},
            example: styleTemplate?.example || ''
        });
        setEditingStyle(true);
    };

    const saveStyleEdits = async () => {
        try {
            if (styleTemplate?.id) {
                await styleTemplateApi.updateTemplate(styleTemplate.id, styleEditForm);
                const res = await styleTemplateApi.getTemplate(styleTemplate.id);
                setStyleTemplate(res.data);
            } else if (currentProject) {
                const newStyle = { ...styleEditForm, name: currentProject.name + '风格', projectId: currentProject.id };
                const createRes = await styleTemplateApi.createTemplate(newStyle);
                await projectsApi.update(currentProject.id, { styleTemplateId: createRes.data.id });
                setStyleTemplate(createRes.data);
            }
            setEditingStyle(false);
        } catch (e) {
            setErrorMsg('保存风格失败');
            setTimeout(() => setErrorMsg(null), 3000);
        }
    };

    const totalChapters = chapters.length;
    const approvedChapters = chapters.filter(c => c.status === 'material-updated').length;
    const totalMaterials = materials.length;
    const projectConstraints = (currentProject?.constraints || []).map(id => constraintPresets.find(c => c.id === id)).filter(Boolean);

    const modeFilteredProjects = activeModule === 'comic'
        ? projects
        : projects.filter(p => {
            if (activeModule === 'shuangwen') return p.mode === 'shuangwen';
            if (activeModule === 'tomato-short') return p.mode === 'tomato-short';
            return p.mode !== 'shuangwen' && p.mode !== 'tomato-short';
        });
    const standaloneProjects = modeFilteredProjects.filter(p => !p.franchiseId);
    const franchiseProjects = modeFilteredProjects.filter(p => p.franchiseId);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">仪表盘</h1>
                <p className="page-subtitle">AI小说生产流水线 - 世界观与产品管理</p>
            </div>

            {errorMsg && (
                <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 6, fontSize: 13, background: 'rgba(255,0,68,0.1)', color: '#ff0044', border: '1px solid rgba(255,0,68,0.3)' }}>
                    {errorMsg}
                </div>
            )}

            <div className="stat-grid">
                <div className="stat-card">
                    <div className="stat-label">世界观</div>
                    <div className="stat-value">{franchises.length}</div>
                    <div className="stat-sub">系列数量</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">产品总数</div>
                    <div className="stat-value">{projects.length}</div>
                    <div className="stat-sub">已创建产品</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">章节总数</div>
                    <div className="stat-value">{totalChapters}</div>
                    <div className="stat-sub">已定稿: {approvedChapters}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">当前产品</div>
                    <div className="stat-value" style={{ fontSize: currentProject ? 20 : 32 }}>
                        {currentProject ? currentProject.name : '未选择'}
                    </div>
                    <div className="stat-sub">{currentProject ? (currentProject.genre || '未设定类型') : '请选择或创建产品'}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="cyber-section-title">世界观与产品</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="cyber-btn cyber-btn-sm" onClick={() => setShowCreateFranchise(true)}>+ 世界观</button>
                            <button className="cyber-btn cyber-btn-primary cyber-btn-sm" onClick={() => setShowCreate(true)}>+ 独立产品</button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {franchises.length === 0 && standaloneProjects.length === 0 && (
                            <div className="cyber-empty">
                                <div className="cyber-empty-icon">⬡</div>
                                <div>暂无世界观，点击上方按钮创建</div>
                            </div>
                        )}

                        {franchises.map(f => (
                            <div key={f.id} className="cyber-card" style={{ padding: 0 }}>
                                <div
                                    style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: expandedFranchises[f.id] ? 'rgba(0,240,255,0.05)' : 'transparent' }}
                                    onClick={() => toggleFranchise(f.id)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 12, transition: 'transform 0.2s', display: 'inline-block', transform: expandedFranchises[f.id] ? 'rotate(90deg)' : 'none' }}>▶</span>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 15 }}>🌍 {f.name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.genre || '未设定类型'} · {(f.projects || []).length}部产品</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button className="cyber-btn cyber-btn-sm" onClick={e => { e.stopPropagation(); openCreateProduct(f.id); }}>+ 新产品</button>
                                        <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={e => deleteFranchise(e, f.id)}>删除</button>
                                    </div>
                                </div>
                                {expandedFranchises[f.id] && (f.projects || []).length > 0 && (
                                    <div style={{ borderTop: '1px solid var(--border-color)', padding: '8px 0 8px 24px' }}>
                                        {f.projects.map(p => (
                                            <div
                                                key={p.id}
                                                className={`cyber-card ${currentProject?.id === p.id ? 'cyber-card-glow' : ''}`}
                                                onClick={() => selectProject(p)}
                                                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0', padding: '8px 12px', background: 'var(--bg-input)' }}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: 500, fontSize: 14 }}>📖 {p.name}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>第{p.franchiseSequence || '?'}部 · {p.targetChapters}章 · {p.status}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-cyan)', borderColor: 'var(--neon-cyan)' }} onClick={async e => {
                                        e.stopPropagation();
                                        openCleanupModal(p);
                                    }}>🧹 清理</button>
                                    <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={e => deleteProject(e, p.id)}>删除</button>
                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {standaloneProjects.length > 0 && franchises.length > 0 && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-color)' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>独立产品（未归属世界观）</div>
                            </div>
                        )}

                        {standaloneProjects.map(p => (
                            <div
                                key={p.id}
                                className={`cyber-card ${currentProject?.id === p.id ? 'cyber-card-glow' : ''}`}
                                onClick={() => selectProject(p)}
                                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}{p.mode === 'shuangwen' ? <span style={{ color: 'var(--neon-orange)', fontSize: 11, marginLeft: 6 }}>⚡爽文</span> : p.mode === 'tomato-short' ? <span style={{ color: '#ff6348', fontSize: 11, marginLeft: 6 }}>🍅番茄爽文</span> : null}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.genre || '未设定'} · 目标{p.targetChapters}章 · 状态: {p.status}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-cyan)', borderColor: 'var(--neon-cyan)' }} onClick={async e => {
                                        e.stopPropagation();
                                        openCleanupModal(p);
                                    }}>🧹 清理</button>
                                    <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={e => deleteProject(e, p.id)}>删除</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="cyber-section-title">快速操作</div>
                    {currentProject ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div className="cyber-card">
                                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--neon-blue)' }}>需求描述</h3>
                                <textarea className="cyber-textarea" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="输入你的小说需求、目标、选题...（AI将据此生成素材库和章节大纲）" rows={4} />
                            </div>

                            <div className="cyber-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--neon-purple)' }}>🔒 写作约束</h3>
                                    {!editingConstraints && <button className="cyber-btn cyber-btn-sm" onClick={startEditConstraints}>编辑</button>}
                                </div>
                                {editingConstraints ? (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                                            {constraintPresets.map(c => (
                                                <button key={c.id} type="button" className={`cyber-btn cyber-btn-sm ${editConstraints.includes(c.id) ? 'cyber-btn-primary' : ''}`} style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: 11, padding: '4px 8px' }} onClick={() => toggleEditConstraint(c.id)}>{c.label}</button>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="cyber-btn cyber-btn-sm cyber-btn-primary" onClick={saveConstraints}>保存</button>
                                            <button className="cyber-btn cyber-btn-sm" onClick={() => setEditingConstraints(false)}>取消</button>
                                        </div>
                                    </>
                                ) : projectConstraints.length > 0 ? (
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {projectConstraints.map(c => <span key={c.id} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(126,87,194,0.15)', color: 'var(--neon-purple)', border: '1px solid rgba(126,87,194,0.3)' }} title={c.desc}>{c.label}</span>)}
                                    </div>
                                ) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>未设置约束，点击编辑添加</div>}
                            </div>

                            <div className="cyber-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--neon-red)' }}>🔧 评测整改</h3>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>粘贴评测意见，AI自动分析问题并分发到：执笔人规则、审核标准、约束、素材、风格指导</div>
                                <textarea className="cyber-input" rows={6} value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="粘贴评测意见...如：开头太烂没有冲突、章末没有钩子、没有爽点、人物扁平说话一个语气..." style={{ width: '100%', marginBottom: 8, fontSize: 12 }} />
                                <button className="cyber-btn cyber-btn-sm cyber-btn-primary" disabled={remediating || !reviewText.trim()} onClick={async () => {
                                    if (!currentProject) return;
                                    setRemediating(true);
                                    setRemediationResult(null);
                                    try {
                                        const res = await projectsApi.remediate(currentProject.id, reviewText);
                                        setRemediationResult(res.data);
                                        const projRes = await projectsApi.list();
                                        setProjects(projRes.data);
                                    } catch (e) { alert('整改失败: ' + e.message); }
                                    finally { setRemediating(false); }
                                }}>
                                    {remediating ? '🔧 AI分析整改中...' : '🔧 一键整改分发'}
                                </button>
                                {remediationResult && (
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-green)', marginBottom: 4 }}>✅ 整改完成</div>
                                        {remediationResult.problems?.map((p, i) => (
                                            <div key={i} style={{ fontSize: 11, padding: '4px 8px', marginBottom: 2, background: p.severity === 'critical' ? 'rgba(255,50,50,0.1)' : 'rgba(255,165,0,0.1)', borderRadius: 4 }}>
                                                {p.severity === 'critical' ? '🔴' : '🟡'} {p.title}
                                            </div>
                                        ))}
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--neon-blue)', marginTop: 6, marginBottom: 4 }}>📋 整改执行记录</div>
                                        {remediationResult.executionLog?.map((log, i) => (
                                            <div key={i} style={{ fontSize: 10, padding: '2px 8px', marginBottom: 2, color: log.status === 'applied' ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                                                {log.status === 'applied' ? '✅' : '❌'} [{log.target}] {log.detail || log.action}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {(currentProject?.writerPromptAdditions?.length > 0 || currentProject?.reviewPromptAdditions?.length > 0) && (
                                    <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,200,255,0.05)', borderRadius: 6, border: '1px solid rgba(0,200,255,0.15)' }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--neon-blue)', marginBottom: 4 }}>当前整改规则</div>
                                        {currentProject.writerPromptAdditions?.map((r, i) => (
                                            <div key={`w${i}`} style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
                                                ✍️ {r.rule}
                                            </div>
                                        ))}
                                        {currentProject.reviewPromptAdditions?.map((r, i) => (
                                            <div key={`r${i}`} style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
                                                ✓ {r.rule}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="cyber-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--neon-orange)' }}>🎯 风格指导</h3>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>输入修改建议，AI分析已有章节并生成定向改善指导，后续章节自动遵循</div>
                                <textarea className="cyber-input" rows={3} value={styleSuggestion} onChange={e => setStyleSuggestion(e.target.value)} placeholder="如：对话太生硬、节奏偏慢、打斗描写不够燃、主角太圣母..." style={{ width: '100%', marginBottom: 8, fontSize: 12 }} />
                                <button className="cyber-btn cyber-btn-sm cyber-btn-primary" disabled={analyzingStyle} onClick={async () => {
                                    if (!currentProject) return;
                                    setAnalyzingStyle(true);
                                    try {
                                        const res = await projectsApi.analyzeStyle(currentProject.id, styleSuggestion);
                                        if (res.data?.success) {
                                            const projRes = await projectsApi.list();
                                            setProjects(projRes.data);
                                            setStyleSuggestion('');
                                        } else {
                                            alert('分析失败: ' + (res.data?.error || '未知错误'));
                                        }
                                    } catch (e) { alert('分析失败: ' + e.message); }
                                    finally { setAnalyzingStyle(false); }
                                }}>
                                    {analyzingStyle ? '🔍 AI分析中...' : '🔍 AI分析并生成指导'}
                                </button>
                                {currentProject?.styleGuidance && (
                                    <div style={{ marginTop: 8, padding: 8, background: 'rgba(255,107,53,0.08)', borderRadius: 6, border: '1px solid rgba(255,107,53,0.2)', fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', color: 'var(--text-secondary)' }}>
                                        {currentProject.styleGuidance}
                                    </div>
                                )}
                                {currentProject?.styleGuidance && (
                                    <button className="cyber-btn cyber-btn-sm cyber-btn-danger" style={{ marginTop: 4, fontSize: 10 }} onClick={async () => {
                                        if (!confirm('确定清除风格指导？')) return;
                                        await projectsApi.updateStyleGuidance(currentProject.id, '');
                                        const projRes = await projectsApi.list();
                                        setProjects(projRes.data);
                                    }}>清除指导</button>
                                )}
                            </div>

                            <div className="cyber-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--neon-blue)' }}>🎨 写作风格</h3>
                                    <button className="cyber-btn cyber-btn-sm" onClick={startEditingStyle}>{styleTemplate ? '编辑' : '设置风格'}</button>
                                </div>
                                {editingStyle ? (
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>修改风格会增量叠加到原有设定上</div>
                                        <div className="form-group"><label className="form-label">叙事节奏</label><input className="cyber-input" value={styleEditForm.rules?.narrativePacing || ''} onChange={e => setStyleEditForm(f => ({ ...f, rules: { ...f.rules, narrativePacing: e.target.value } }))} placeholder="如：快节奏、张弛有度..." /></div>
                                        <div className="form-group"><label className="form-label">描写风格</label><input className="cyber-input" value={styleEditForm.rules?.descriptionStyle || ''} onChange={e => setStyleEditForm(f => ({ ...f, rules: { ...f.rules, descriptionStyle: e.target.value } }))} placeholder="如：细腻写实、留白写意..." /></div>
                                        <div className="form-group"><label className="form-label">对话风格</label><input className="cyber-input" value={styleEditForm.rules?.dialogueStyle || ''} onChange={e => setStyleEditForm(f => ({ ...f, rules: { ...f.rules, dialogueStyle: e.target.value } }))} placeholder="如：机智幽默、简洁有力..." /></div>
                                        <div className="form-group"><label className="form-label">情感基调</label><input className="cyber-input" value={styleEditForm.rules?.emotionalTone || ''} onChange={e => setStyleEditForm(f => ({ ...f, rules: { ...f.rules, emotionalTone: e.target.value } }))} placeholder="如：热血激昂、幽默轻松..." /></div>
                                        <div className="form-group"><label className="form-label">幽默程度</label>
                                            <select className="cyber-select" value={styleEditForm.rules?.humorLevel || ''} onChange={e => setStyleEditForm(f => ({ ...f, rules: { ...f.rules, humorLevel: e.target.value } }))}>
                                                <option value="">不指定</option><option value="无">无幽默</option><option value="偶尔">偶尔幽默</option><option value="适中">适中幽默</option><option value="大量">大量幽默</option>
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="cyber-btn cyber-btn-sm cyber-btn-primary" onClick={saveStyleEdits}>保存</button>
                                            <button className="cyber-btn cyber-btn-sm" onClick={() => setEditingStyle(false)}>取消</button>
                                        </div>
                                    </div>
                                ) : styleTemplate ? (
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--neon-blue)' }}>{styleTemplate.name}</div>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {Object.entries(styleTemplate.rules || {}).filter(([k, v]) => k !== 'forbidden' && v).map(([k, v]) => (
                                                <span key={k} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(0,240,255,0.08)', color: 'var(--neon-blue)', border: '1px solid rgba(0,240,255,0.2)' }}>
                                                    {k === 'narrativePacing' ? '节奏' : k === 'descriptionStyle' ? '描写' : k === 'dialogueStyle' ? '对话' : k === 'emotionalTone' ? '情感' : k === 'humorLevel' ? '幽默' : k}: {v}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>未设置风格模板</div>}
                            </div>

                            <div className="cyber-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--neon-orange)' }}>🎭 说话风味（三轴配置）</h3>
                                    <button className="cyber-btn cyber-btn-sm" onClick={() => {
                                        const sp = currentProject?.styleProfile || {};
                                        setFlavorForm({
                                            namingStyle: sp.namingStyle || '',
                                            namingStyleIntensity: sp.namingStyleIntensity || 'medium',
                                            defaultDialect: sp.defaultDialect || '',
                                            defaultDialectIntensity: sp.defaultDialectIntensity || 'medium',
                                            defaultSpeechStyle: sp.defaultSpeechStyle || '',
                                            defaultSpeechStyleIntensity: sp.defaultSpeechStyleIntensity || 'medium',
                                            worldviewTemplate: sp.worldviewTemplate || '',
                                            systemPersona: sp.systemPersona || ''
                                        });
                                        setEditingFlavor(true);
                                    }}>{editingFlavor ? '取消' : '配置'}</button>
                                </div>
                                {editingFlavor ? (
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>配置项目级风味默认值，角色素材可单独覆盖</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: 11 }}>✒️ 命名风格</label>
                                                <select className="cyber-select" value={flavorForm.namingStyle} onChange={e => setFlavorForm(f => ({ ...f, namingStyle: e.target.value }))}>
                                                    <option value="">自动推断</option>
                                                    {flavorNamingStyles.map(s => <option key={s.id} value={s.id}>{s.label}（{s.tag}）</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: 11 }}>命名强度</label>
                                                <select className="cyber-select" value={flavorForm.namingStyleIntensity} onChange={e => setFlavorForm(f => ({ ...f, namingStyleIntensity: e.target.value }))} disabled={!flavorForm.namingStyle}>
                                                    <option value="light">轻度</option><option value="medium">中度</option><option value="heavy">重度</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: 11 }}>🗣 默认方言</label>
                                                <select className="cyber-select" value={flavorForm.defaultDialect} onChange={e => setFlavorForm(f => ({ ...f, defaultDialect: e.target.value }))}>
                                                    <option value="">不指定</option>
                                                    {flavorDialects.map(d => <option key={d.region} value={d.region}>{d.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: 11 }}>方言强度</label>
                                                <select className="cyber-select" value={flavorForm.defaultDialectIntensity} onChange={e => setFlavorForm(f => ({ ...f, defaultDialectIntensity: e.target.value }))} disabled={!flavorForm.defaultDialect}>
                                                    <option value="light">轻度</option><option value="medium">中度</option><option value="heavy">重度</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: 11 }}>🎭 默认说话风格</label>
                                                <select className="cyber-select" value={flavorForm.defaultSpeechStyle} onChange={e => setFlavorForm(f => ({ ...f, defaultSpeechStyle: e.target.value }))}>
                                                    <option value="">不指定</option>
                                                    {flavorSpeechStyles.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: 11 }}>风格强度</label>
                                                <select className="cyber-select" value={flavorForm.defaultSpeechStyleIntensity} onChange={e => setFlavorForm(f => ({ ...f, defaultSpeechStyleIntensity: e.target.value }))} disabled={!flavorForm.defaultSpeechStyle}>
                                                    <option value="light">轻度</option><option value="medium">中度</option><option value="heavy">重度</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 8 }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: 11 }}>🌍 世界观阶段模板</label>
                                                <select className="cyber-select" value={flavorForm.worldviewTemplate} onChange={e => setFlavorForm(f => ({ ...f, worldviewTemplate: e.target.value }))}>
                                                    <option value="">自动推断（根据题材）</option>
                                                    {worldviewTemplates.map(t => <option key={t.id} value={t.id}>{t.label}（{t.tag}）</option>)}
                                                </select>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>控制前中后期战力天花板/地理范围/势力复杂度/叙事节奏</div>
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: 11 }}>🤖 系统人格</label>
                                                <select className="cyber-select" value={flavorForm.systemPersona} onChange={e => setFlavorForm(f => ({ ...f, systemPersona: e.target.value }))}>
                                                    <option value="">无系统/标准系统</option>
                                                    {systemPersonas.map(p => <option key={p.id} value={p.id}>{p.label}（{p.tag}）</option>)}
                                                </select>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>系统通知格式/语气/互动规则/砍价/整蛊/隐藏福利</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="cyber-btn cyber-btn-sm cyber-btn-primary" onClick={async () => {
                                                try {
                                                    await projectsApi.update(currentProject.id, { styleProfile: { ...(currentProject.styleProfile || {}), ...flavorForm } });
                                                    const projRes = await projectsApi.list();
                                                    setProjects(projRes.data);
                                                    setEditingFlavor(false);
                                                } catch (e) { alert('保存失败: ' + e.message); }
                                            }}>保存</button>
                                            <button className="cyber-btn cyber-btn-sm" onClick={() => setEditingFlavor(false)}>取消</button>
                                        </div>
                                    </div>
                                ) : (() => {
                                    const sp = currentProject?.styleProfile || {};
                                    const tags = [];
                                    if (sp.namingStyle) { const ns = flavorNamingStyles.find(s => s.id === sp.namingStyle); tags.push({ icon: '✒️', label: ns?.label || sp.namingStyle, color: 'var(--neon-orange)' }); }
                                    else if (currentProject?.genre) { tags.push({ icon: '✒️', label: '自动推断', color: 'var(--text-muted)' }); }
                                    if (sp.defaultDialect) { const d = flavorDialects.find(x => x.region === sp.defaultDialect); tags.push({ icon: '🗣', label: d?.label || sp.defaultDialect, color: 'var(--neon-green)' }); }
                                    if (sp.defaultSpeechStyle) { const s = flavorSpeechStyles.find(x => x.id === sp.defaultSpeechStyle); tags.push({ icon: '🎭', label: s?.label || sp.defaultSpeechStyle, color: 'var(--neon-pink)' }); }
                                    if (sp.worldviewTemplate) { const w = worldviewTemplates.find(x => x.id === sp.worldviewTemplate); tags.push({ icon: '🌍', label: w?.label || sp.worldviewTemplate, color: 'var(--neon-cyan)' }); }
                                    if (sp.systemPersona) { const sp2 = systemPersonas.find(x => x.id === sp.systemPersona); tags.push({ icon: '🤖', label: sp2?.label || sp.systemPersona, color: '#9b59b6' }); }
                                    return tags.length > 0 ? (
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {tags.map((t, i) => <span key={i} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: `rgba(${t.color === 'var(--neon-orange)' ? '255,200,0' : t.color === 'var(--neon-green)' ? '0,255,150' : t.color === 'var(--neon-pink)' ? '255,100,255' : '128,128,128'},0.1)`, color: t.color, border: `1px solid rgba(${t.color === 'var(--neon-orange)' ? '255,200,0' : t.color === 'var(--neon-green)' ? '0,255,150' : t.color === 'var(--neon-pink)' ? '255,100,255' : '128,128,128'},0.2)` }}>{t.icon} {t.label}</span>)}
                                        </div>
                                    ) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>未配置，角色可单独设置方言/风格/命名规范</div>;
                                })()}
                            </div>

                            <button className="cyber-btn cyber-btn-success cyber-btn-lg" onClick={generateMaterials} disabled={genLoading.materials} style={{ width: '100%' }}>
                                {genLoading.materials ? '生成素材库中(1-3分钟)...' : '⬡ 生成素材库'}
                            </button>

                            <button className="cyber-btn cyber-btn-lg" onClick={generateOutlines} disabled={genLoading.outlines || totalMaterials === 0} style={{ width: '100%' }}>
                                {genLoading.outlines ? '生成大纲中(1-3分钟)...' : '▦ 生成章节大纲'}
                            </button>

                            {totalMaterials > 0 && totalChapters > 0 && (
                                <button className="cyber-btn cyber-btn-primary cyber-btn-lg" onClick={() => navigate('/pipeline')} style={{ width: '100%' }}>⟐ 启动流水线</button>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <button className="cyber-btn" onClick={() => navigate('/materials')}>素材库 →</button>
                                <button className="cyber-btn" onClick={() => navigate('/chapters')}>章节管理 →</button>
                            </div>
                        </div>
                    ) : (
                        <div className="cyber-card cyber-empty">
                            <div className="cyber-empty-icon">◈</div>
                            <div>请先选择或创建一个产品</div>
                        </div>
                    )}
                </div>
            </div>

            {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={selectProject} />}

            {cleanupModal && (
                <div className="cyber-modal-overlay" onClick={() => setCleanupModal(null)}>
                    <div className="cyber-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '85vh', overflow: 'auto' }}>
                        <h2>🧹 数据清理 - {cleanupModal.name}</h2>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>选择要清理的数据类别，保留的设定和约束不会被影响</p>

                        {cleanupLoading && !cleanupStats ? <div style={{ textAlign: 'center', padding: 20 }}>加载中...</div> : cleanupStats && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {[
                                    { key: 'chapters', label: '📖 主线章节', desc: `章节 ${cleanupStats.chapters.count} 篇 · 审核 ${cleanupStats.chapters.reviews} 条`, danger: true },
                                    { key: 'timelines', label: '⏱ 时间轴', desc: `时间线 ${cleanupStats.timelines.count} 条 · 任务 ${cleanupStats.timelines.quests} 条` },
                                    { key: 'materials', label: '📦 素材库', desc: `总计 ${cleanupStats.materials.count} · 锁定 ${cleanupStats.materials.locked} · 未锁定 ${cleanupStats.materials.unlocked}` },
                                    { key: 'knowledge', label: '🧠 知识库', desc: `记忆层 ${cleanupStats.knowledge.memoryLayers} · 快照 ${cleanupStats.knowledge.snapshots} · 一致性报告 ${cleanupStats.knowledge.consistencyReports}` },
                                    { key: 'outlines', label: '📋 大纲', desc: `章节大纲 ${cleanupStats.outlines.count} 条` },
                                    { key: 'logs', label: '📄 输出日志', desc: `${cleanupStats.logs.hasOutput || cleanupStats.logs.hasExport ? '有导出文件' : '无导出文件'}` },
                                    { key: 'remediation', label: '🔧 整改规则', desc: `${cleanupStats.remediation.hasWriterAdditions || cleanupStats.remediation.hasReviewAdditions || cleanupStats.remediation.hasStyleGuidance ? '有整改数据' : '无整改数据'}` }
                                ].map(item => (
                                    <div key={item.key} className="cyber-card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: cleanupTargets.includes(item.key) ? '1px solid var(--neon-cyan)' : undefined, background: cleanupTargets.includes(item.key) ? 'rgba(0,255,255,0.05)' : undefined }} onClick={() => {
                                        setCleanupTargets(prev => prev.includes(item.key) ? prev.filter(t => t !== item.key) : [...prev, item.key]);
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.desc}</div>
                                        </div>
                                        <div style={{ fontSize: 18 }}>{cleanupTargets.includes(item.key) ? '✅' : '⬜'}</div>
                                    </div>
                                ))}

                                {cleanupTargets.includes('materials') && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--bg-input)', borderRadius: 4 }}>
                                        <input type="checkbox" checked={cleanupKeepLocked} onChange={e => setCleanupKeepLocked(e.target.checked)} id="keepLocked" />
                                        <label htmlFor="keepLocked" style={{ fontSize: 13, cursor: 'pointer' }}>🔒 保留锁定素材（设定文件）</label>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    <button className="cyber-btn" style={{ flex: 1 }} disabled={cleanupTargets.length === 0 || cleanupLoading} onClick={executeCleanup}>
                                        {cleanupLoading ? '清理中...' : `清理选中 (${cleanupTargets.length})`}
                                    </button>
                                    <button className="cyber-btn" style={{ flex: 1, borderColor: 'var(--text-muted)' }} onClick={() => { setCleanupTargets(['chapters', 'timelines', 'materials', 'knowledge', 'outlines', 'logs', 'remediation']); }}>
                                        全选
                                    </button>
                                    <button className="cyber-btn" style={{ flex: 1, borderColor: 'var(--text-muted)' }} onClick={() => setCleanupModal(null)}>
                                        关闭
                                    </button>
                                </div>

                                {cleanupResult && (
                                    <div className="cyber-card" style={{ marginTop: 8, padding: 12, background: 'rgba(0,255,0,0.05)', border: '1px solid var(--neon-green)' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--neon-green)', marginBottom: 6 }}>✅ 清理完成</div>
                                        <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{JSON.stringify(cleanupResult.cleaned, null, 2)}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showCreateFranchise && (
                <div className="cyber-modal-overlay" onClick={() => setShowCreateFranchise(false)}>
                    <div className="cyber-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '85vh', overflow: 'auto' }}>
                        <h2>🌍 创建世界观</h2>
                        <div className="form-group">
                            <label className="form-label">世界观名称 *</label>
                            <input className="cyber-input" value={franchiseForm.name} onChange={e => setFranchiseForm({ ...franchiseForm, name: e.target.value })} placeholder="如：修仙宇宙、星际联邦..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">题材类型</label>
                            <input className="cyber-input" value={franchiseForm.genre} onChange={e => setFranchiseForm({ ...franchiseForm, genre: e.target.value })} placeholder="如：玄幻、科幻、都市..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">世界观描述</label>
                            <textarea className="cyber-textarea" value={franchiseForm.description} onChange={e => setFranchiseForm({ ...franchiseForm, description: e.target.value })} placeholder="描述这个世界观的核心设定、规则、历史背景..." rows={3} />
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 8 }}>
                            <h3 style={{ fontSize: 14, color: 'var(--neon-orange)', marginBottom: 12 }}>📄 从文件导入设定</h3>
                            <div style={{
                                border: '2px dashed var(--border-color)', borderRadius: 8, padding: 20,
                                textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
                                borderColor: uploadingFile ? 'var(--neon-blue)' : 'var(--border-color)'
                            }}
                                onClick={() => document.getElementById('franchise-file-input').click()}>
                                {uploadingFile ? (
                                    <div style={{ color: 'var(--neon-blue)', fontSize: 13 }}>解析中...</div>
                                ) : (
                                    <>
                                        <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>点击选择 TXT / Markdown 文件</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>支持多文件上传，自动按标题拆分章节并分类</div>
                                    </>
                                )}
                                <input id="franchise-file-input" type="file" accept=".txt,.md,.markdown" multiple
                                    style={{ display: 'none' }} onChange={handleFileUpload} />
                            </div>

                            {fileParsedData && (
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <span style={{ fontSize: 12, color: 'var(--neon-green)' }}>
                                            ✅ 已解析 {fileParsedData.length} 个文件
                                        </span>
                                        <button className="cyber-btn cyber-btn-sm" onClick={() => {
                                            const allKeys = new Set();
                                            fileParsedData.forEach(p => Object.keys(p.categories).forEach(k => allKeys.add(k)));
                                            if (fileCategories.length === allKeys.size) {
                                                setFileCategories([]);
                                            } else {
                                                setFileCategories([...allKeys]);
                                            }
                                        }} style={{ fontSize: 10 }}>
                                            {fileCategories.length === 0 ? '全选' : '取消全选'}
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                        {(() => {
                                            const mergedCats = {};
                                            fileParsedData.forEach(p => {
                                                for (const [type, items] of Object.entries(p.categories)) {
                                                    if (!mergedCats[type]) mergedCats[type] = [];
                                                    mergedCats[type].push(...items);
                                                }
                                            });
                                            const typeLabels = {
                                                'character': '👤 人物设定', 'relationship': '🔗 人物关系',
                                                'worldview': '🌍 世界观/背景', 'location': '🏰 地点/势力',
                                                'equipment': '⚔ 装备/道具', 'power-system': '⚡ 战力体系',
                                                'plot': '📜 剧情/事件', 'other': '📦 其他元素'
                                            };
                                            return Object.entries(mergedCats).map(([type, items]) => (
                                                <div key={type}
                                                    onClick={() => toggleFileCategory(type)}
                                                    style={{
                                                        padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                                                        background: fileCategories.includes(type) ? 'rgba(0,150,255,0.15)' : 'var(--bg-input)',
                                                        border: `1px solid ${fileCategories.includes(type) ? 'var(--neon-blue)' : 'var(--border-color)'}`,
                                                        transition: 'all 0.15s'
                                                    }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: 12, color: fileCategories.includes(type) ? 'var(--neon-blue)' : 'var(--text-secondary)' }}>
                                                            {typeLabels[type] || type}
                                                        </span>
                                                        <span style={{ fontSize: 11, fontWeight: 700, color: fileCategories.includes(type) ? 'var(--neon-blue)' : 'var(--text-muted)' }}>
                                                            {items.length}
                                                        </span>
                                                    </div>
                                                    {fileCategories.includes(type) && items.length > 0 && (
                                                        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                                            {items.slice(0, 4).map((item, i) => (
                                                                <div key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    · {item.name}
                                                                </div>
                                                            ))}
                                                            {items.length > 4 && <div>...还有 {items.length - 4} 项</div>}
                                                        </div>
                                                    )}
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                    {fileCategories.length > 0 && (
                                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--neon-green)' }}>
                                            将导入 {fileCategories.length} 类设定
                                        </div>
                                    )}
                                    <button className="cyber-btn cyber-btn-sm" onClick={() => { setFileParsedData(null); setFileCategories([]); }}
                                        style={{ fontSize: 10, marginTop: 8, color: 'var(--neon-red)' }}>
                                        ✕ 清除文件
                                    </button>
                                </div>
                            )}
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 8 }}>
                            <h3 style={{ fontSize: 14, color: 'var(--neon-orange)', marginBottom: 12 }}>📥 从已有项目导入设定</h3>
                            <div className="form-group">
                                <label className="form-label">选择源项目</label>
                                <select className="cyber-input" value={importSourceProjectId}
                                    onChange={e => { setImportSourceProjectId(e.target.value); loadProjectOverview(e.target.value); }}>
                                    <option value="">-- 不导入，手动创建 --</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {loadingOverview && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>加载项目素材概览...</div>}

                            {importOverview && (
                                <div style={{ marginTop: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            {importOverview.projectName} · 共 {importOverview.totalMaterials} 个素材
                                        </span>
                                        <button className="cyber-btn cyber-btn-sm" onClick={() => {
                                            if (importCategories.length === importOverview.categories.length) {
                                                setImportCategories([]);
                                            } else {
                                                setImportCategories(importOverview.categories.map(c => c.key));
                                            }
                                        }} style={{ fontSize: 10 }}>
                                            {importCategories.length === importOverview.categories.length ? '取消全选' : '全选'}
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                        {importOverview.categories.map(cat => (
                                            <div key={cat.key}
                                                onClick={() => toggleImportCategory(cat.key)}
                                                style={{
                                                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                                                    background: importCategories.includes(cat.key) ? 'rgba(0,150,255,0.15)' : 'var(--bg-input)',
                                                    border: `1px solid ${importCategories.includes(cat.key) ? 'var(--neon-blue)' : 'var(--border-color)'}`,
                                                    transition: 'all 0.15s'
                                                }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: 12, color: importCategories.includes(cat.key) ? 'var(--neon-blue)' : 'var(--text-secondary)' }}>
                                                        {cat.icon} {cat.label}
                                                    </span>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: importCategories.includes(cat.key) ? 'var(--neon-blue)' : 'var(--text-muted)' }}>
                                                        {cat.count}
                                                    </span>
                                                </div>
                                                {importCategories.includes(cat.key) && cat.items.length > 0 && (
                                                    <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                                        {cat.items.slice(0, 5).map(item => (
                                                            <div key={item.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                · {item.name}
                                                            </div>
                                                        ))}
                                                        {cat.items.length > 5 && <div>...还有 {cat.items.length - 5} 项</div>}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {importCategories.length > 0 && (
                                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--neon-green)' }}>
                                            将导入 {importCategories.length} 类设定
                                        </div>
                                    )}
                                </div>
                            )}

                            {!importSourceProjectId && (
                                <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                                    💡 选择已有项目可直接导入人物、势力、世界观、背景、剧情、元素等完整设定，缺少的部分可以在创建后手动补充
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                            <button className="cyber-btn" onClick={() => setShowCreateFranchise(false)}>取消</button>
                            <button className="cyber-btn cyber-btn-primary" onClick={createFranchise} disabled={!franchiseForm.name.trim()}>创建世界观</button>
                        </div>
                    </div>
                </div>
            )}

            {showCreateProduct && (
                <div className="cyber-modal-overlay" onClick={() => setShowCreateProduct(null)}>
                    <div className="cyber-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '85vh', overflow: 'auto' }}>
                        <h2>📖 创建新产品</h2>
                        <div className="form-group">
                            <label className="form-label">产品名称 *</label>
                            <input className="cyber-input" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} placeholder="如：第二部、外传、前传..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">目标章节数</label>
                            <input className="cyber-input" type="number" value={productForm.targetChapters} onChange={e => setProductForm({ ...productForm, targetChapters: parseInt(e.target.value) || 100 })} min={1} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">新系列焦点（可选）</label>
                            <textarea className="cyber-textarea" value={productForm.newSeriesFocus} onChange={e => setProductForm({ ...productForm, newSeriesFocus: e.target.value })} placeholder="描述这部新作品的焦点，如：以XX角色为主角、讲述XX时间线的故事..." rows={3} />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
                                <input type="checkbox" checked={productForm.importWorldview}
                                    onChange={e => setProductForm({ ...productForm, importWorldview: e.target.checked })} />
                                🌍 导入完整世界观（世界观素材 + 地点 + 地图节点）
                            </label>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, paddingLeft: 24 }}>
                                勾选后将从前作复制世界观设定、地点素材和世界地图到新产品
                            </div>
                        </div>

                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <label className="form-label" style={{ marginBottom: 0 }}>继承角色（可选）</label>
                                <button className="cyber-btn cyber-btn-sm" onClick={selectAllCharacters}>
                                    {selectedCharacters.length === availableCharacters.length ? '取消全选' : '全选'}
                                </button>
                            </div>
                            {loadingChars ? <div style={{ padding: 20, textAlign: 'center' }}>加载角色中...</div> : availableCharacters.length === 0 ? (
                                <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)' }}>该世界观下暂无角色，请先在现有产品中创建角色</div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 200, overflow: 'auto', padding: 8, background: 'var(--bg-input)', borderRadius: 6 }}>
                                    {availableCharacters.map(c => (
                                        <button key={c.id} type="button" className={`cyber-btn cyber-btn-sm ${selectedCharacters.includes(c.id) ? 'cyber-btn-primary' : ''}`} style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: 11 }} onClick={() => toggleCharacter(c.id)} title={c.sourceProjectName}>
                                            ✓ {c.name} <span style={{ opacity: 0.5, fontSize: 10 }}>({c.sourceProjectName})</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {selectedCharacters.length > 0 && (
                                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--neon-blue)' }}>已选择 {selectedCharacters.length} 个角色，将自动继承其设定和关系</div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                            <button className="cyber-btn" onClick={() => setShowCreateProduct(null)}>取消</button>
                            <button className="cyber-btn cyber-btn-primary" onClick={createProduct} disabled={!productForm.name.trim() || creatingProduct}>
                                {creatingProduct ? '创建中...' : '创建产品'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
