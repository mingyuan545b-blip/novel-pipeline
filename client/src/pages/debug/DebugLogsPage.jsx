/**
 * 调试日志主页面（标签页布局）
 *
 * 标签页：Trace ID / 错误 / 聚合 / 告警
 * 文件位置：client/src/pages/debug/DebugLogsPage.jsx
 */

import DebugTraceList from './DebugTraceList';
import DebugLogList from './DebugLogList';
import DebugAggregations from './DebugAggregations';
import DebugAlerts from './DebugAlerts';
import DebugErrors from './DebugErrors';
import useDebugLogsPage from './useDebugLogsPage';
import styles from './debugLogs.module.css';

const TABS = [
    { id: 'trace', label: 'Trace ID' },
    { id: 'errors', label: '错误' },
    { id: 'aggregations', label: '聚合' },
    { id: 'alerts', label: '告警' }
];

export default function DebugLogsPage() {
    const {
        selectedId, levelFilter, manualInput, activeTab, includeArchive,
        setLevelFilter, setManualInput, setIncludeArchive,
        tracesQuery, logsQuery, clearMutation,
        aggregationsQuery, alertsQuery, rulesQuery,
        errorsQuery, errorStatsQuery,
        handleSelect, handleManualSearch, handleClear, handleTabChange, handleAcknowledge,
        stats, alertsCount
    } = useDebugLogsPage();

    return (
        <div className={styles.debugPage}>
            <div className={styles.debugHeader}>
                <h2>调试日志</h2>
                <div className={styles.debugHeaderMeta}>
                    {stats.logStore?.totalTraces !== undefined && (
                        <span>trace: {stats.logStore.totalTraces}/{stats.logStore.maxTraces}</span>
                    )}
                    {stats.aggregator?.totalKeys !== undefined && stats.aggregator.totalKeys > 0 && (
                        <span>聚合键: {stats.aggregator.totalKeys}</span>
                    )}
                    {alertsCount > 0 && (
                        <span className={styles.alertCountBadge}>告警: {alertsCount}</span>
                    )}
                </div>
                <div className={styles.debugHeaderActions}>
                    <input
                        type="text"
                        value={manualInput}
                        onChange={e => setManualInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleManualSearch(); }}
                        placeholder="手动输入 traceId 检索"
                        className={styles.manualInput}
                        aria-label="手动输入 traceId"
                    />
                    <button onClick={handleManualSearch} className={styles.searchBtn}>检索</button>
                    <button
                        onClick={handleClear}
                        className={styles.clearBtn}
                        disabled={clearMutation.isPending}
                        aria-label="清空所有数据"
                    >
                        {clearMutation.isPending ? '清空中...' : '清空'}
                    </button>
                </div>
            </div>

            <div className={styles.tabBar} role="tablist">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
                        onClick={() => handleTabChange(tab.id)}
                    >
                        {tab.label}
                        {tab.id === 'alerts' && alertsCount > 0 && (
                            <span className={styles.tabAlertDot} aria-label={`${alertsCount} 个未确认告警`} />
                        )}
                    </button>
                ))}
            </div>

            <div className={styles.tabContent}>
                {activeTab === 'trace' && (
                    <div className={styles.debugBody}>
                        <DebugTraceList
                            traces={tracesQuery.data || []}
                            selectedId={selectedId}
                            onSelect={handleSelect}
                            levelFilter={levelFilter}
                            onLevelChange={setLevelFilter}
                            loading={tracesQuery.isLoading}
                            onRefresh={() => tracesQuery.refetch()}
                            includeArchive={includeArchive}
                            onIncludeArchiveChange={setIncludeArchive}
                        />
                        <DebugLogList
                            record={logsQuery.data}
                            loading={logsQuery.isLoading}
                            error={logsQuery.error?.response?.data?.error || logsQuery.error?.message || null}
                        />
                    </div>
                )}

                {activeTab === 'errors' && (
                    <DebugErrors
                        errorsData={errorsQuery.data}
                        stats={errorStatsQuery.data}
                        loading={errorsQuery.isLoading}
                        onSelectTrace={handleSelect}
                        onRefresh={() => { errorsQuery.refetch(); errorStatsQuery.refetch(); }}
                    />
                )}

                {activeTab === 'aggregations' && (
                    <DebugAggregations
                        aggregations={aggregationsQuery.data || []}
                        loading={aggregationsQuery.isLoading}
                        onSelectTrace={handleSelect}
                        onRefresh={() => aggregationsQuery.refetch()}
                    />
                )}

                {activeTab === 'alerts' && (
                    <DebugAlerts
                        alerts={alertsQuery.data || []}
                        loading={alertsQuery.isLoading}
                        onAcknowledge={handleAcknowledge}
                        onSelectTrace={handleSelect}
                        onRefresh={() => alertsQuery.refetch()}
                        rules={rulesQuery.data || []}
                    />
                )}
            </div>
        </div>
    );
}
