/**
 * Store write-lock mechanism for concurrent access safety.
 * Uses a simple Map-based spin lock with stale/timeout detection.
 */
const logger = require('../shared/logger');

const _writeLocks = new Map();

const LOCK_STALE_MS = 10000;
const LOCK_WAIT_MAX_MS = 15000;
const LOCK_POLL_INTERVAL_MS = 50;

async function acquireLock(type, id) {
    const key = `${type}:${id}`;
    const start = Date.now();
    while (true) {
        const holder = _writeLocks.get(key);
        if (!holder) break;
        if (Date.now() - holder.time > LOCK_STALE_MS) {
            _writeLocks.delete(key);
            logger.warn('store', `Lock stale, force breaking: ${key}`);
            break;
        }
        if (Date.now() - start > LOCK_WAIT_MAX_MS) {
            _writeLocks.delete(key);
            logger.warn('store', `Lock wait timeout: ${key}`);
            break;
        }
        await new Promise(r => setTimeout(r, LOCK_POLL_INTERVAL_MS));
    }
    _writeLocks.set(key, { time: Date.now() });
}

function releaseLock(type, id) {
    _writeLocks.delete(`${type}:${id}`);
}

module.exports = { acquireLock, releaseLock };
