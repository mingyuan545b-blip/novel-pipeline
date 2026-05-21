const { RateLimiter, getRateLimiter, resetAllLimiters } = require('../../server/services/rateLimiter');

describe('RateLimiter', () => {
    beforeEach(() => {
        resetAllLimiters();
    });

    test('allows immediate requests up to burst capacity', () => {
        const limiter = new RateLimiter({ rpm: 60, burst: 3 });
        expect(limiter._tryAcquire()).toBe(true);
        expect(limiter._tryAcquire()).toBe(true);
        expect(limiter._tryAcquire()).toBe(true);
    });

    test('rejects requests beyond burst capacity', () => {
        const limiter = new RateLimiter({ rpm: 60, burst: 2 });
        expect(limiter._tryAcquire()).toBe(true);
        expect(limiter._tryAcquire()).toBe(true);
        expect(limiter._tryAcquire()).toBe(false);
    });

    test('tokens refill over time', () => {
        const limiter = new RateLimiter({ rpm: 60000, burst: 1 });
        expect(limiter._tryAcquire()).toBe(true);
        expect(limiter._tryAcquire()).toBe(false);
        limiter._lastRefill = Date.now() - 100;
        expect(limiter._tryAcquire()).toBe(true);
    });

    test('tokens do not exceed burst capacity after refill', () => {
        const limiter = new RateLimiter({ rpm: 60, burst: 3 });
        limiter._tokens = 0;
        limiter._lastRefill = Date.now() - 100000;
        limiter._refill();
        expect(limiter._tokens).toBe(3);
    });

    test('acquire resolves immediately when tokens available', async () => {
        const limiter = new RateLimiter({ rpm: 60, burst: 5 });
        const start = Date.now();
        await limiter.acquire();
        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(100);
    });

    test('acquire queues when no tokens available', async () => {
        const limiter = new RateLimiter({ rpm: 60000, burst: 1 });
        await limiter.acquire();
        expect(limiter._queue.length).toBe(0);
        limiter._tokens = 0;
        const acquirePromise = limiter.acquire();
        expect(limiter._queue.length).toBe(1);
        limiter._tokens = 1;
        limiter._lastRefill = Date.now() - 100;
        await acquirePromise;
    });

    test('getStats returns correct information', () => {
        const limiter = new RateLimiter({ rpm: 30, burst: 5 });
        limiter._tryAcquire();
        const stats = limiter.getStats();
        expect(stats.rpm).toBe(30);
        expect(stats.burst).toBe(5);
        expect(stats.availableTokens).toBe(4);
        expect(stats.queuedRequests).toBe(0);
    });

    test('reset restores full burst capacity', () => {
        const limiter = new RateLimiter({ rpm: 60, burst: 5 });
        limiter._tryAcquire();
        limiter._tryAcquire();
        limiter._tryAcquire();
        limiter.reset();
        expect(limiter._tokens).toBe(5);
        expect(limiter._queue.length).toBe(0);
    });

    test('getRateLimiter returns same instance for same provider', () => {
        const limiter1 = getRateLimiter('test-provider');
        const limiter2 = getRateLimiter('test-provider');
        expect(limiter1).toBe(limiter2);
    });

    test('getRateLimiter returns different instances for different providers', () => {
        const limiter1 = getRateLimiter('provider-a');
        const limiter2 = getRateLimiter('provider-b');
        expect(limiter1).not.toBe(limiter2);
    });

    test('getRateLimiter uses default for no provider', () => {
        const limiter = getRateLimiter();
        expect(limiter).toBeDefined();
        expect(limiter.rpm).toBe(30);
    });

    test('getRateLimiter accepts custom options on first call', () => {
        const limiter = getRateLimiter('custom', { rpm: 100, burst: 20 });
        expect(limiter.rpm).toBe(100);
        expect(limiter.burst).toBe(20);
    });
});
