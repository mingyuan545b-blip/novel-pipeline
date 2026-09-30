/**
 * LibraryStatsBar — 藏经阁顶部数据条
 *
 * 目的：一眼看清"哪些有数据、哪些是空壳"。此前用户只能一条条点进去试
 * （2026-10-01 反馈）。数字可点，点了就按该完整度筛选。
 */
import { COMPLETENESS } from './libraryConstants';
import s from './library.module.css';

function Stat({ label, value, color, hint, onClick, active }) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag className={`${s.statCard} ${active ? s.statCardActive : ''}`} onClick={onClick} title={hint} type={onClick ? 'button' : undefined}>
            <span className={s.statNum} style={color ? { color } : undefined}>{value}</span>
            <span className={s.statName}>{label}</span>
        </Tag>
    );
}

export default function LibraryStatsBar({ counts, sourceCount, disabled, onPick }) {
    const total = counts.total || 0;
    return (
        <div className={s.statsBar}>
            <Stat label="技法总数" value={total} hint="库内全部写作技法条目" onClick={() => onPick?.('')} active={counts.active === ''} />
            <Stat label={COMPLETENESS.full.short} value={counts.full || 0} color={COMPLETENESS.full.color}
                hint={COMPLETENESS.full.hint} onClick={() => onPick?.('full')} active={counts.active === 'full'} />
            {counts.partial > 0 && (
                <Stat label={COMPLETENESS.partial.short} value={counts.partial} color={COMPLETENESS.partial.color}
                    hint={COMPLETENESS.partial.hint} onClick={() => onPick?.('partial')} active={counts.active === 'partial'} />
            )}
            <Stat label={COMPLETENESS.empty.short} value={counts.empty || 0} color={COMPLETENESS.empty.color}
                hint={COMPLETENESS.empty.hint} onClick={() => onPick?.('empty')} active={counts.active === 'empty'} />
            <Stat label="提取来源" value={sourceCount || 0} hint="从多少本小说提取过技法（点左侧「按来源」查看）" />
            {disabled > 0 && <Stat label="已自动禁用" value={disabled} color="#ff4757" hint="成功率过低被自动禁用，不计入注入" />}
            {counts.empty > 0 && (
                <p className={s.statsHint}>
                    空壳条目只有名字和标签，注入时给不了模型任何做法 —— 点「空壳」可单独查看，
                    或用「一键提取」从已有小说补充实施规则。
                </p>
            )}
        </div>
    );
}
