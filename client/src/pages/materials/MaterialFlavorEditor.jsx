import { flavorsApi } from '../../services/api';
import logger from '../../shared/logger';
import styles from './MaterialFlavorEditor.module.css';

export default function MaterialFlavorEditor({
    editForm, setEditForm, flavorPreview, setFlavorPreview,
    availableDialects, availableStyles, availableNamingStyles, availableArchetypes,
}) {
    return (
        <div className={styles.flavorContainer}>
            <div className={`${styles.sectionTitle} ${styles.sectionTitleCyan}`}>🎭 说话风味</div>
            <div className={styles.grid2}>
                <div className={`form-group ${styles.formGroupNoMargin}`}>
                    <label className={`form-label ${styles.labelSmall}`}>方言（你从哪来）</label>
                    <select className="cyber-select" value={editForm.dialectRegion || ''} onChange={e => setEditForm({ ...editForm, dialectRegion: e.target.value })}>
                        <option value="">无方言</option>
                        {availableDialects.map(d => <option key={d.region} value={d.region}>{d.label}</option>)}
                    </select>
                </div>
                <div className={`form-group ${styles.formGroupNoMargin}`}>
                    <label className={`form-label ${styles.labelSmall}`}>方言强度</label>
                    <select className="cyber-select" value={editForm.dialectIntensity || 'medium'} onChange={e => setEditForm({ ...editForm, dialectIntensity: e.target.value })} disabled={!editForm.dialectRegion}>
                        <option value="light">轻度（偶尔语气词）</option>
                        <option value="medium">中度（核心词汇替换）</option>
                        <option value="heavy">重度（全面方言化）</option>
                    </select>
                </div>
                <div className={`form-group ${styles.formGroupNoMargin}`}>
                    <label className={`form-label ${styles.labelSmall}`}>说话风格（你是谁）</label>
                    <select className="cyber-select" value={editForm.speechStyle || ''} onChange={e => setEditForm({ ...editForm, speechStyle: e.target.value })}>
                        <option value="">无风格</option>
                        {availableStyles.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                </div>
                <div className={`form-group ${styles.formGroupNoMargin}`}>
                    <label className={`form-label ${styles.labelSmall}`}>风格强度</label>
                    <select className="cyber-select" value={editForm.speechStyleIntensity || 'medium'} onChange={e => setEditForm({ ...editForm, speechStyleIntensity: e.target.value })} disabled={!editForm.speechStyle}>
                        <option value="light">轻度</option>
                        <option value="medium">中度</option>
                        <option value="heavy">重度</option>
                    </select>
                </div>
            </div>
            {(editForm.dialectRegion || editForm.speechStyle) && (
                <FlavorPreviewSection editForm={editForm} flavorPreview={flavorPreview} setFlavorPreview={setFlavorPreview} />
            )}
            {editForm.dialectRegion && editForm.speechStyle && (
                <div className={styles.comboHint}>
                    ⚡ 方言+风格组合：方言降为轻度底色，风格为主味
                </div>
            )}
            <NamingStyleSection editForm={editForm} setEditForm={setEditForm} flavorPreview={flavorPreview} setFlavorPreview={setFlavorPreview} availableNamingStyles={availableNamingStyles} />
            <ArchetypeSection editForm={editForm} setEditForm={setEditForm} flavorPreview={flavorPreview} setFlavorPreview={setFlavorPreview} availableArchetypes={availableArchetypes} />
        </div>
    );
}

function FlavorPreviewSection({ editForm, flavorPreview, setFlavorPreview }) {
    return (
        <div className={styles.previewWrapper}>
            <button className={`cyber-btn cyber-btn-sm ${styles.previewButton}`} onClick={async () => {
                try {
                    const res = await flavorsApi.previewCombined({
                        dialectRegion: editForm.dialectRegion || undefined,
                        dialectIntensity: editForm.dialectIntensity || undefined,
                        speechStyle: editForm.speechStyle || undefined,
                        speechStyleIntensity: editForm.speechStyleIntensity || undefined,
                        charName: editForm.name || '角色'
                    });
                    setFlavorPreview(res.data);
                } catch { setFlavorPreview({ error: '预览加载失败' }); }
            }}>👁 预览效果</button>
            {flavorPreview && !flavorPreview.error && (
                <div className={styles.previewBox}>
                    {flavorPreview.parts?.map((p, i) => (
                        <div key={i} className={styles.previewItem}>
                            {p.type === 'dialect' && <><span className={styles.previewLabelCyan}>🗣 {p.label}({p.intensity})</span><div className={styles.previewExample}>"{p.example}"</div></>}
                            {p.type === 'style' && <><span className={styles.previewLabelOrange}>🎭 {p.label}({p.intensity})</span><div className={styles.previewExample}>"{p.example}"</div></>}
                            {p.type === 'combined' && <div className={styles.previewCombined}>⚡ {p.note}</div>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function NamingStyleSection({ editForm, setEditForm, flavorPreview, setFlavorPreview, availableNamingStyles }) {
    if (editForm.type !== 'character') return null;
    return (
        <div className={styles.namingContainer}>
            <div className={`${styles.sectionTitle} ${styles.sectionTitleOrange}`}>✒️ 命名规范</div>
            <div className={styles.grid2}>
                <div className={`form-group ${styles.formGroupNoMargin}`}>
                    <label className={`form-label ${styles.labelSmall}`}>命名风格</label>
                    <select className="cyber-select" value={editForm.namingStyle || ''} onChange={e => setEditForm({ ...editForm, namingStyle: e.target.value })}>
                        <option value="">自动推断</option>
                        {availableNamingStyles.map(s => <option key={s.id} value={s.id}>{s.label}（{s.tag}）</option>)}
                    </select>
                </div>
                <div className={`form-group ${styles.formGroupNoMargin}`}>
                    <label className={`form-label ${styles.labelSmall}`}>命名强度</label>
                    <select className="cyber-select" value={editForm.namingStyleIntensity || 'medium'} onChange={e => setEditForm({ ...editForm, namingStyleIntensity: e.target.value })} disabled={!editForm.namingStyle}>
                        <option value="light">轻度</option>
                        <option value="medium">中度</option>
                        <option value="heavy">重度</option>
                    </select>
                </div>
            </div>
            {editForm.namingStyle && (
                <button className={`cyber-btn cyber-btn-sm ${styles.namingPreviewButton}`} onClick={async () => {
                    try {
                        const res = await flavorsApi.previewNamingStyle(editForm.namingStyle, editForm.namingStyleIntensity || 'medium');
                        setFlavorPreview(prev => ({ ...prev, namingPreview: res.data }));
                    } catch (err) { logger.warn('FlavorEditor', 'Preview naming failed:', err.message); }
                }}>👁 预览命名规范</button>
            )}
            {flavorPreview?.namingPreview && (
                <div className={styles.namingPreviewBox}>
                    {flavorPreview.namingPreview.prompt?.substring(0, 500)}
                </div>
            )}
        </div>
    );
}

function ArchetypeSection({ editForm, setEditForm, flavorPreview, setFlavorPreview, availableArchetypes }) {
    return (
        <div className={styles.archetypeContainer}>
            <div className={`${styles.sectionTitle} ${styles.sectionTitlePurple}`}>🃏 人设模板</div>
            <div className={styles.grid1}>
                <div className={`form-group ${styles.formGroupNoMargin}`}>
                    <label className={`form-label ${styles.labelSmall}`}>配角类型（你是哪种人）</label>
                    <select className="cyber-select" value={editForm.archetype || ''} onChange={e => setEditForm({ ...editForm, archetype: e.target.value })}>
                        <option value="">无特定模板</option>
                        {availableArchetypes.map(a => <option key={a.id} value={a.id}>{a.label}（{a.tag}）</option>)}
                    </select>
                </div>
            </div>
            {editForm.archetype && (() => {
                const selArch = availableArchetypes.find(a => a.id === editForm.archetype);
                return selArch ? (
                    <div className={styles.archetypeInfo}>
                        <div className={styles.archetypeDesc}>📋 {selArch.description}</div>
                        <div>角色功能：{selArch.roleInStory}</div>
                        {selArch.recommendedSpeechStyles?.length > 0 && <div className={styles.archetypeDetail}>推荐风格：{selArch.recommendedSpeechStyles.join('、')}</div>}
                        {selArch.recommendedDialects?.length > 0 && <div className={styles.archetypeDetail}>推荐方言：{selArch.recommendedDialects.join('、')}</div>}
                        <button className={`cyber-btn cyber-btn-sm ${styles.archetypePreviewButton}`} onClick={async () => {
                            try {
                                const res = await flavorsApi.previewCharacterArchetype(editForm.archetype);
                                setFlavorPreview(prev => ({ ...prev, archetypePreview: res.data }));
                            } catch (err) { logger.warn('FlavorEditor', 'Preview naming failed:', err.message); }
                        }}>👁 预览四维描写</button>
                        {flavorPreview?.archetypePreview && (
                            <div className={styles.archetypePreviewBox}>
                                {flavorPreview.archetypePreview.writerPrompt?.substring(0, 800)}
                            </div>
                        )}
                    </div>
                ) : null;
            })()}
        </div>
    );
}
