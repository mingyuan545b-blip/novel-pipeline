import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    useTraceIds, useTraceLogs, useLogStats, useClearLogs,
    useAggregations, useAlerts, useAcknowledgeAlert, useAlertRules,
    useErrorLogs, useErrorStats
} from '../../hooks/useDebugLogs';

/**
 * DebugLogsPage 状态与事件管理 hook
 * 文件位置：client/src/pages/debug/useDebugLogsPage.js
 */
function useDebugLogsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialTraceId = searchParams.get('traceId') || '';
    const initialTab = searchParams.get('tab') || 'trace';
    const [selectedId, setSelectedId] = useState(initialTraceId);
    const [levelFilter, setLevelFilter] = useState('');
    const [manualInput, setManualInput] = useState(initialTraceId);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [includeArchive, setIncludeArchive] = useState(false);

    const tracesQuery = useTraceIds({ level: levelFilter || undefined, includeArchive });
    const logsQuery = useTraceLogs(selectedId, { level: levelFilter || undefined });
    const statsQuery = useLogStats();
    const clearMutation = useClearLogs();
    const aggregationsQuery = useAggregations({ minCount: 1 });
    const alertsQuery = useAlerts();
    const ackMutation = useAcknowledgeAlert();
    const rulesQuery = useAlertRules();
    const errorsQuery = useErrorLogs({ limit: 50 });
    const errorStatsQuery = useErrorStats();

    const handleSelect = (traceId) => {
        setSelectedId(traceId);
        setManualInput(traceId);
        setActiveTab('trace');
        setSearchParams({ traceId, tab: 'trace' });
    };

    const handleManualSearch = () => {
        const tid = manualInput.trim();
        if (!tid) return;
        setSelectedId(tid);
        setSearchParams({ traceId: tid, tab: 'trace' });
    };

    const handleClear = () => {
        if (!window.confirm('确认清空所有日志存储、聚合数据、告警？此操作不可恢复。')) return;
        clearMutation.mutate();
    };

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setSearchParams(prev => { prev.set('tab', tabId); return prev; });
    };

    const handleAcknowledge = (alertId) => { ackMutation.mutate(alertId); };

    const stats = statsQuery.data || {};
    const alertsCount = stats.alerts?.unacknowledged || 0;

    return {
        selectedId, levelFilter, manualInput, activeTab, includeArchive,
        setLevelFilter, setManualInput, setIncludeArchive,
        tracesQuery, logsQuery, statsQuery, clearMutation,
        aggregationsQuery, alertsQuery, rulesQuery,
        errorsQuery, errorStatsQuery,
        handleSelect, handleManualSearch, handleClear, handleTabChange, handleAcknowledge,
        stats, alertsCount
    };
}

export default useDebugLogsPage;
