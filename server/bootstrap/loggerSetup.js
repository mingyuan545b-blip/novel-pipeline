'use strict';

/**
 * Logger 注入链初始化
 *
 * 职责：注入 logStore/aggregator/persister/fallbackWriter/alertEngine/auditLogStore
 * 返回 alertEngine/fallbackWriter/fallbackCleanupTimer/debugPersister 供后续 shutdown 使用。
 *
 * ⚠️ 返回对象必须含 debugPersister：server/index.js 依赖它做 attachPool/start 与
 * registerShutdownHooks。曾漏返回该键 → index.js 解构得到 undefined →
 *   `debugPersister.attachPool(pgPool)` 抛 "Cannot read properties of undefined" 被 catch 吞掉，
 *   于是 DEBUG-PERSIST 与随后同一 try 块里的 AUDIT-PERSIST 双双被跳过：
 *   调试日志只写 fallback 文件不入库、告警不入库、审计日志不入库，且关闭时 flush 步骤抛错。
 * 文件位置：server/bootstrap/loggerSetup.js
 */

const path = require('path');
const logger = require('shared/logger');
const { logStore, attachAggregator, attachPersister } = require('shared/logStore');
const { logAggregator } = require('shared/logAggregator');
const { debugPersister } = require('shared/debugPersister');
const { DebugFallbackWriter } = require('shared/debugFallbackWriter');
const { DEBUG_FALLBACK } = require('../config/systemConfigDefs');
const { shutdownManager } = require('shared/shutdownManager');
const { auditLogStore } = require('shared/auditLogStore');
const { alertEngine } = require('shared/alertRules');

/**
 * 初始化 logger 注入链
 * @returns {{ alertEngine, fallbackWriter, fallbackCleanupTimer }}
 */
function setupLoggerChain() {
    logger.attachLogStore(logStore);
    attachAggregator(logAggregator);

    attachPersister(debugPersister);

    const fallbackDataDir = path.join(__dirname, '..', '..', 'data');
    const fallbackWriter = new DebugFallbackWriter({ dataDir: fallbackDataDir });
    debugPersister.attachFallbackWriter(fallbackWriter);

    const fallbackCleanupTimer = setInterval(() => {
        try { fallbackWriter.cleanup(); } catch (e) {
            logger.warn('index', `[DEBUG-FALLBACK] cleanup failed: ${e.message}`);
        }
    }, DEBUG_FALLBACK.CLEANUP_INTERVAL_MS);
    if (fallbackCleanupTimer.unref) fallbackCleanupTimer.unref();

    shutdownManager.bindSignalHandlers();

    auditLogStore.setFallbackDir(path.join(__dirname, '..', '..', 'data'));

    alertEngine.attachAggregator(logAggregator);
    alertEngine.attachPersister(debugPersister);
    alertEngine.start();

    return { alertEngine, fallbackWriter, fallbackCleanupTimer, debugPersister };
}

module.exports = { setupLoggerChain };
