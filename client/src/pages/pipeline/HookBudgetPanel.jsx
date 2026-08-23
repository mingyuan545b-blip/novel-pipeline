import { pipelineApi } from '../../services/api';
import logger from '../../shared/logger';
import s from './HookBudgetPanel.module.css';

const BUDGET_VALUE_CLASS = {
    over: s.statValueOver,
    near: s.statValueNear,
    ok: s.statValueOk,
};

function getBudgetState(b) {
    if (b.overCapacity) return 'over';
    if (b.nearCapacity) return 'near';
    return 'ok';
}

export default function HookBudgetPanel({ currentProject, selectedChapter, chapters, hookBudgetInfo, setHookBudgetInfo }) {
    const refresh = async () => {
        if (!currentProject) return;
        try {
            const chNum = selectedChapter?.chapterNumber || chapters.filter(c => c.content).length || 0;
            const res = await pipelineApi.getHookBudget(currentProject.id, chNum);
            setHookBudgetInfo(res.data);
        } catch (e) { logger.error('HookBudget', 'Refresh failed:', e.message); }
    };

    const budgetCardClass = () => {
        if (!hookBudgetInfo) return s.statCardOk;
        const b = hookBudgetInfo.budget;
        if (b.overCapacity) return s.statCardOver;
        if (b.nearCapacity) return s.statCardNear;
        return s.statCardOk;
    };

    return (
        <div className={s.hookBudgetPanel}>
            <div className={s.panelHeader}>
                <span className={s.panelTitle}>🪝 伏笔预算 (Hook Budget)</span>
                <button className={`cyber-btn cyber-btn-sm ${s.refreshBtn}`} onClick={refresh}>刷新</button>
            </div>
            {hookBudgetInfo ? (
                <div>
                    <div className={s.statsGrid}>
                        <div className={budgetCardClass()}>
                            <div className={`${s.statValue} ${BUDGET_VALUE_CLASS[getBudgetState(hookBudgetInfo.budget)]}`}>
                                {hookBudgetInfo.budget.activeCount}/{hookBudgetInfo.budget.maxCapacity}
                            </div>
                            <div className={s.statLabel}>活跃伏笔</div>
                        </div>
                        <div className={s.statCardBlue}>
                            <div className={`${s.statValue} ${s.statValueBlue}`}>{hookBudgetInfo.budget.remaining}</div>
                            <div className={s.statLabel}>剩余坑位</div>
                        </div>
                        <div className={hookBudgetInfo.budget.staleCount > 0 ? s.statCardStale : s.statCardNoStale}>
                            <div className={`${s.statValue} ${hookBudgetInfo.budget.staleCount > 0 ? s.statValueStale : s.statValueNoStale}`}>
                                {hookBudgetInfo.budget.staleCount}
                            </div>
                            <div className={s.statLabel}>过期</div>
                        </div>
                    </div>
                    {hookBudgetInfo.agenda.mustAdvance?.length > 0 && (
                        <div className={s.agendaItem}>
                            <span className={s.agendaLabelOver}>必须推进:</span> {hookBudgetInfo.agenda.mustAdvance.map(h => h.id).join(', ')}
                        </div>
                    )}
                    {hookBudgetInfo.agenda.eligibleResolve?.length > 0 && (
                        <div className={s.agendaItem}>
                            <span className={s.agendaLabelResolve}>可回收</span> {hookBudgetInfo.agenda.eligibleResolve.map(h => h.id).join(', ')}
                        </div>
                    )}
                    {hookBudgetInfo.agenda.staleDebt?.length > 0 && (
                        <div className={s.agendaItem}>
                            <span className={s.agendaLabelStale}>🚨过期:</span> {hookBudgetInfo.agenda.staleDebt.map(h => `${h.id}(${h.age}`).join(', ')}
                        </div>
                    )}
                    {hookBudgetInfo.summary.hooks.length > 0 && (
                        <div className={s.hooksList}>
                            {hookBudgetInfo.summary.hooks.map(h => (
                                <div key={h.id} className={s.hookRow}>
                                    <span className={h.status === 'resolved' ? s.hookStatusResolved : s.hookStatusActive}>{h.status === 'resolved' ? '✅已解决' : '⏳进行中'}</span>
                                    <span className={s.hookName}>{h.id}</span>
                                    <span className={s.hookType}>{h.type}</span>
                                    <span className={s.hookNotes}>{h.notes}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className={s.emptyHint}>点击"刷新"加载伏笔预算数据</div>
            )}
        </div>
    );
}
