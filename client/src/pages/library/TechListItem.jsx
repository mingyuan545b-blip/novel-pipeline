/**
 * TechListItem — 技法列表项（带内容完整度标识）
 *
 * 视觉设计意图（用户："我都不知道哪些有的那些是空的"）：
 *   - 左侧色条按完整度着色：完整=绿、部分=橙、空壳=灰
 *   - 右侧徽标显示"3条规则"/"空壳"，不必点进去就知道有没有内容
 *   - 空壳整体降透明度，视觉沉底（服务端已按内容量排序，空壳本就在后面）
 */
import { COMPLETENESS, completenessBadge } from './libraryConstants';
import s from './library.module.css';

export default function TechListItem({ tech, selected, onClick }) {
    const meta = COMPLETENESS[tech.completeness] || COMPLETENESS.empty;
    // 索引条目带 autoDisabled，搜索结果/详情是 snake_case —— 两者都认，否则"禁用"角标永远不显示
    const disabled = tech.autoDisabled ?? tech.auto_disabled;
    const badge = completenessBadge(tech);
    return (
        <button type="button" onClick={onClick}
            className={`${s.techItem} ${selected ? s.techItemOn : ''} ${tech.completeness === 'empty' ? s.techItemEmpty : ''}`}
            title={`${tech.display_name}｜${meta.label}：${meta.hint}${tech.sourceNovel ? `｜来源：${tech.sourceNovel}` : ''}`}>
            <span className={s.techDot} style={{ background: disabled ? '#ff4757' : meta.color }} />
            <span className={s.techName}>{tech.display_name}</span>
            {disabled && <span className={s.badgeDanger}>禁用</span>}
            <span className={s.badge} style={{ color: meta.color, borderColor: meta.color }}>{badge}</span>
        </button>
    );
}
