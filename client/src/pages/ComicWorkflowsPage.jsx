import useComicWorkflowsState from '../comic/useComicWorkflowsState';
import s from './ComicWorkflowsPage.module.css';

const WORKFLOW_TYPES = [
    { value: 'character', label: '角色生成', icon: '👤', color: 'var(--neon-pink)' },
    { value: 'scene', label: '场景生成', icon: '🏔', color: 'var(--neon-blue)' },
    { value: 'storyboard', label: '分镜生成', icon: '▦', color: 'var(--neon-green)' },
    { value: 'style-transfer', label: '风格迁移', icon: '◈', color: 'var(--neon-purple)' },
    { value: 'upscaler', label: '超分辨率', icon: '⬡', color: 'var(--neon-orange)' },
    { value: 'custom', label: '自定义', icon: '⚙', color: 'var(--text-secondary)' }
];

const TYPE_ICON_BG = {
    'var(--neon-pink)': 'rgba(255,0,255,0.1)',
    'var(--neon-blue)': 'rgba(0,240,255,0.1)',
    'var(--neon-green)': 'rgba(0,255,136,0.1)',
    'var(--neon-purple)': 'rgba(170,0,255,0.1)',
    'var(--neon-orange)': 'rgba(255,170,0,0.1)',
};

const getTypeInfo = (type) => WORKFLOW_TYPES.find(t => t.value === type) || WORKFLOW_TYPES[5];

export default function ComicWorkflowsPage() {
    const {
        workflows, loading, showUpload, setShowUpload,
        newWorkflow, setNewWorkflow,
        handleCreateWorkflow, handleDeleteWorkflow, handleImportJson
    } = useComicWorkflowsState();

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">工作流管理</h1>
                <p className="page-subtitle">管理 ComfyUI 工作流，支持导入 JSON 文件或直接粘贴工作流定义</p>
            </div>

            <div className={s.headerBar}>
                <div className={s.typeBadges}>
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
                <div className={`cyber-card ${s.uploadCard}`}>
                    <h4 className={s.uploadTitle}>新建工作流</h4>
                    <div className={s.uploadGrid}>
                        <div className="form-group">
                            <label className="form-label">工作流名称</label>
                            <input className="cyber-input" value={newWorkflow.name}
                                onChange={e => setNewWorkflow(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="例：角色立绘生成 v2" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">类型</label>
                            <select className={`cyber-input ${s.typeSelect}`} value={newWorkflow.type}
                                onChange={e => setNewWorkflow(prev => ({ ...prev, type: e.target.value }))}>
                                {WORKFLOW_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className={`form-group ${s.formGroupMb}`}>
                        <label className="form-label">描述</label>
                        <input className="cyber-input" value={newWorkflow.description}
                            onChange={e => setNewWorkflow(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="工作流用途说明" />
                    </div>
                    <div className={`form-group ${s.formGroupMb}`}>
                        <label className="form-label">上传工作流 JSON 文件</label>
                        <input type="file" accept=".json" onChange={e => {
                            if (e.target.files[0]) {
                                setNewWorkflow(prev => ({ ...prev, file: e.target.files[0] }));
                                handleImportJson(e);
                            }
                        }} className={s.fileInput} />
                    </div>
                    <div className={`form-group ${s.formGroupMb}`}>
                        <label className="form-label">或直接粘贴工作流 JSON</label>
                        <textarea className={`cyber-textarea ${s.jsonTextarea}`} value={newWorkflow.jsonContent}
                            onChange={e => setNewWorkflow(prev => ({ ...prev, jsonContent: e.target.value }))}
                            rows={10} placeholder='粘贴 ComfyUI 导出的 JSON 工作流...' />
                    </div>
                    <button className="cyber-btn cyber-btn-primary" onClick={handleCreateWorkflow} disabled={loading}>
                        {loading ? <><span className="cyber-loading"></span> 创建中</> : '◈ 创建工作流'}
                    </button>
                </div>
            )}

            {workflows.length === 0 && !loading ? (
                <div className={`cyber-card ${s.emptyState}`}>
                    <div className={s.emptyIcon}>⬢</div>
                    <div className={s.emptyText}>暂无工作流，点击"新建工作流"导入 ComfyUI 工作流 JSON</div>
                </div>
            ) : (
                <div className={s.workflowGrid}>
                    {workflows.map(wf => {
                        const typeInfo = getTypeInfo(wf.type);
                        const iconBg = TYPE_ICON_BG[typeInfo.color] || 'rgba(255,170,0,0.1)';
                        return (
                            <div key={wf.id} className={`cyber-card ${s.workflowCard}`}>
                                <div className={s.workflowHeader}>
                                    <div className={s.workflowInfo}>
                                        <div className={s.workflowIcon} style={{ background: iconBg }}>
                                            {typeInfo.icon}
                                        </div>
                                        <div>
                                            <div className={s.workflowName}>{wf.name}</div>
                                            <span className="cyber-badge" style={{ fontSize: 10, borderColor: typeInfo.color, color: typeInfo.color }}>
                                                {typeInfo.label}
                                            </span>
                                        </div>
                                    </div>
                                    <button className={`cyber-btn cyber-btn-sm ${s.deleteBtn}`}
                                        onClick={(e) => { e.stopPropagation(); handleDeleteWorkflow(wf.id); }}>
                                        删除
                                    </button>
                                </div>
                                {wf.description && <div className={s.workflowDesc}>{wf.description}</div>}
                                <div className={s.workflowMeta}>
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
