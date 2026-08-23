import { useState } from 'react';
import s from './worldviewProfile.module.css';

export default function WorldviewProfileCard({ dragHandleProps, currentProject, profiles, loading,
    showSaveModal, setShowSaveModal, saveForm, setSaveForm, saving, applyingId,
    saveFromProject, applyToProject, deleteProfile }) {
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    return (
        <div className="cyber-card">
            <div className="card-header" {...dragHandleProps}>
                <span>🌍 世界观模板</span>
                {currentProject && (
                    <button className="cyber-btn cyber-btn-sm" onClick={() => setShowSaveModal(true)}>
                        保存当前
                    </button>
                )}
            </div>
            <div className="card-body">
                {loading && <div className="text-muted">加载中...</div>}
                {!loading && profiles.length === 0 && (
                    <div className="text-muted">暂无模板。可将当前项目配置保存为模板，快速应用到新项目。</div>
                )}
                {profiles.map(p => (
                    <div key={p.id} className={s.profileItem}>
                        <div className={s.profileInfo}>
                            <div className={s.profileName}>{p.name}</div>
                            {p.description && <div className={s.profileDesc}>{p.description}</div>}
                            <div className={s.profileMeta}>
                                {p.createdAt && new Date(p.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                        <div className={s.profileActions}>
                            {currentProject && (
                                <button className="cyber-btn cyber-btn-sm"
                                    disabled={applyingId === p.id}
                                    onClick={() => applyToProject(p.id)}>
                                    {applyingId === p.id ? '应用中...' : '应用'}
                                </button>
                            )}
                            {confirmDeleteId === p.id ? (
                                <button className="cyber-btn cyber-btn-sm cyber-btn-danger"
                                    onClick={() => { deleteProfile(p.id); setConfirmDeleteId(null); }}>
                                    确认删除
                                </button>
                            ) : (
                                <button className="cyber-btn cyber-btn-sm"
                                    onClick={() => setConfirmDeleteId(p.id)}>
                                    删除
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {showSaveModal && (
                <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>保存为世界观模板</h3>
                        <p className="text-muted">将当前项目的约束、风格、Agent配置和素材保存为可复用模板</p>
                        <div className="form-group">
                            <label>模板名称</label>
                            <input className="cyber-input" value={saveForm.name}
                                onChange={e => setSaveForm(f => ({ ...f, name: e.target.value }))}
                                placeholder={currentProject?.name || '模板名称'} />
                        </div>
                        <div className="form-group">
                            <label>描述</label>
                            <textarea className="cyber-input" rows={2} value={saveForm.description}
                                onChange={e => setSaveForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="可选描述" />
                        </div>
                        <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
                            <button className="cyber-btn" onClick={() => setShowSaveModal(false)}>取消</button>
                            <button className="cyber-btn cyber-btn-primary" disabled={saving}
                                onClick={saveFromProject}>
                                {saving ? '保存中...' : '保存'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
