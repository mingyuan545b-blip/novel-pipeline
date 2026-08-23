'use strict';

/**
 * Logger 注入链初始化
 *
 * 职责：注入 logStore/aggregator/persister/fallbackWriter/alertEngine/auditLogStore
 * 返回 alertEngine/fallbackWriter/fallbackCleanupTimer 供后续 shutdown 使用
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

    return { alertEngine, fallbackWriter, fallbackCleanupTimer };
}

module.exports = { setupLoggerChain };
