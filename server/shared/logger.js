const logger = {
    debug(module, message, context = {}) {
        if (process.env.LOG_LEVEL === 'debug') {
            console.debug(`[DEBUG] [${module}] ${message}`, context);
        }
    },
    info(module, message, context = {}) {
        console.info(`[INFO] [${module}] ${message}`, context);
    },
    warn(module, message, context = {}) {
        console.warn(`[WARN] [${module}] ${message}`, context);
    },
    error(module, message, context = {}) {
        console.error(`[ERROR] [${module}] ${message}`, context);
    }
};

module.exports = logger;
