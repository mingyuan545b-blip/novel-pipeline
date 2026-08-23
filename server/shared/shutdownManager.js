'use strict';

/**
 * 优雅关闭管理器（Q4）
 *
 * 职责：
 * 1. 统一注册关闭处理器（LIFO 顺序执行：后注册的先关闭）
 * 2. 接收 SIGTERM/SIGINT 信号触发关闭流程
 * 3. 每个处理器独立 try/catch，单个失败不阻塞其他
 * 4. 超时强退保护（默认 10 秒）
 *
 * 设计权衡：
 * - LIFO 顺序：先关闭依赖方（如 HTTP server），再关闭被依赖方（如 DB pool）
 * - 不引入外部依赖，纯 JS 实现
 *
 * 文件位置：server/shared/shutdownManager.js
 */

const logger = require('./logger');

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10 * 1000;
const SHUTDOWN_HOOKS_MAX = 20;

class ShutdownManager {
    constructor() {
        /** @type {Array<{name: string, handler: Function, timeoutMs?: number}>} */
        this._hooks = [];
        this._isShuttingDown = false;
        this._signalHandlersBound = false;
        this._forceExitTimer = null;
    }

    /**
     * 注册关闭处理器（后注册的先执行 — LIFO）
     * @param {string} name - 处理器名称（日志用）
     * @param {Function} handler - 异步或同步关闭函数
     * @param {Object} [opts] - { timeoutMs }
     */
    register(name, handler, opts = {}) {
        if (typeof handler !== 'function') {
            throw new Error(`ShutdownManager.register: handler must be a function (name=${name})`);
        }
        if (this._hooks.length >= SHUTDOWN_HOOKS_MAX) {
            throw new Error(`ShutdownManager.register: hooks exceeded max ${SHUTDOWN_HOOKS_MAX}`);
        }
        this._hooks.push({
            name,
            handler,
            timeoutMs: opts.timeoutMs || DEFAULT_SHUTDOWN_TIMEOUT_MS
        });
    }

    /**
     * 绑定 SIGTERM/SIGINT 信号处理器（仅绑定一次）
     */
    bindSignalHandlers() {
        if (this._signalHandlersBound) return;
        process.on('SIGTERM', () => this.trigger('SIGTERM'));
        process.on('SIGINT', () => this.trigger('SIGINT'));
        this._signalHandlersBound = true;
    }

    /**
     * 触发关闭流程
     * @param {string} signal - 信号名
     */
    async trigger(signal) {
        if (this._isShuttingDown) {
            logger.warn('shutdownManager', `[SHUTDOWN] Already in progress, skip ${signal}`);
            return;
        }
        this._isShuttingDown = true;
        logger.info('shutdownManager', `[SHUTDOWN] ${signal} received, executing ${this._hooks.length} hooks (LIFO)`);

        // 超时强退保护
        this._forceExitTimer = setTimeout(() => {
            logger.error('shutdownManager', `[SHUTDOWN] Force exit after ${DEFAULT_SHUTDOWN_TIMEOUT_MS}ms timeout`);
            process.exit(1);
        }, DEFAULT_SHUTDOWN_TIMEOUT_MS);
        if (this._forceExitTimer.unref) this._forceExitTimer.unref();

        // LIFO 顺序执行
        const errors = [];
        while (this._hooks.length > 0) {
            const hook = this._hooks.pop();
            const startTs = Date.now();
            try {
                await hook.handler();
                logger.info('shutdownManager', `[SHUTDOWN] ✓ ${hook.name} (${Date.now() - startTs}ms)`);
            } catch (e) {
                errors.push({ name: hook.name, error: e.message });
                logger.warn('shutdownManager', `[SHUTDOWN] ✗ ${hook.name} failed: ${e.message}`);
            }
        }

        if (errors.length > 0) {
            logger.warn('shutdownManager', `[SHUTDOWN] Completed with ${errors.length} errors`);
        } else {
            logger.info('shutdownManager', '[SHUTDOWN] All hooks completed cleanly');
        }

        if (this._forceExitTimer) {
            clearTimeout(this._forceExitTimer);
            this._forceExitTimer = null;
        }
        process.exit(0);
    }

    /**
     * 获取注册的 hook 数量（测试用）
     */
    getHookCount() {
        return this._hooks.length;
    }

    /**
     * 获取 hook 名称列表（按注册顺序，测试用）
     */
    getHookNames() {
        return this._hooks.map(h => h.name);
    }

    /**
     * 是否正在关闭中（测试用）
     */
    isShuttingDown() {
        return this._isShuttingDown;
    }

    /**
     * 重置内部状态（仅测试用，生产环境不会调用）
     */
    _resetForTest() {
        this._hooks = [];
        this._isShuttingDown = false;
        this._forceExitTimer = null;
    }
}

// 单例
const shutdownManager = new ShutdownManager();

module.exports = {
    ShutdownManager,
    shutdownManager,
    DEFAULT_SHUTDOWN_TIMEOUT_MS,
    SHUTDOWN_HOOKS_MAX
};
