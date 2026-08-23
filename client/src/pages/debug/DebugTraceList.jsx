/**
 * TraceId 列表子组件
 *
 * 职责：渲染最近 traceId 列表，支持选中、按级别过滤
 * 纯展示组件，数据由父组件通过 props 注入
 *
 * 文件位置：client/src/pages/debug/DebugTraceList.jsx
 */

import styles from './debugLogs.module.css';

/**
 * @param {Object} props
 * @param {Array} props.traces - traceId 列表项
 * @param {string|null} props.selectedId - 当前选中的 traceId
 * @param {Function} props.onSelect - 选中回调
 * @param {string} props.levelFilter - 级别过滤
 * @param {Function} props.onLevelChange - 级别变更回调
 * @param {boolean} props.loading
 * @param {Function} props.onRefresh - 手动刷新回调
 * @param {boolean} props.includeArchive - 是否包含 PG 归档数据
 * @param {Function} props.onIncludeArchiveChange - 归档开关变更回调
 */
export default function DebugTraceList({
    traces = [],
    selectedId,
    onSelect,
    levelFilter,
    onLevelChange,
    loading,
    onRefresh,
    includeArchive = false,
    onIncludeArchiveChange
}) {
    const LEVELS = ['', 'error', 'warn', 'info', 'debug'];

    return (
        <div className={styles.traceListPanel}>
            <div className={styles.traceListHeader}>
                <h3>最近 Trace ID</h3>
                <div className={styles.traceListActions}>
                    <label className={styles.archiveToggle} title="合并显示 PG 归档的历史 traceId">
                        <input
                            type="checkbox"
                            checked={includeArchive}
                            onChange={e => onIncludeArchiveChange(e.target.checked)}
                        />
                        <span>归档</span>
                    </label>
                    <select
                        value={levelFilter}
                        onChange={e => onLevelChange(e.target.value)}
                        className={styles.levelSelect}
                        aria-label="按级别过滤"
                    >
                        {LEVELS.map(l => (
                            <option key={l} value={l}>{l || '全部级别'}</option>
                        ))}
                    </select>
                    <button
                        onClick={onRefresh}
                        className={styles.refreshBtn}
                        aria-label="刷新 traceId 列表"
                    >
                        刷新
                    </button>
                </div>
            </div>

            {loading && <div className={styles.traceListLoading}>加载中...</div>}

            {!loading && traces.length === 0 && (
                <div className={styles.traceListEmpty}>暂无 traceId 记录</div>
            )}

            <ul className={styles.traceList} role="list">
                {traces.map(t => (
                    <li
                        key={t.traceId}
                        className={`${styles.traceItem} ${selectedId === t.traceId ? styles.traceItemActive : ''}`}
                        onClick={() => onSelect(t.traceId)}
                        role="listitem"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter') onSelect(t.traceId); }}
                        aria-current={selectedId === t.traceId ? 'true' : undefined}
                    >
                        <div className={styles.traceItemHeader}>
                            <span className={styles.traceIdValue}>{t.traceId}</span>
                            {t.hasError && <span className={styles.errorBadge}>ERR</span>}
                            {t.archived && <span className={styles.archivedBadge}>归档</span>}
                        </div>
                        <div className={styles.traceItemMeta}>
                            <span>{new Date(t.updatedAt).toLocaleTimeString()}</span>
                            <span>{t.logCount} 条</span>
                            {t.levelCounts.error > 0 && (
                                <span className={styles.levelCountError}>E:{t.levelCounts.error}</span>
                            )}
                            {t.levelCounts.warn > 0 && (
                                <span className={styles.levelCountWarn}>W:{t.levelCounts.warn}</span>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
