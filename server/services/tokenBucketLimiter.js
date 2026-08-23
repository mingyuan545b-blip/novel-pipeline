const logger = require('../shared/logger');

class TokenBucketLimiter {
    constructor(rate, capacity) {
        this.rate = rate;
        this.capacity = capacity;
        this.tokens = capacity;
        this.lastRefill = Date.now();
    }

    _refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.rate);
        this.lastRefill = now;
    }

    tryConsume(count = 1) {
        this._refill();
        if (this.tokens >= count) {
            this.tokens -= count;
            return true;
        }
        return false;
    }

    waitTime(count = 1) {
        this._refill();
        if (this.tokens >= count) return 0;
        return Math.ceil(((count - this.tokens) / this.rate) * 1000);
    }

    getStatus() {
        this._refill();
        return { tokens: this.tokens, capacity: this.capacity, rate: this.rate };
    }

    async acquire(count = 1) {
        while (!this.tryConsume(count)) {
            const wait = this.waitTime(count);
            await new Promise(r => setTimeout(r, Math.min(wait, 1000)));
        }
    }

    reportUsage(extraTokens) {
        if (extraTokens > 0) {
            this.tokens = Math.max(0, this.tokens - extraTokens);
        }
    }
}

class SlidingWindowLimiter {
    constructor(windowMs, maxRequests) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.requests = [];
    }

    _clean() {
        const cutoff = Date.now() - this.windowMs;
        this.requests = this.requests.filter(t => t > cutoff);
    }

    tryRequest() {
        this._clean();
        if (this.requests.length < this.maxRequests) {
            this.requests.push(Date.now());
            return true;
        }
        return false;
    }

    waitTime() {
        this._clean();
        if (this.requests.length < this.maxRequests) return 0;
        return this.requests[0] + this.windowMs - Date.now();
    }
}

module.exports = { TokenBucketLimiter, SlidingWindowLimiter };
