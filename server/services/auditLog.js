'use strict';

/**
 * auditLog.js — 关键操作审计日志
 * 记录项目创建/删除、Pipeline启动/完成、素材变更等关键操作
 *
 * Q7: 审计日志与调试日志职责分离
 * - 内存仍保留最近 500 条（向后兼容现有 query API）
 * - 新增 auditLogStore 独立持久化（PG audit_logs 表 + 文件 fallback）
 * - 不再混入 debug 日志流（logger 仅记 INFO 级别摘要，不进 debug pipeline）
 */
const logger = require('../shared/logger');
const { auditLogStore, MEMORY_RETENTION } = require('../shared/auditLogStore');

const entries = [];

const ACTIONS = Object.freeze({
    PROJECT_CREATE: 'project:create',
    PROJECT_DELETE: 'project:delete',
    PIPELINE_START: 'pipeline:start',
    PIPELINE_COMPLETE: 'pipeline:complete',
    PIPELINE_ERROR: 'pipeline:error',
    CHAPTER_SKIP: 'chapter:skip',
    CHAPTER_RESET: 'chapter:reset',
    MATERIAL_CREATE: 'material:create',
    MATERIAL_UPDATE: 'material:update',
    MATERIAL_DELETE: 'material:delete',
    ENTITY_CREATE: 'entity:create',
    ENTITY_DELETE: 'entity:delete',
    CONFIG_CHANGE: 'config:change',
    API_KEY_TEST: 'apikey:test',
    THROTTLE_DETECTED: 'throttle:detected',
    HEALTH_ALERT: 'health:alert',
});

function log(action, details = {}) {
    const entry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        action,
        projectId: details.projectId || null,
        userId: details.userId || 'system',
        timestamp: new Date().toISOString(),
        summary: details.summary || '',
        metadata: details.metadata || {},
    };
    entries.unshift(entry);
    if (entries.length > MEMORY_RETENTION) entries.length = MEMORY_RETENTION;
    // Q7: 异步持久化到独立 store（不阻塞业务流）
    auditLogStore.persist(entry).catch(() => {});
    logger.info('auditLog', `[AUDIT] ${action} ${entry.summary}`);
    return entry;
}

function query(options = {}) {
    let result = [...entries];
    if (options.action) result = result.filter(e => e.action === options.action);
    if (options.projectId) result = result.filter(e => e.projectId === options.projectId);
    if (options.since) {
        const since = new Date(options.since).getTime();
        result = result.filter(e => new Date(e.timestamp).getTime() >= since);
    }
    if (options.limit) result = result.slice(0, options.limit);
    return result;
}

function getStats() {
    const actionCounts = {};
    for (const entry of entries) {
        actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
    }
    return {
        totalEntries: entries.length,
        actionCounts,
        oldestEntry: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
        newestEntry: entries.length > 0 ? entries[0].timestamp : null,
        // Q7: 附带持久化层统计
        persistence: auditLogStore.getStats()
    };
}

function clearEntries() {
    entries.length = 0;
}

module.exports = { ACTIONS, log, query, getStats, clearEntries };
