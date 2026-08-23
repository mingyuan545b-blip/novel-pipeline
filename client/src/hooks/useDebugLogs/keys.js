/**
 * 调试日志查询键与轮询常量
 * 文件位置：client/src/hooks/useDebugLogs/keys.js
 */

// 查询键集中管理
export const DEBUG_KEYS = {
    all: ['debug'],
    traceIds: (level, includeArchive) => [...DEBUG_KEYS.all, 'trace-ids', level || 'all', includeArchive ? 'arch' : 'mem'],
    logs: (traceId, level) => [...DEBUG_KEYS.all, 'logs', traceId, level || 'all'],
    stats: () => [...DEBUG_KEYS.all, 'stats'],
    aggregations: (minCount) => [...DEBUG_KEYS.all, 'aggregations', minCount || 1],
    alerts: () => [...DEBUG_KEYS.all, 'alerts'],
    alertRules: () => [...DEBUG_KEYS.all, 'alert-rules'],
    errors: (limit) => [...DEBUG_KEYS.all, 'errors', limit || 50],
    errorStats: () => [...DEBUG_KEYS.all, 'error-stats']
};

// 默认轮询间隔
export const TRACE_IDS_POLL_MS = 10000;
export const ALERTS_POLL_MS = 15000;
export const AGGREGATIONS_POLL_MS = 15000;
export const ERRORS_POLL_MS = 15000;
