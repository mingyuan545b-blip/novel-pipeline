/**
 * 告警视图子组件
 *
 * 职责：渲染活跃告警列表，支持确认告警、跳转 traceId
 *
 * 文件位置：client/src/pages/debug/DebugAlerts.jsx
 */

import styles from './debugLogs.module.css';

const SEVERITY_CLASS = {
    critical: styles.severityCritical,
    warning: styles.severityWarning,
    info: styles.severityInfo
};

const SEVERITY_LABEL = {
    critical: '严重',
    warning: '警告',
    info: '提示'
};

/**
 * @param {Object} props
 * @param {Array} props.alerts - 告警列表
 * @param {boolean} props.loading
 * @param {Function} props.onAcknowledge - 确认告警回调
 * @param {Function} props.onSelectTrace - 跳转 traceId 回调
 * @param {Function} props.onRefresh
 * @param {Array} [props.rules] - 告警规则列表（可选展示）
 */
export default function DebugAlerts({
    alerts = [],
    loading,
    onAcknowledge,
    onSelectTrace,
    onRefresh,
    rules = []
}) {
    return (
        <div className={styles.alertPanel}>
            <div className={styles.alertHeader}>
                <h3>活跃告警</h3>
                <button onClick={onRefresh} className={styles.refreshBtn} aria-label="刷新告警">
                    刷新
                </button>
            </div>

            {rules.length > 0 && (
                <details className={styles.alertRulesSection}>
                    <summary>告警规则（{rules.length} 条）</summary>
                    <ul className={styles.alertRulesList}>
                        {rules.map(r => (
                            <li key={r.id}>
                                <strong>{r.name}</strong>
                                <span className={SEVERITY_CLASS[r.severity]}>[{SEVERITY_LABEL[r.severity]}]</span>
                                <span>阈值: {r.threshold}</span>
                                <span>匹配: {r.keyPattern}*</span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {loading && <div className={styles.alertEmpty}>加载中...</div>}

            {!loading && alerts.length === 0 && (
                <div className={styles.alertEmpty}>✅ 无活跃告警</div>
            )}

            {alerts.length > 0 && (
                <ul className={styles.alertList} role="list">
                    {alerts.map(alert => (
                        <li
                            key={alert.id}
                            className={`${styles.alertItem} ${SEVERITY_CLASS[alert.severity] || ''} ${alert.acknowledged ? styles.alertAck : ''}`}
                            role="listitem"
                        >
                            <div className={styles.alertItemHeader}>
                                <span className={styles.alertSeverity}>
                                    {SEVERITY_LABEL[alert.severity] || alert.severity}
                                </span>
                                <span className={styles.alertRuleName}>{alert.ruleName}</span>
                                {alert.acknowledged && <span className={styles.alertAckBadge}>已确认</span>}
                            </div>
                            <div className={styles.alertItemMeta}>
                                <span>键: {alert.key}</span>
                                <span>计数: {alert.count}/{alert.threshold}</span>
                                <span>触发: {new Date(alert.triggeredAt).toLocaleString()}</span>
                            </div>
                            {alert.sampleMessage && (
                                <div className={styles.alertSampleMsg} title={alert.sampleMessage}>
                                    {alert.sampleMessage.substring(0, 100)}
                                </div>
                            )}
                            <div className={styles.alertItemActions}>
                                {alert.sampleTraceId && !alert.acknowledged && (
                                    <button
                                        onClick={() => onSelectTrace(alert.sampleTraceId)}
                                        className={styles.aggJumpBtn}
                                        title={`查看 traceId: ${alert.sampleTraceId}`}
                                    >
                                        查看日志
                                    </button>
                                )}
                                {!alert.acknowledged && (
                                    <button
                                        onClick={() => onAcknowledge(alert.id)}
                                        className={styles.alertAckBtn}
                                    >
                                        确认
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
