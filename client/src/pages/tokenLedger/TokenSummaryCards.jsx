/**
 * TokenSummaryCards.jsx — 顶部总览卡片
 * 用"看得懂的话"讲三件事：花了多少、效率如何、哪里漏了。
 */
import { formatTokens, formatExact, formatPct, humanScale, efficiencyColor } from './tokenLedgerFormat';
import s from './tokenLedger.module.css';

function Card({ icon, label, value, unit, sub, color, title }) {
    return (
        <div className={s.statCard} title={title}>
            <div className={s.statHead}><span className={s.statIcon}>{icon}</span>{label}</div>
            <div className={s.statValue} style={color ? { color } : undefined}>
                {value}<span className={s.statUnit}>{unit}</span>
            </div>
            {sub && <div className={s.statSub}>{sub}</div>}
        </div>
    );
}

export default function TokenSummaryCards({ totals, chapterCount }) {
    if (!totals) return null;
    const truncated = totals.truncatedCount || 0;
    return (
        <div className={s.statGrid}>
            <Card icon="🎯" label="累计消耗" value={formatTokens(totals.totalTokens)}
                unit="tokens" sub={humanScale(totals.totalTokens)}
                title={`精确值：${formatExact(totals.totalTokens)}`} />
            <Card icon="📖" label="覆盖章节" value={totals.chapters || chapterCount || 0} unit="章"
                sub={`共 ${formatExact(totals.calls)} 次模型调用`} />
            <Card icon="⚡" label="每千字消耗" value={formatTokens(totals.tokensPerKChar)} unit="tokens"
                color={efficiencyColor(totals.tokensPerKChar)}
                sub={`产出正文 ${formatExact(totals.wordCount)} 字（越低越省）`} />
            <Card icon="♻️" label="缓存命中" value={formatPct(totals.cacheHitRate)} unit=""
                color="#22c55e" sub={`${formatTokens(totals.cachedTokens)} tokens 走了缓存（单价更低）`}
                title="命中缓存的提示词部分通常按更低单价计费" />
            <Card icon={truncated > 0 ? '✂️' : '✅'} label="被截断的分段" value={truncated} unit="处"
                color={truncated > 0 ? '#f59e0b' : '#22c55e'}
                sub={truncated > 0 ? `共丢失约 ${formatTokens(totals.lostTokens)} tokens，规则可能失效` : '没有内容被预算砍掉'} />
        </div>
    );
}
