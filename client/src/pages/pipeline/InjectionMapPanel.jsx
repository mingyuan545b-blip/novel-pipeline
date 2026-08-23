import { pipelineApi } from '../../services/api';
import logger from '../../shared/logger';
import s from './InjectionMapPanel.module.css';

export default function InjectionMapPanel({ currentProject, injectionMapInfo, setInjectionMapInfo }) {
    if (!injectionMapInfo) return null;

    const refreshMap = async () => {
        if (!currentProject) return;
        try {
            const res = await pipelineApi.getOutlineInjectionMap(currentProject.id);
            setInjectionMapInfo(res.data || res);
        } catch (e) { logger.error('InjectionMap', 'Save failed:', e.message); }
    };

    const handleToggleLock = async (sp) => {
        if (!currentProject) return;
        try {
            await pipelineApi.toggleMaterialLock({ materialId: sp.id, isLocked: !sp.isLocked });
            await refreshMap();
        } catch (e) { alert('操作失败: ' + e.message); }
    };

    const handleSetCurrent = async (sp) => {
        if (!currentProject) return;
        if (!confirm(`确认将第${sp.assignedVolume || injectionMapInfo.currentVolume}卷切换到「${sp.name}？\n这将锁定其他所有次位面并解锁此位面。`)) return;
        try {
            await pipelineApi.setVolumeSubplane({
                projectId: currentProject.id,
                volumeNumber: sp.assignedVolume || injectionMapInfo.currentVolume,
                subplaneId: sp.id
            });
            await refreshMap();
        } catch (e) { alert('切换失败: ' + e.message); }
    };

    return (
        <div className={s.panel}>
            <div className={s.header}>
                <span className={s.title}>🗺️ 大纲注入层级关系表 <span className={s.titleSub}>(点击🔒/🔓手动切换)</span></span>
                <div className={s.btnGroup}>
                    <button className={`cyber-btn cyber-btn-sm ${s.btnSm}`} onClick={refreshMap}>🔄刷新</button>
                    <button className={`cyber-btn cyber-btn-sm ${s.btnSm}`} onClick={() => setInjectionMapInfo(null)}>✕</button>
                </div>
            </div>
            <div className={s.statsGrid}>
                <div className={`${s.statCard} ${s.statCardCyan}`}>
                    <div className={`${s.statValue} ${s.statValueCyan}`}>第{injectionMapInfo.currentVolume}卷</div>
                    <div className={s.statLabel}>当前卷</div>
                </div>
                <div className={`${s.statCard} ${s.statCardGreen}`}>
                    <div className={`${s.statValue} ${s.statValueGreen}`}>{injectionMapInfo.currentVolumeSubplane?.name || '无'}</div>
                    <div className={s.statLabel}>当前卷次位面</div>
                </div>
                <div className={`${s.statCard} ${s.statCardOrange}`}>
                    <div className={`${s.statValue} ${s.statValueOrange}`}>{injectionMapInfo.injectedMaterialsCount}/{injectionMapInfo.totalMaterialsCount}</div>
                    <div className={s.statLabel}>注入/总素材</div>
                </div>
                <div className={`${s.statCard} ${s.statCardPurple}`}>
                    <div className={`${s.statValue} ${s.statValuePurple}`}>{injectionMapInfo.existingChapterCount}章</div>
                    <div className={s.statLabel}>已完成</div>
                </div>
            </div>
            {injectionMapInfo.debug && (
                <div className={s.debugPanel}>
                    <div className={s.debugTitle}>🔍 可见性决策调试</div>
                    <div className={s.debugGrid}>
                        <span>总素材: {injectionMapInfo.debug.totalMaterials}</span>
                        <span>过滤后: {injectionMapInfo.debug.filteredMaterials}</span>
                        <span>移除: {injectionMapInfo.debug.removedMaterials}</span>
                        <span>次位面总数: {injectionMapInfo.debug.subplaneCount}</span>
                        <span className={s.debugGreen}>解锁: {injectionMapInfo.debug.unlockedSubplanes?.join(', ') || '无'}</span>
                        <span className={s.debugRed}>锁定: {injectionMapInfo.debug.lockedSubplanes?.join(', ') || '无'}</span>
                    </div>
                </div>
            )}
            {injectionMapInfo.orphanChildren?.length > 0 && (
                <div className={s.orphanPanel}>
                    <div className={s.orphanTitle}>⚠️ 孤儿素材（parentPlane无法匹配次位面）</div>
                    {injectionMapInfo.orphanChildren.map(c => (
                        <div key={c.id} className={s.orphanItem}>
                            <span className={s.orphanName}>{c.name}</span>
                            <span className={s.orphanDetail}> [{c.type}] parentPlane=&quot;{c.parentPlane}&quot; → {c.issue}</span>
                            <span className={c.willBeInjected ? `${s.cellGreen} ${s.orphanInjected}` : `${s.cellRed} ${s.orphanFiltered}`}>{c.willBeInjected ? '⚠️会注入' : '🚫已过滤'}</span>
                        </div>
                    ))}
                </div>
            )}
            <table className={`cyber-table ${s.table}`}>
                <thead>
                    <tr><th>卷</th><th>次位面</th><th>锁定</th><th>注入</th><th>角色/势力/道具</th><th>parentPlane匹配</th><th>操作</th></tr>
                </thead>
                <tbody>
                    <tr className={s.rowMain}>
                        <td>-</td>
                        <td className={`${s.cellBold} ${s.cellGreen}`}>主世界</td>
                        <td>-</td>
                        <td className={s.cellGreen}>✅</td>
                        <td>{injectionMapInfo.mainWorldCharacters.map(c => (
                            <span key={c.id} className={`${s.tag} ${s.tagGreen}`}>{c.name}</span>
                        ))}</td>
                        <td className={s.cellMuted}>主世界</td>
                        <td>-</td>
                    </tr>
                    {injectionMapInfo.subplanes.sort((a, b) => (a.assignedVolume || 99) - (b.assignedVolume || 99)).map(sp => (
                        <tr key={sp.id} className={sp.isCurrentVolume ? s.rowCurrent : sp.isLocked ? s.rowLocked : ''}>
                            <td className={sp.isCurrentVolume ? `${s.cellBold} ${s.cellCyan}` : s.cellMuted}>
                                {sp.assignedVolume ? `V${sp.assignedVolume}` : '-'}
                            </td>
                            <td className={`${s.cellBold} ${sp.isCurrentVolume ? s.cellCyan : sp.isLocked ? s.cellRed : s.cellSecondary}`}>
                                {sp.isCurrentVolume && '▶ '}{sp.name}
                            </td>
                            <td>
                                <span className={`${s.lockIcon} ${sp.isLocked ? s.lockLocked : s.lockUnlocked}`}
                                    onClick={() => handleToggleLock(sp)} title={sp.isLocked ? '点击解锁' : '点击锁定'}>
                                    {sp.isLocked ? '🔒' : '🔓'}
                                </span>
                            </td>
                            <td className={sp.willBeInjected ? s.cellGreen : s.cellRed}>{sp.willBeInjected ? '✅' : '🚫'}</td>
                            <td>{sp.children.length > 0 ? sp.children.map(c => (
                                <span key={c.id} className={`${s.tag} ${c.willBeInjected ? s.tagGreen : s.tagRed} ${c.willBeInjected ? s.tagGreenText : s.tagRedText}`}>{c.name}</span>
                            )) : <span className={s.cellMuted}>-</span>}</td>
                            <td className={s.btnSm}>
                                {sp.children.length > 0 ? [...new Set(sp.children.map(c => c.parentPlaneMatch))].map(m => {
                                    const cls = m === 'id匹配' ? s.matchId : m === 'name匹配' ? s.matchName : m === '短名匹配' ? s.matchShort : s.matchNone;
                                    const textCls = m === '不匹配' ? s.matchNoneText : s.matchOtherText;
                                    return <span key={m} className={`${s.matchTag} ${cls} ${textCls}`}>{m}</span>;
                                }) : '-'}
                            </td>
                            <td>
                                <button className={`cyber-btn cyber-btn-sm ${s.setBtn}`} onClick={() => handleSetCurrent(sp)}>设为当前</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
