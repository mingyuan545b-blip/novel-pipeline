const _lockQueues = new Map();
const MAX_LOCK_QUEUE_ENTRIES = 1000;
const LOCK_STALE_ENTRY_MS = 300000;

async function acquireLock(type, id) {
    const key = `${type}:${id}`;
    if (!_lockQueues.has(key)) {
        _lockQueues.set(key, { current: Promise.resolve(), lastUsed: Date.now() });
    }
    const queue = _lockQueues.get(key);
    queue.lastUsed = Date.now();
    let releaseFn;
    const nextTurn = new Promise(resolve => { releaseFn = resolve; });
    const prevTurn = queue.current;
    queue.current = nextTurn;
    const maxWaitMs = 15000;
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Lock wait timeout for ${key}`)), maxWaitMs);
    });
    try {
        await Promise.race([prevTurn, timeout]);
    } catch (err) {
        clearTimeout(timeoutId);
        throw err;
    }
    clearTimeout(timeoutId);
    _cleanupLockQueues();
    return releaseFn;
}

function _cleanupLockQueues() {
    if (_lockQueues.size <= MAX_LOCK_QUEUE_ENTRIES) return;
    const now = Date.now();
    const toDelete = [];
    for (const [key, entry] of _lockQueues) {
        if (now - entry.lastUsed > LOCK_STALE_ENTRY_MS) toDelete.push(key);
    }
    for (const key of toDelete) _lockQueues.delete(key);
    if (_lockQueues.size > MAX_LOCK_QUEUE_ENTRIES) {
        const entries = [..._lockQueues.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
        const removeCount = Math.ceil(_lockQueues.size * 0.3);
        for (let i = 0; i < removeCount; i++) _lockQueues.delete(entries[i][0]);
    }
}

function releaseLock(type, id, releaseFn) {
    const key = `${type}:${id}`;
    if (releaseFn) {
        releaseFn();
    } else {
        const queue = _lockQueues.get(key);
        if (queue) queue.current = Promise.resolve();
    }
}

module.exports = { acquireLock, releaseLock, _lockQueues };
