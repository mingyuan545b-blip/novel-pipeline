import { MATERIAL_TYPE_LABELS, ARCHIVE_STATUS_LABELS, ARCHIVE_STATUS_COLORS, FIELD_COLORS, toBeijingTime } from './materialConstants';
import { materialsApi } from '../../services/api';
import MaterialFlavorEditor from './MaterialFlavorEditor';
import styles from './MaterialEditor.module.css';

export default function MaterialEditor({
    mat, filteredMaterials, isEditing, editForm, setEditForm,
    startEdit, saveEdit, deleteMaterial, setIsEditing,
    showHistoryFor, setShowHistoryFor, goToChapter,
    availableDialects, availableStyles, availableNamingStyles, availableArchetypes,
    flavorPreview, setFlavorPreview, currentProject: _currentProject, onRefresh
}) {
    if (!mat) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📄</div>
                <div className={styles.emptyText}>点击左侧素材查看详情</div>
            </div>
        );
    }

    const archivedColor = ARCHIVE_STATUS_COLORS[mat.status] || 'var(--neon-red)';

    return (
        <div className={`cyber-card ${mat.archived ? styles.cardArchived : ''}`} style={mat.archived ? { '--archived-color': archivedColor } : {}}>
            <div className={styles.headerRow}>
                <div>
                    <h3 className={styles.titleMain}>{mat.name}</h3>
                    <div className={styles.metaInfo}>
                        {MATERIAL_TYPE_LABELS[mat.type] || mat.type} · v{mat.version} · {mat.isLocked ? '🔒 锁定' : '可编辑'}
                        {mat.archived && <span className={styles.archiveStatus} style={{ '--archived-color': archivedColor }}>{ARCHIVE_STATUS_LABELS[mat.status] || mat.status}</span>}
                    </div>
                </div>
                <div className={styles.buttonGroup}>
                    {!mat.archived && !isEditing && <button className="cyber-btn cyber-btn-sm" onClick={() => startEdit(mat)}>编辑</button>}
                    {(mat.changeLog?.length > 0) && <button className={`cyber-btn cyber-btn-sm ${styles.btnPurple}`} onClick={() => setShowHistoryFor(showHistoryFor === mat.id ? null : mat.id)}>📋 变更({mat.changeLog.length})</button>}
                    {!mat.archived && !isEditing && <button className={`cyber-btn cyber-btn-sm ${styles.btnOrange}`} onClick={async () => { const reason = prompt('归档原因：'); if (!reason) return; await materialsApi.update(mat.id, { archived: true, status: reason, archivedReason: reason }); onRefresh?.(); }}>归档</button>}
                    {mat.archived && <button className={`cyber-btn cyber-btn-sm ${styles.btnGreen}`} onClick={async () => { await materialsApi.update(mat.id, { archived: false, status: 'active', archivedReason: '' }); onRefresh?.(); }}>恢复</button>}
                    {!mat.isLocked && !mat.archived && !isEditing && <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={() => deleteMaterial(mat.id)}>删除</button>}
                </div>
            </div>

            {mat.archived && mat.archivedReason && (
                <div className={styles.archiveReason}>
                    原因: {mat.archivedReason}
                    {mat.archivedAt && <span className={styles.archiveTime}>{new Date(mat.archivedAt).toLocaleString('zh-CN')}</span>}
                </div>
            )}

            {isEditing && editForm ? (
                <div>
                    <div className="form-group"><label className="form-label">名称</label><input className="cyber-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
                    <div className="form-group"><label className="form-label">类型</label><select className="cyber-select" value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>{Object.entries(MATERIAL_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                    {editForm.type === 'character' && (
                        <MaterialFlavorEditor
                            editForm={editForm} setEditForm={setEditForm}
                            flavorPreview={flavorPreview} setFlavorPreview={setFlavorPreview}
                            availableDialects={availableDialects} availableStyles={availableStyles}
                            availableNamingStyles={availableNamingStyles} availableArchetypes={availableArchetypes}
                        />
                    )}
                    <div className="form-group"><label className="form-label">当前内容</label><textarea className="cyber-textarea" value={editForm.currentContent} onChange={e => setEditForm({ ...editForm, currentContent: e.target.value })} rows={10} /></div>
                    <div className="form-group"><label className="form-label">变更原因</label><input className="cyber-input" value={editForm.changeReason} onChange={e => setEditForm({ ...editForm, changeReason: e.target.value })} placeholder="记录变更原因..." /></div>
                    <div className={styles.editActions}><button className="cyber-btn cyber-btn-success cyber-btn-sm" onClick={saveEdit}>保存</button><button className="cyber-btn cyber-btn-sm" onClick={() => setIsEditing(false)}>取消</button></div>
                </div>
            ) : (
                <MaterialViewMode
                    mat={mat} filteredMaterials={filteredMaterials}
                    showHistoryFor={showHistoryFor} setShowHistoryFor={setShowHistoryFor}
                    goToChapter={goToChapter}
                    availableDialects={availableDialects} availableStyles={availableStyles}
                    availableNamingStyles={availableNamingStyles} availableArchetypes={availableArchetypes}
                />
            )}
        </div>
    );
}

function MaterialViewMode({ mat, filteredMaterials, showHistoryFor, setShowHistoryFor: _setShowHistoryFor, goToChapter, availableDialects, availableStyles, availableNamingStyles, availableArchetypes }) {
    const planeLabel = mat.parentPlane && mat.parentPlane !== '主世界'
        ? (filteredMaterials.find(m => m.id === mat.parentPlane)?.name || mat.parentPlane)
        : (mat.parentPlane === '主世界' ? '主世界' : null);
    const factionLabel = mat.parentFaction
        ? (filteredMaterials.find(m => m.id === mat.parentFaction)?.name || mat.parentFaction)
        : null;

    return (
        <>
            {(planeLabel || factionLabel || mat.dialectRegion || mat.speechStyle || mat.namingStyle || mat.archetype) && (
                <div className={styles.tagBar}>
                    {planeLabel && <span className={`${styles.tag} ${styles.tagCyan}`}>🌀 {planeLabel}</span>}
                    {factionLabel && <span className={`${styles.tag} ${styles.tagOrange}`}>🏛 {factionLabel}</span>}
                    {mat.dialectRegion && <span className={`${styles.tag} ${styles.tagGreen}`}>🗣 {availableDialects.find(d => d.region === mat.dialectRegion)?.label || mat.dialectRegion}</span>}
                    {mat.speechStyle && <span className={`${styles.tag} ${styles.tagPink}`}>🎭 {availableStyles.find(s => s.id === mat.speechStyle)?.label || mat.speechStyle}</span>}
                    {mat.namingStyle && <span className={`${styles.tag} ${styles.tagOrange}`}>✒️ {availableNamingStyles.find(s => s.id === mat.namingStyle)?.label || mat.namingStyle}</span>}
                    {mat.archetype && <span className={`${styles.tag} ${styles.tagPurple}`}>🃏 {availableArchetypes.find(a => a.id === mat.archetype)?.label || mat.archetype}</span>}
                </div>
            )}
            <ContentDisplay content={mat.currentContent} />
            {mat.initialContent && mat.initialContent !== mat.currentContent && (
                <details className={styles.initialContentDetails}>
                    <summary className={styles.initialContentSummary}>查看初始内容</summary>
                    <div className={styles.initialContentBox}>{mat.initialContent}</div>
                </details>
            )}
            {showHistoryFor === mat.id && mat.changeLog?.length > 0 && (
                <ChangeLog changeLog={mat.changeLog} goToChapter={goToChapter} />
            )}
            {mat.tags?.length > 0 && (
                <div className={styles.tagList}>
                    {mat.tags.map((tag, i) => <span key={i} className="cyber-tag">{tag}</span>)}
                </div>
            )}
        </>
    );
}

function ContentDisplay({ content }) {
    if (!content) return <div className={styles.contentEmpty}>(空)</div>;
    const fieldRegex = /【([^】]+)】/g;
    const parts = content.split(fieldRegex);
    if (parts.length <= 1) {
        return <div className={styles.contentPlain}>{content}</div>;
    }
    const fields = [];
    let currentLabel = null;
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 1) { currentLabel = parts[i]; }
        else if (currentLabel && parts[i].trim()) { fields.push({ label: currentLabel, value: parts[i].trim() }); currentLabel = null; }
        else if (!currentLabel && parts[i].trim()) { fields.push({ label: null, value: parts[i].trim() }); }
    }
    return (
        <div className={styles.fieldList}>
            {fields.map((f, i) => (
                <div key={i} className={styles.fieldCard} style={{ '--field-color': FIELD_COLORS[f.label] || 'var(--border-color)' }}>
                    {f.label && <div className={styles.fieldLabel} style={{ '--field-color': FIELD_COLORS[f.label] || 'var(--text-muted)' }}>{f.label}</div>}
                    <div className={styles.fieldValue}>{f.value}</div>
                </div>
            ))}
        </div>
    );
}

function ChangeLog({ changeLog, goToChapter }) {
    return (
        <div className={styles.changeLog}>
            <div className={styles.changeLogTitle}>📋 变更记录</div>
            {[...changeLog].reverse().map((log, i) => (
                <div key={i} className={`${styles.changeLogItem} ${i === changeLog.length - 1 ? styles.changeLogItemLast : ''}`}>
                    <div className={styles.changeLogItemHeader}>
                        <span className={styles.changeLogTime}>{toBeijingTime(log.timestamp)}</span>
                        {log.chapterNumber && <button className={`cyber-btn cyber-btn-sm ${styles.changeLogChapterBtn}`} onClick={() => goToChapter(log.chapterNumber)}>📖 第{log.chapterNumber}章</button>}
                    </div>
                    <div className={styles.changeLogContent}>{log.chapterNumber ? `第${log.chapterNumber}章` : ''} {log.reason || '更新'}</div>
                </div>
            ))}
        </div>
    );
}
