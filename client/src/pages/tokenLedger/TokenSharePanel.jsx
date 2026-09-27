/**
 * TokenSharePanel.jsx — "钱花在哪"排行面板（分段 / 分步共用）
 * 横向条形 + 百分比 + 截断标记，一眼看出谁占大头。
 */
import { formatTokens, formatPct } from './tokenLedgerFormat';
import s from './tokenLedger.module.css';

export default function TokenSharePanel({ title, hint, items, emptyText = '暂无数据' }) {
    if (!items || items.length === 0) {
        return (
            <div className={s.panel}>
                <PanelHead title={title} hint={hint} />
                <div className={s.emptyHint}>{emptyText}</div>
            </div>
        );
    }
    const max = Math.max(...items.map(i => i.tokens || 0)) || 1;
    return (
        <div className={s.panel}>
            <PanelHead title={title} hint={hint} />
            <div className={s.barList}>
                {items.map(it => (
                    <div className={s.barRow} key={it.slot || it.step} title={`${formatTokens(it.tokens)} tokens（占 ${formatPct(it.share)}）`}>
                        <div className={s.barLabel}>
                            <span className={s.barDot} style={{ background: it.color || '#64748b' }} />
                            {it.label || it.step}
                            {it.truncatedCount > 0 && <span className={s.barTrunc} title="该分段被预算截断过">✂️{it.truncatedCount}</span>}
                        </div>
                        <div className={s.barTrack}>
                            <div className={s.barFill}
                                style={{ width: `${Math.max(2, (it.tokens / max) * 100)}%`, background: it.color || '#64748b' }} />
                        </div>
                        <div className={s.barValue}>
                            {formatTokens(it.tokens)}
                            <span className={s.barPct}>{formatPct(it.share)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PanelHead({ title, hint }) {
    return (
        <div className={s.panelHead}>
            <h3 className={s.panelTitle}>{title}</h3>
            {hint && <span className={s.panelHint}>{hint}</span>}
        </div>
    );
}
