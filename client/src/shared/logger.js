/**
 * Frontend logger - thin wrapper around console for structured logging.
 * In production, this could be replaced with a remote logging service.
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[import.meta.env?.VITE_LOG_LEVEL || 'warn'];

function formatMsg(level, tag, message) {
    return `[${level.toUpperCase()}] [${tag}] ${message}`;
}

const logger = {
    debug(tag, message, ...args) {
        if (currentLevel <= LOG_LEVELS.debug) console.debug(formatMsg('debug', tag, message), ...args);
    },
    info(tag, message, ...args) {
        if (currentLevel <= LOG_LEVELS.info) console.info(formatMsg('info', tag, message), ...args);
    },
    warn(tag, message, ...args) {
        if (currentLevel <= LOG_LEVELS.warn) console.warn(formatMsg('warn', tag, message), ...args);
    },
    error(tag, message, ...args) {
        if (currentLevel <= LOG_LEVELS.error) console.error(formatMsg('error', tag, message), ...args);
    }
};

export default logger;
