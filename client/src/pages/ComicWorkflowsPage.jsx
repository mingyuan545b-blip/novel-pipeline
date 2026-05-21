import { useState, useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import { comicApi } from '../services/api';

const WORKFLOW_TYPES = [
    { value: 'character', label: '角色生成', icon: '👤', color: 'var(--neon-pink)' },
    { value: 'scene', label: '场景生成', icon: '🏔', color: 'var(--neon-blue)' },
    { value: 'storyboard', label: '分镜生成', icon: '▦', color: 'var(--neon-green)' },
    { value: 'style-transfer', label: '风格迁移', icon: '◈', color: 'var(--neon-purple)' },
    { value: 'upscaler', label: '超分辨率', icon: '⬡', color: 'var(--neon-orange)' },
    { value: 'custom', label: '自定义', icon: '⚙', color: 'var(--text-secondary)' }
];

export default function ComicWorkflowsPage() {
    const { currentProject } = useAppStore();
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showUpload, setShowUpload] = useState(false);

    const [newWorkflow, setNewWorkflow] = useState({
        name: '',
        type: 'character',
        description: '',
        jsonContent: '',
        file: null,
        params: {}
    });

    useEffect(() => {
        loadWorkflows();
    }, [currentProject]);

    const loadWorkflows = async () => {
        setLoading(true);
        try {
            const projectId = currentProject?.id || 'default';
            const res = await comicApi.getWorkflows(projectId);
            setWorkflows(res.data || []);
        } catch (e) {
            setWorkflows([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWorkflow = async () => {
        if (!newWorkflow.name.trim()) { alert('请输入工作流名称'); return; }
        setLoading(true);
        try {
            const projectId = currentProject?.id || 'default';
            if (newWorkflow.file) {
                const formData = new FormData();
                formData.append('name', newWorkflow.name);
                formData.append('type', newWorkflow.type);
                formData.append('description', newWorkflow.description);
                formData.append('projectId', projectId);
                formData.append('file', newWorkflow.file);
                await comicApi.uploadWorkflow(formData);
            } else {
                await comicApi.createWorkflow({
                    ...newWorkflow,
                    projectId
                });
            }
            setNewWorkflow({ name: '', type: 'character', description: '', jsonContent: '', file: null, params: {} });
            setShowUpload(false);
            await loadWorkflows();
        } catch (e) {
            alert('创建失败: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteWorkflow = async (id) => {
        if (!confirm('确定删除此工作流？')) return;
        try {
            await comicApi.deleteWorkflow(id);
            await loadWorkflows();
        } catch (e) {
            alert('删除失败: ' + e.message);
        }
    };

    const handleImportJson = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target.result);
                setNewWorkflow(prev => ({ ...prev, jsonContent: JSON.stringify(json, null, 2) }));
            } catch {
                setNewWorkflow(prev => ({ ...prev, jsonContent: ev.target.result }));
            }
        };
        reader.readAsText(file);
    };

    const getTypeInfo = (type) => WORKFLOW_TYPES.find(t => t.value === type) || WORKFLOW_TYPES[5];

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">工作流管理</h1>
                <p className="page-subtitle">管理 ComfyUI 工作流，支持导入 JSON 文件或直接粘贴工作流定义</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {WORKFLOW_TYPES.map(type => {
                        const count = workflows.filter(w => w.type === type.value).length;
                        return (
                            <span key={type.value} className="cyber-badge" style={{ borderColor: type.color, color: type.color }}>
                                {type.icon} {type.label} ({count})
                            </span>
                        );
                    })}
                </div>
                <button className="cyber-btn cyber-btn-primary" onClick={() => setShowUpload(!showUpload)}>
                    {showUpload ? '✕ 取消' : '+ 新建工作流'}
                </button>
            </div>

            {showUpload && (
                <div className="cyber-card" style={{ marginBottom: 20, borderColor: 'var(--neon-blue)' }}>
                    <h4 style={{ color: 'var(--neon-blue)', marginBottom: 16 }}>新建工作流</h4>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">工作流名称</label>
                            <input className="cyber-input" value={newWorkflow.name}
                                onChange={e => setNewWorkflow(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="例：角色立绘生成 v2" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">类型</label>
                            <select className="cyber-input" value={newWorkflow.type}
                                onChange={e => setNewWorkflow(prev => ({ ...prev, type: e.target.value }))}
                                style={{ width: '100%', padding: '8px 12px' }}>
                                {WORKFLOW_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">描述</label>
                        <input className="cyber-input" value={newWorkflow.description}
                            onChange={e => setNewWorkflow(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="工作流用途说明" />
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">上传工作流 JSON 文件</label>
                        <input type="file" accept=".json" onChange={e => {
                            if (e.target.files[0]) {
                                setNewWorkflow(prev => ({ ...prev, file: e.target.files[0] }));
                                handleImportJson(e);
                            }
                        }} style={{ color: 'var(--text-secondary)', fontSize: 13 }} />
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">或直接粘贴工作流 JSON</label>
                        <textarea className="cyber-textarea" value={newWorkflow.jsonContent}
                            onChange={e => setNewWorkflow(prev => ({ ...prev, jsonContent: e.target.value }))}
                            rows={10} placeholder='粘贴 ComfyUI 导出的 JSON 工作流...'
                            style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                    </div>

                    <button className="cyber-btn cyber-btn-primary" onClick={handleCreateWorkflow} disabled={loading}>
                        {loading ? <><span className="cyber-loading"></span> 创建中</> : '◈ 创建工作流'}
                    </button>
                </div>
            )}

            {workflows.length === 0 && !loading ? (
                <div className="cyber-card" style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>⬢</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>暂无工作流，点击"新建工作流"导入 ComfyUI 工作流 JSON</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {workflows.map(wf => {
                        const typeInfo = getTypeInfo(wf.type);
                        return (
                            <div key={wf.id} className="cyber-card" style={{ cursor: 'pointer' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 'var(--radius-md)',
                                            background: `rgba(${typeInfo.color === 'var(--neon-pink)' ? '255,0,255' : typeInfo.color === 'var(--neon-blue)' ? '0,240,255' : typeInfo.color === 'var(--neon-green)' ? '0,255,136' : typeInfo.color === 'var(--neon-purple)' ? '170,0,255' : '255,170,0'},0.1)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 20
                                        }}>
                                            {typeInfo.icon}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{wf.name}</div>
                                            <span className="cyber-badge" style={{ fontSize: 10, borderColor: typeInfo.color, color: typeInfo.color }}>
                                                {typeInfo.label}
                                            </span>
                                        </div>
                                    </div>
                                    <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-red)' }}
                                        onClick={(e) => { e.stopPropagation(); handleDeleteWorkflow(wf.id); }}>
                                        删除
                                    </button>
                                </div>
                                {wf.description && (
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                                        {wf.description}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                                    <span>节点数: {wf.nodeCount || '-'}</span>
                                    <span>更新: {new Date(wf.updatedAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
