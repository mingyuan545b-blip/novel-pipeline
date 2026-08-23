/**
 * 增强型日志模块
 *
 * 功能：
 * - 日志级别控制（LOG_LEVEL环境变量）
 * - 时间戳
 * - 生产环境JSON输出
 * - traceId 自动注入（基于 AsyncLocalStorage，需配合 traceIdMiddleware）
 * - 日志持久化 sink：可选写入 logStore（便于按 traceId 检索）
 * - 向后兼容现有API
 *
 * 日志级别：debug < info < warn < error
 * 文件位置：server/shared/logger.js
 */

const { getTraceId } = require('./traceContext');

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const currentLevel = process.env.LOG_LEVEL || 'info';
const currentLevelNum = LOG_LEVELS[currentLevel] !== undefined ? LOG_LEVELS[currentLevel] : LOG_LEVELS.info;
const isProduction = process.env.NODE_ENV === 'production';

// 日志 sink：默认不启用，由应用启动时调用 attachLogStore 注入
// 通过依赖注入避免循环依赖（logStore 不直接 require logger）
let _logStore = null;
const LOG_STORE_ENABLED = process.env.LOG_STORE_ENABLED !== 'false'; // 默认启用

function _formatTimestamp() {
    return new Date().toISOString();
}

function _shouldLog(level) {
    return LOG_LEVELS[level] >= currentLevelNum;
}

function _formatOutput(level, module, message, context) {
    const timestamp = _formatTimestamp();
    const traceId = getTraceId();

    if (isProduction) {
        const payload = {
            timestamp,
            level,
            module,
            message,
            ...context
        };
        // traceId 自动注入：在请求上下文内自动添加，不在上下文内（如启动阶段）则省略
        if (traceId) payload.traceId = traceId;
        return JSON.stringify(payload);
    }

    const levelTag = `[${level.toUpperCase()}]`;
    const traceTag = traceId ? `[${traceId}]` : '';
    const contextStr = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
    return `${timestamp} ${levelTag}${traceTag} [${module}] ${message}${contextStr}`;
}

/**
 * 写入 logStore（如果已注入且启用）
 * @param {string} level
 * @param {string} module
 * @param {string} message
 * @param {Object} context
 * @param {string} traceId
 */
function _writeToStore(level, module, message, context, traceId) {
    if (!_logStore || !LOG_STORE_ENABLED) return;
    try {
        _logStore.append(traceId, {
            timestamp: _formatTimestamp(),
            level,
            module,
            message,
            context
        });
    } catch {
        // sink 失败不得影响主日志流，静默吞掉
    }
}

/**
 * 注入 logStore 实例（应用启动期调用一次）
 * @param {{append: Function}} store
 */
function attachLogStore(store) {
    _logStore = store;
}

const logger = {
    debug(module, message, context = {}) {
        if (!_shouldLog('debug')) return;
        const traceId = getTraceId();
        const output = _formatOutput('debug', module, message, context);
        console.debug(output);
        _writeToStore('debug', module, message, context, traceId);
    },
    info(module, message, context = {}) {
        if (!_shouldLog('info')) return;
        const traceId = getTraceId();
        const output = _formatOutput('info', module, message, context);
        console.info(output);
        _writeToStore('info', module, message, context, traceId);
    },
    warn(module, message, context = {}) {
        if (!_shouldLog('warn')) return;
        const traceId = getTraceId();
        const output = _formatOutput('warn', module, message, context);
        console.warn(output);
        _writeToStore('warn', module, message, context, traceId);
    },
    error(module, message, context = {}) {
        if (!_shouldLog('error')) return;
        const traceId = getTraceId();
        const output = _formatOutput('error', module, message, context);
        console.error(output);
        _writeToStore('error', module, message, context, traceId);
    },
    getConfig() {
        return {
            level: currentLevel,
            isProduction,
            levels: LOG_LEVELS,
            logStoreEnabled: LOG_STORE_ENABLED && _logStore !== null
        };
    },
    attachLogStore
};

module.exports = logger;
