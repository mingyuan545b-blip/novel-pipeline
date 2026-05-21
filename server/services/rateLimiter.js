const DEFAULT_RPM = 30;
const DEFAULT_BURST = 5;

class RateLimiter {
    constructor(options = {}) {
        this.rpm = options.rpm || DEFAULT_RPM;
        this.burst = options.burst || DEFAULT_BURST;
        this._tokens = this.burst;
        this._lastRefill = Date.now();
        this._intervalMs = 60000 / this.rpm;
        this._queue = [];
        this._processing = false;
    }

    _refill() {
        const now = Date.now();
        const elapsed = now - this._lastRefill;
        const tokensToAdd = Math.floor(elapsed / this._intervalMs);
        if (tokensToAdd > 0) {
            this._tokens = Math.min(this._tokens + tokensToAdd, this.burst);
            this._lastRefill = now;
        }
    }

    _tryAcquire() {
        this._refill();
        if (this._tokens >= 1) {
            this._tokens -= 1;
            return true;
        }
        return false;
    }

    async acquire() {
        if (this._tryAcquire()) return;
        return new Promise((resolve) => {
            this._queue.push(resolve);
            this._processQueue();
        });
    }

    _processQueue() {
        if (this._processing) return;
        this._processing = true;
        const tick = () => {
            if (this._queue.length === 0) {
                this._processing = false;
                return;
            }
            if (this._tryAcquire()) {
                const next = this._queue.shift();
                next();
                setImmediate(tick);
            } else {
                const waitMs = Math.max(this._intervalMs, 100);
                setTimeout(() => {
                    if (this._tryAcquire()) {
                        const next = this._queue.shift();
                        next();
                    }
                    setImmediate(tick);
                }, waitMs);
            }
        };
        setImmediate(tick);
    }

    getStats() {
        this._refill();
        return {
            rpm: this.rpm,
            burst: this.burst,
            availableTokens: this._tokens,
            queuedRequests: this._queue.length
        };
    }

    reset() {
        this._tokens = this.burst;
        this._lastRefill = Date.now();
        this._queue = [];
        this._processing = false;
    }
}

const _limiters = new Map();

function getRateLimiter(provider, options = {}) {
    const key = provider || 'default';
    if (!_limiters.has(key)) {
        const rpm = options.rpm || DEFAULT_RPM;
        const burst = options.burst || DEFAULT_BURST;
        _limiters.set(key, new RateLimiter({ rpm, burst }));
    }
    return _limiters.get(key);
}

function resetAllLimiters() {
    _limiters.clear();
}

module.exports = { RateLimiter, getRateLimiter, resetAllLimiters };
