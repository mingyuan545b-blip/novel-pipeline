/**
 * 错误追踪视图子组件（方向 F）
 *
 * 职责：
 * 1. 渲染错误日志列表（含 code/stack/context）
 * 2. 渲染错误聚合统计（按 code/module 聚合）
 * 3. 支持点击错误项跳转到对应 traceId 日志
 * 4. 支持展开/收起 stack 和 context 详情
 *
 * 文件位置：client/src/pages/debug/DebugErrors.jsx
 */

import { useState } from 'react';
import styles from './debugLogs.module.css';

/**
 * 格式化时间为本地可读格式
 */
function formatTime(timestamp) {
    if (!timestamp) return '';
    try {
        return new Date(timestamp).toLocaleTimeString();
    } catch {
        return timestamp;
    }
}

/**
 * 错误级别样式类名映射
 */
function getLevelClassName(level) {
    if (level === 'error') return styles.levelError;
    if (level === 'warn') return styles.levelWarn;
    return '';
}

/**
 * 单个错误条目（可展开查看 stack + context）
 */
function ErrorItem({ error, onSelectTrace }) {
    const [expanded, setExpanded] = useState(false);
    const hasDetail = error.stack || error.context;

    return (
        <div className={`${styles.logItem} ${getLevelClassName(error.level)}`}>
            <div
                className={styles.logItemHeader}
                role={hasDetail ? 'button' : undefined}
                onClick={() => hasDetail && setExpanded(!expanded)}
                title={hasDetail ? (expanded ? '点击收起详情' : '点击展开详情') : ''}
            >
                <span className={styles.logTime}>{formatTime(error.timestamp)}</span>
                <span className={styles.logLevel}>{error.level.toUpperCase()}</span>
                <span className={styles.logModule}>{error.module}</span>
                <span className={styles.logMessage}>{error.message}</span>
                {error.code && (
                    <span className={styles.errorCodeBadge} title="错误码">{error.code}</span>
                )}
                {hasDetail && (
                    <span className={styles.expandHint}>{expanded ? '▼' : '▶'}</span>
                )}
            </div>
            {expanded && hasDetail && (
                <pre className={styles.errorDetail}>
                    {error.code && <div>Code: {error.code}</div>}
                    {error.stack && (
                        <div>
                            <div className={styles.errorDetailLabel}>Stack:</div>
                            {error.stack}
                        </div>
                    )}
                    {error.context && (
                        <div>
                            <div className={styles.errorDetailLabel}>Context:</div>
                            {JSON.stringify(error.context, null, 2)}
                        </div>
                    )}
                    {error.traceId && (
                        <div className={styles.errorDetailActions}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectTrace(error.traceId);
                                }}
                                className={styles.aggJumpBtn}
                                title={`查看 traceId: ${error.traceId}`}
                            >
                                查看 traceId 日志
                            </button>
                        </div>
                    )}
                </pre>
            )}
        </div>
    );
}

/**
 * 错误聚合统计卡片
 */
function ErrorStatsCard({ stats }) {
    if (!stats || stats.total === 0) return null;
    return (
        <div className={styles.errorStatsCard}>
            <div className={styles.errorStatsHeader}>
                <h4>错误聚合统计</h4>
                <span className={styles.errorStatsTotal}>总计 {stats.total} 条</span>
            </div>
            {stats.topCodes?.length > 0 && (
                <div className={styles.errorStatsSection}>
                    <div className={styles.errorStatsSectionTitle}>按错误码</div>
                    <div className={styles.errorStatsChips}>
                        {stats.topCodes.map(c => (
                            <span key={c.code} className={styles.errorStatsChip} title={`${c.code}: ${c.count} 次`}>
                                {c.code} <span className={styles.errorStatsChipCount}>{c.count}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}
            {stats.topModules?.length > 0 && (
                <div className={styles.errorStatsSection}>
                    <div className={styles.errorStatsSectionTitle}>按模块</div>
                    <div className={styles.errorStatsChips}>
                        {stats.topModules.map(m => (
                            <span key={m.module} className={styles.errorStatsChip} title={`${m.module}: ${m.count} 次`}>
                                {m.module} <span className={styles.errorStatsChipCount}>{m.count}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * @param {Object} props
 * @param {Object} props.errorsData - useErrorLogs 返回值 { items, total, returned }
 * @param {Object} props.stats - useErrorStats 返回值 { total, topCodes, topModules }
 * @param {boolean} props.loading
 * @param {Function} props.onSelectTrace - 点击错误项跳转 traceId
 * @param {Function} props.onRefresh
 */
export default function DebugErrors({ errorsData, stats, loading, onSelectTrace, onRefresh }) {
    const items = errorsData?.items || [];
    const total = errorsData?.total || 0;

    return (
        <div className={styles.aggPanel}>
            <div className={styles.aggHeader}>
                <h3>错误追踪（warn + error 级别）</h3>
                <button onClick={onRefresh} className={styles.refreshBtn} aria-label="刷新错误列表">
                    刷新
                </button>
            </div>

            {loading && <div className={styles.aggEmpty}>加载中...</div>}

            {!loading && items.length === 0 && (
                <div className={styles.aggEmpty}>暂无错误日志（warn/error 级别日志会在此聚合）</div>
            )}

            {!loading && items.length > 0 && (
                <>
                    <ErrorStatsCard stats={stats} />
                    <div className={styles.errorListMeta}>
                        共 {total} 条错误，显示最近 {items.length} 条
                    </div>
                    <ul className={styles.logList}>
                        {items.map((err, idx) => (
                            <ErrorItem
                                key={`${err.traceId}-${idx}`}
                                error={err}
                                onSelectTrace={onSelectTrace}
                            />
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
