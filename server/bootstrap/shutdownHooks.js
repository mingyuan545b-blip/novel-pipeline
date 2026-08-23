'use strict';

/**
 * 优雅关闭 hook 注册
 *
 * 职责：注册 shutdownManager 的 LIFO 关闭 hooks
 * 文件位置：server/bootstrap/shutdownHooks.js
 */

const logger = require('shared/logger');
const { shutdownManager } = require('shared/shutdownManager');

/**
 * 注册优雅关闭 hooks
 * @param {{ alertEngine: Object, fallbackCleanupTimer: Object, debugPersister: Object }} deps
 */
function registerShutdownHooks({ alertEngine, fallbackCleanupTimer, debugPersister }) {
    // Q4: 注册优雅关闭 hook（LIFO 顺序：后注册先执行）
    // 1. metricsPersistence 停止快照定时器
    try {
        const metricsPersistence = require('../services/metricsPersistence');
        shutdownManager.register('metricsPersistence.stopPersistence', () =>
            Promise.resolve(metricsPersistence.stopPersistence())
        );
    } catch (e) {
        logger.warn('index', `[SHUTDOWN] register metricsPersistence failed: ${e.message}`);
    }
    // 2. alertEngine 停止告警评估定时器
    shutdownManager.register('alertEngine.stop', () =>
        Promise.resolve(alertEngine.stop())
    );
    // 3. fallbackWriter 清理定时器
    shutdownManager.register('fallbackCleanupTimer.clear', () => {
        clearInterval(fallbackCleanupTimer);
        return Promise.resolve();
    });
    // 4. debugPersister flush 缓冲区 + 停止定时器（最后执行，确保所有日志已生成）
    shutdownManager.register('debugPersister.stop', () => debugPersister.stop());
}

module.exports = { registerShutdownHooks };
