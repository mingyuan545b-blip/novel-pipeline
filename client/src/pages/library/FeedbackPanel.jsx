import s from './library.module.css';
import logger from '../../shared/logger';
import { libraryApi } from '../../services/api';

const RANK_LIMIT = 5;

function RateBar({ rate, label }) {
    const pct = parseFloat(rate) || 0;
    const color = pct >= 70 ? '#2ed573' : pct >= 40 ? '#ffa502' : '#ff4757';
    return (
        <div className={s.fbRow}>
            <span className={s.fbLabel} title={label}>{label}</span>
            <div className={s.fbBarTrack}>
                <div className={s.fbBarFill} style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className={s.fbRate} style={{ color }}>{rate}%</span>
        </div>
    );
}

export default function FeedbackPanel({ feedbackData, projectId, onRefresh }) {
    if (!projectId) return <div className={s.fbEmpty}>选择项目后查看技法反馈</div>;

    const techniques = feedbackData?.techniques || [];
    if (!techniques.length) return <div className={s.fbEmpty}>暂无反馈数据</div>;

    const top5 = techniques.slice(0, RANK_LIMIT);
    const bottom5 = [...techniques].sort((a, b) => parseFloat(a.successRate) - parseFloat(b.successRate)).slice(0, RANK_LIMIT);

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
                    {top5.map(t => <RateBar key={t.techniqueId} rate={t.successRate} label={t.techniqueId} />)}
                </div>
                <div>
                    <div className={s.fbSectionTitle}>Bottom {RANK_LIMIT} 成功率</div>
                    {bottom5.map(t => <RateBar key={t.techniqueId} rate={t.successRate} label={t.techniqueId} />)}
                </div>
            </div>
        </div>
    );
}
