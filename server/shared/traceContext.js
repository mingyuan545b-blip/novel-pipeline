'use strict';

/**
 * 请求追踪上下文
 *
 * 基于 AsyncLocalStorage 在整个请求生命周期内共享 traceId，
 * 使 logger、errorHandler、业务层均可无侵入读取当前请求的 traceId，
 * 无需逐层透传 req 对象。
 *
 * 文件位置：server/shared/traceContext.js
 */

const { AsyncLocalStorage } = require('async_hooks');

const traceStorage = new AsyncLocalStorage();

/**
 * 生成短格式 traceId（12 位 base36，足够区分单机请求且便于日志检索）
 * 格式：tr-xxxxxxxxxxxx
 * @returns {string}
 */
function generateTraceId() {
    const ts = Date.now().toString(36).slice(-6);
    const rand = Math.random().toString(36).slice(2, 8);
    return `tr-${ts}${rand}`;
}

/**
 * 在 trace 上下文中执行函数
 * @param {string} traceId - 请求追踪 ID
 * @param {Function} fn - 待执行函数（同步或异步）
 * @returns {*} fn 的返回值
 */
function runWithTraceId(traceId, fn) {
    return traceStorage.run({ traceId }, fn);
}

/**
 * 获取当前请求的 traceId
 * 在请求上下文外调用返回 null
 * @returns {string|null}
 */
function getTraceId() {
    const store = traceStorage.getStore();
    return store ? store.traceId : null;
}

module.exports = {
    generateTraceId,
    runWithTraceId,
    getTraceId
};
