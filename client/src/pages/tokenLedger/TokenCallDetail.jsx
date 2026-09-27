/**
 * TokenCallDetail.jsx — 展开某章：这一次次调用分别花了多少、花在哪几段提示词
 * 截断的分段标红并显示丢失量 —— 这是"哪里出了问题"的最硬证据。
 */
import { formatTokens, formatExact } from './tokenLedgerFormat';
import s from './tokenLedger.module.css';

export default function TokenCallDetail({ detail }) {
    if (!detail || !detail.chapter) return null;
    if (detail.loading) return <div className={s.emptyHint}>正在加载第{detail.chapter}章的调用明细…</div>;
    if (!detail.calls || detail.calls.length === 0) return <div className={s.emptyHint}>该章暂无账本记录</div>;
    return (
        <div className={s.callList}>
            {detail.calls.map((c, i) => (
                <div className={s.callCard} key={c.id || i}>
                    <div className={s.callHead}>
                        <span className={s.callStep}>{c.stepLabel || c.step}</span>
                        <span className={s.callRound}>第{c.runRound || c.round || 1}轮</span>
                        <span className={s.callTotal}>{formatTokens(c.usage?.totalTokens)} tokens</span>
                        <span className={s.callSplit}>
                            提示 {formatTokens(c.usage?.promptTokens)} ｜ 生成 {formatTokens(c.usage?.completionTokens)}
                            {c.usage?.cachedTokens > 0 ? ` ｜ 缓存 ${formatTokens(c.usage.cachedTokens)}` : ''}
                        </span>
                    </div>
                    <div className={s.callSections}>
                        {(c.promptSections || []).map(sec => (
                            <div className={s.callSection} key={sec.slot} title={`原始 ${formatExact(sec.originalTokens)} → 实际 ${formatExact(sec.tokens)}`}>
                                <span className={s.callSectionName}>{sec.label || sec.slot}</span>
                                <span className={s.callSectionTokens}>{formatTokens(sec.tokens)}</span>
                                {sec.wasTruncated
                                    ? <span className={s.callTrunc}>✂️ 砍掉 {formatTokens(sec.lostTokens)}</span>
                                    : <span className={s.callOk}>完整</span>}
                            </div>
                        ))}
                        {(c.promptSections || []).length === 0 && <span className={s.emptyHint}>未记录分段明细</span>}
                    </div>
                    <div className={s.callFoot}>
                        输出 {formatExact(c.outputChars)} 字{c.model ? ' ｜ 模型 ' + c.model : ''}{c.backfilled ? ' ｜ 历史回填' : ''}
                    </div>
                </div>
            ))}
        </div>
    );
}
