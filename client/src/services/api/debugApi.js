/**
 * 调试日志 API
 *
 * 对应后端 /api/debug 路由，提供：
 * - listTraceIds: 获取最近 traceId 列表
 * - getLogs: 按 traceId 检索日志详情
 * - getStats: 获取 logStore/aggregator/alerts 综合统计
 * - clearLogs: 清空日志存储 + 聚合 + 告警
 * - getAggregations: 获取错误聚合数据
 * - getAlerts: 获取活跃告警列表
 * - acknowledgeAlert: 确认告警
 * - evaluateAlerts: 手动触发告警评估（调试用）
 * - getAlertRules: 获取告警规则
 * - getErrors: 获取错误日志列表（含 stack + context，方向 F）
 * - getErrorStats: 获取错误聚合统计（按 code/module 聚合，方向 F）
 *
 * 文件位置：client/src/services/api/debugApi.js
 */

import { api } from './httpClient';

export const debugApi = {
    /**
     * 获取最近 traceId 列表
     * @param {Object} [params]
     * @param {number} [params.limit] - 返回条数上限
     * @param {string} [params.level] - 按级别过滤
     * @param {boolean} [params.includeArchive] - 是否合并 PG 归档数据
     */
    listTraceIds: (params) => api.get('/debug/trace-ids', { params }),

    /**
     * 按 traceId 检索日志详情
     */
    getLogs: (traceId, params) => api.get('/debug/logs', { params: { traceId, ...params } }),

    /**
     * 获取综合统计（logStore + aggregator + alerts）
     */
    getStats: () => api.get('/debug/stats'),

    /**
     * 清空日志存储 + 聚合 + 告警
     */
    clearLogs: () => api.delete('/debug/logs'),

    /**
     * 获取错误聚合数据
     * @param {Object} [params]
     * @param {number} [params.limit=50] - 返回条数上限
     * @param {number} [params.minCount=1] - 最小计数阈值
     */
    getAggregations: (params) => api.get('/debug/aggregations', { params }),

    /**
     * 获取活跃告警列表
     */
    getAlerts: () => api.get('/debug/alerts'),

    /**
     * 确认告警
     * @param {string} alertId - 告警 ID
     */
    acknowledgeAlert: (alertId) => api.post(`/debug/alerts/${alertId}/acknowledge`),

    /**
     * 手动触发告警评估（调试用，避免等待 30 秒定时器）
     */
    evaluateAlerts: () => api.post('/debug/alerts/evaluate'),

    /**
     * 获取告警规则列表
     */
    getAlertRules: () => api.get('/debug/alerts/rules'),

    /**
     * 获取错误日志列表（含 stack + context，方向 F）
     * @param {Object} [params]
     * @param {number} [params.limit=50] - 返回条数上限（最大 200）
     * @returns {Promise<{data: Array, meta: {total: number, returned: number}}>}
     */
    getErrors: (params) => api.get('/debug/errors', { params }),

    /**
     * 获取错误聚合统计（按 code/module 聚合，方向 F）
     * @returns {Promise<{data: {total: number, topCodes: Array, topModules: Array}}>}
     */
    getErrorStats: () => api.get('/debug/errors/stats')
};
