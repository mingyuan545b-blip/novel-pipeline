/**
 * TokenAlertsPanel.jsx — "需要关注"清单
 * 把截断 / 返修烧钱 / 效率异常翻译成人话，点章号可跳到明细。
 */
import { ALERT_COLORS } from './tokenLedgerFormat';
import s from './tokenLedger.module.css';

export default function TokenAlertsPanel({ alerts, onJumpChapter }) {
    const list = alerts || [];
    return (
        <div className={s.panel}>
            <div className={s.panelHead}>
                <h3 className={s.panelTitle}>{list.length > 0 ? '⚠️ 需要关注' : '✅ 一切正常'}</h3>
                <span className={s.panelHint}>
                    {list.length > 0 ? `${list.length} 条信号，按章定位` : '未发现截断、返修烧钱或效率异常'}
                </span>
            </div>
            {list.length === 0 ? null : (
                <ul className={s.alertList}>
                    {list.map((a, i) => (
                        <li className={s.alertItem} key={`${a.chapter}-${a.slot || i}-${i}`}>
                            <span className={s.alertDot} style={{ background: ALERT_COLORS[a.level] || ALERT_COLORS.info }} />
                            <span className={s.alertText}>{a.message}</span>
                            {a.chapter ? (
                                <button className={s.alertJump} onClick={() => onJumpChapter?.(a.chapter)}>看明细</button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
