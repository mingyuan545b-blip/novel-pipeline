import s from './library.module.css';
import logger from '../../shared/logger';
import { libraryApi } from '../../services/api';

const RANK_LIMIT = 5;

/** 单条技法成功率条：显示技法名（后端已回填），ID 降级为 tooltip */
function RateBar({ tech }) {
    const pct = parseFloat(tech.successRate) || 0;
    const color = pct >= 70 ? '#2ed573' : pct >= 40 ? '#ffa502' : '#ff4757';
    const label = tech.name || tech.techniqueId;
    const dept = (tech.department || '').replace(/^\d+_/, '');
    return (
        <div className={s.fbRow}>
            <span className={s.fbLabel} title={`${label}（${tech.techniqueId}）`}>
                {label}
                {dept && <em className={s.fbDept}>{dept}</em>}
            </span>
            <div className={s.fbBarTrack}>
                <div className={s.fbBarFill} style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className={s.fbRate} style={{ color }}>{tech.successRate}%</span>
        </div>
    );
}

export default function FeedbackPanel({ feedbackData, projectId, onRefresh }) {
    if (!projectId) return <div className={s.fbEmpty}>选择项目后查看技法反馈</div>;

    const techniques = feedbackData?.techniques || [];
    if (!techniques.length) return <div className={s.fbEmpty}>暂无反馈数据</div>;

    const top5 = techniques.slice(0, RANK_LIMIT);
    // 尾部排名排除已在 Top 中出现的条目，避免技法总数不足 10 条时两栏重复展示同一条
    const topIds = new Set(top5.map(t => t.techniqueId));
    const bottom5 = [...techniques]
        .sort((a, b) => parseFloat(a.successRate) - parseFloat(b.successRate))
        .filter(t => !topIds.has(t.techniqueId))
        .slice(0, RANK_LIMIT);

    const handleClear = async () => {
        if (!confirm('确认清除该项目的所有技法反馈数据？')) return;
        try {
            await libraryApi.deleteFeedback(projectId);
            onRefresh?.();
        } catch (e) { logger.warn('FeedbackPanel', 'Clear failed:', e.message); }
    };

    return (
        <div className={s.fbPanel}>
            <div className="flex-between mb-8">
                <h4 className={s.fbTitle}>技法反馈统计</h4>
                <div className="flex gap-8 items-center">
                    <span className={s.fbMeta}>{feedbackData.totalRecords}条记录</span>
                    <button onClick={onRefresh} className={s.toolbarBtn}>刷新</button>
                    <button onClick={handleClear} className={s.resetBtn}>清除</button>
                </div>
            </div>
            <div className="grid-2" style={{ gap: 16 }}>
                <div>
                    <div className={s.fbSectionTitle}>Top {RANK_LIMIT} 成功率</div>
                    {top5.map(t => <RateBar key={t.techniqueId} tech={t} />)}
                </div>
                {bottom5.length > 0 && (
                    <div>
                        <div className={s.fbSectionTitle}>Bottom {RANK_LIMIT} 成功率</div>
                        {bottom5.map(t => <RateBar key={t.techniqueId} tech={t} />)}
                    </div>
                )}
            </div>
        </div>
    );
}
