/**
 * 调试日志自定义 hook 聚合入口
 * 对外保持 from '.../hooks/useDebugLogs' 路径不变
 * 文件位置：client/src/hooks/useDebugLogs/index.js
 */

export { DEBUG_KEYS } from './keys';
export { useTraceIds, useTraceLogs, useLogStats, useClearLogs } from './traceHooks';
export { useAggregations, useAlerts, useAcknowledgeAlert, useEvaluateAlerts, useAlertRules } from './alertHooks';
export { useErrorLogs, useErrorStats } from './errorHooks';
