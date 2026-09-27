/**
 * TokenChapterTable.jsx — 逐章明细表（点击行展开该章每次调用）
 * 列：章 / 场景 / 阶段 / 调用 / 总量 / 提示 / 生成 / 缓存命中 / 每千字 / 返修占比 / 截断
 */
import { formatTokens, formatPct, efficiencyColor } from './tokenLedgerFormat';
import TokenCallDetail from './TokenCallDetail';
import s from './tokenLedger.module.css';

export default function TokenChapterTable({ chapters, detail, onToggleChapter }) {
    const rows = chapters || [];
    if (rows.length === 0) return <div className={s.emptyHint}>当前筛选下没有章节</div>;
    return (
        <div className={s.tableWrap}>
            <table className={s.table}>
                <thead>
                    <tr>
                        <th>章</th><th>场景</th><th>阶段</th><th>调用</th>
                        <th>总量</th><th>提示</th><th>生成</th><th>缓存</th>
                        <th>每千字</th><th>返修占比</th><th>截断</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(ch => {
                        const open = detail?.chapter === ch.chapter;
                        return [
                            <tr key={ch.chapter} className={`${s.tableRow} ${open ? s.tableRowOpen : ''}`}
                                onClick={() => onToggleChapter?.(ch.chapter)}>
                                <td className={s.tdChapter}>{open ? '▾' : '▸'} 第{ch.chapter}章</td>
                                <td>{(ch.sceneTypes || []).map(x => x.label).join('、') || '-'}</td>
                                <td><span className={s.phaseTag}>{ch.phaseLabel}</span></td>
                                <td>{ch.calls}</td>
                                <td className={s.tdStrong}>{formatTokens(ch.totalTokens)}</td>
                                <td>{formatTokens(ch.promptTokens)}</td>
                                <td>{formatTokens(ch.completionTokens)}</td>
                                <td className={s.tdCache}>{formatPct(ch.cacheHitRate)}</td>
                                <td style={{ color: efficiencyColor(ch.tokensPerKChar) }}>{formatTokens(ch.tokensPerKChar)}</td>
                                <td className={ch.retryShare >= 50 && ch.roundSplit?.reliable ? s.tdWarn : ''}>
                                    {ch.roundSplit?.reliable ? formatPct(ch.retryShare) : '-'}
                                </td>
                                <td className={ch.truncatedCount > 0 ? s.tdWarn : ''}>
                                    {ch.truncatedCount > 0 ? `✂️${ch.truncatedCount}（-${formatTokens(ch.lostTokens)}）` : '完整'}
                                </td>
                            </tr>,
                            open ? (
                                <tr key={`${ch.chapter}-detail`} className={s.detailRow}>
                                    <td colSpan={11}><TokenCallDetail detail={detail} /></td>
                                </tr>
                            ) : null,
                        ];
                    })}
                </tbody>
            </table>
        </div>
    );
}
