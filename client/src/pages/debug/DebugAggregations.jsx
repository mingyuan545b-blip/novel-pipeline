/**
 * 错误聚合视图子组件
 *
 * 职责：渲染错误聚合数据（按 module/level/code/status 分组）
 * 支持点击聚合项跳转到对应 traceId 日志
 *
 * 文件位置：client/src/pages/debug/DebugAggregations.jsx
 */

import styles from './debugLogs.module.css';

/**
 * 解析聚合键为可读标签
 */
function formatAggKey(key) {
    const [type, value] = key.split(':');
    const typeLabels = {
        level: '级别',
        module: '模块',
        code: '错误码',
        status: 'HTTP状态'
    };
    return `${typeLabels[type] || type}: ${value}`;
}

/**
 * @param {Object} props
 * @param {Array} props.aggregations - 聚合数据
 * @param {boolean} props.loading
 * @param {Function} props.onSelectTrace - 点击聚合项跳转 traceId
 * @param {Function} props.onRefresh
 */
export default function DebugAggregations({ aggregations = [], loading, onSelectTrace, onRefresh }) {
    return (
        <div className={styles.aggPanel}>
            <div className={styles.aggHeader}>
                <h3>错误聚合（最近 30 分钟）</h3>
                <button onClick={onRefresh} className={styles.refreshBtn} aria-label="刷新聚合数据">
                    刷新
                </button>
            </div>

            {loading && <div className={styles.aggEmpty}>加载中...</div>}

            {!loading && aggregations.length === 0 && (
                <div className={styles.aggEmpty}>暂无聚合数据（warn/error 级别日志会在此聚合）</div>
            )}

            {aggregations.length > 0 && (
                <table className={styles.aggTable}>
                    <thead>
                        <tr>
                            <th>聚合键</th>
                            <th>窗口计数</th>
                            <th>总计数</th>
                            <th>最后出现</th>
                            <th>样本消息</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {aggregations.map(agg => (
                            <tr key={agg.key} className={styles.aggRow}>
                                <td className={styles.aggKeyCell}>{formatAggKey(agg.key)}</td>
                                <td className={styles.aggCountCell}>
                                    <span className={styles.aggWindowCount}>{agg.windowCount}</span>
                                </td>
                                <td className={styles.aggCountCell}>{agg.count}</td>
                                <td className={styles.aggTimeCell}>
                                    {new Date(agg.lastSeen).toLocaleTimeString()}
                                </td>
                                <td className={styles.aggMsgCell} title={agg.sampleMessage}>
                                    {agg.sampleMessage?.substring(0, 60)}
                                    {agg.sampleMessage?.length > 60 ? '...' : ''}
                                </td>
                                <td>
                                    {agg.sampleTraceId && (
                                        <button
                                            onClick={() => onSelectTrace(agg.sampleTraceId)}
                                            className={styles.aggJumpBtn}
                                            title={`查看 traceId: ${agg.sampleTraceId}`}
                                        >
                                            查看日志
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
