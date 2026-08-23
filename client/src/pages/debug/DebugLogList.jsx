/**
 * 日志详情列表子组件
 *
 * 职责：渲染指定 traceId 下的所有日志条目，按时间排序
 * 支持展开/折叠每条日志的 context 详情
 *
 * 文件位置：client/src/pages/debug/DebugLogList.jsx
 */

import { useState } from 'react';
import styles from './debugLogs.module.css';

const LEVEL_CLASS = {
    debug: styles.levelDebug,
    info: styles.levelInfo,
    warn: styles.levelWarn,
    error: styles.levelError
};

/**
 * @param {Object} props
 * @param {Object|null} props.record - TraceRecord（含 logs 数组）
 * @param {boolean} props.loading
 * @param {string|null} props.error
 */
export default function DebugLogList({ record, loading, error }) {
    const [expandedId, setExpandedId] = useState(null);

    if (loading) return <div className={styles.logListLoading}>加载日志中...</div>;
    if (error) return <div className={styles.logListError}>加载失败：{error}</div>;
    if (!record) return <div className={styles.logListEmpty}>请选择左侧 traceId 查看日志</div>;

    const logs = record.logs || [];

    return (
        <div className={styles.logListPanel}>
            <div className={styles.logListHeader}>
                <h3>日志详情</h3>
                <div className={styles.logListMeta}>
                    <span className={styles.logListTraceId}>{record.traceId}</span>
                    <span>{record.logCount} 条</span>
                    <span>{new Date(record.createdAt).toLocaleString()}</span>
                </div>
            </div>

            {logs.length === 0 ? (
                <div className={styles.logListEmpty}>该 traceId 下无日志</div>
            ) : (
                <ul className={styles.logList} role="list">
                    {logs.map((log, idx) => {
                        const hasContext = log.context && Object.keys(log.context).length > 0;
                        const isExpanded = expandedId === idx;
                        return (
                            <li
                                key={idx}
                                className={`${styles.logItem} ${LEVEL_CLASS[log.level] || ''}`}
                                role="listitem"
                            >
                                <div
                                    className={styles.logItemHeader}
                                    onClick={() => hasContext && setExpandedId(isExpanded ? null : idx)}
                                    role={hasContext ? 'button' : undefined}
                                    tabIndex={hasContext ? 0 : undefined}
                                    onKeyDown={e => {
                                        if (hasContext && e.key === 'Enter') {
                                            setExpandedId(isExpanded ? null : idx);
                                        }
                                    }}
                                    aria-expanded={hasContext ? isExpanded : undefined}
                                >
                                    <span className={styles.logTime}>
                                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                                    </span>
                                    <span className={styles.logLevel}>{log.level?.toUpperCase()}</span>
                                    <span className={styles.logModule}>[{log.module}]</span>
                                    <span className={styles.logMessage}>{log.message}</span>
                                    {hasContext && (
                                        <span className={styles.expandHint}>{isExpanded ? '▼' : '▶'}</span>
                                    )}
                                </div>
                                {isExpanded && hasContext && (
                                    <pre className={styles.logContext}>
                                        {JSON.stringify(log.context, null, 2)}
                                    </pre>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
