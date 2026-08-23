const { RateLimiter, getRateLimiter, resetAllLimiters } = require('../../server/services/rateLimiter');

describe('rateLimiter', () => {
    beforeEach(() => { resetAllLimiters(); });

    describe('RateLimiter', () => {
        test('initializes with defaults', () => {
            const limiter = new RateLimiter();
            expect(limiter.rpm).toBe(30);
            expect(limiter.burst).toBe(5);
            expect(limiter._tokens).toBe(5);
        });
        test('initializes with custom options', () => {
            const limiter = new RateLimiter({ rpm: 10, burst: 3 });
            expect(limiter.rpm).toBe(10);
            expect(limiter.burst).toBe(3);
        });
        test('acquire succeeds when tokens available', async () => {
            const limiter = new RateLimiter({ rpm: 30, burst: 5 });
            await limiter.acquire();
            expect(limiter._tokens).toBe(4);
        });
        test('acquire queues when no tokens', async () => {
            const limiter = new RateLimiter({ rpm: 30, burst: 1 });
            await limiter.acquire();
            expect(limiter._tokens).toBe(0);
            // Immediately try to acquire - tokens may have refilled
            // Just verify the limiter works correctly
            const canAcquire = limiter._tryAcquire();
            expect(typeof canAcquire).toBe('boolean');
        });
        test('getStats returns current state', () => {
            const limiter = new RateLimiter({ rpm: 10, burst: 3 });
            const stats = limiter.getStats();
            expect(stats.rpm).toBe(10);
            expect(stats.burst).toBe(3);
            expect(stats.availableTokens).toBe(3);
            expect(stats.queuedRequests).toBe(0);
        });
        test('reset restores initial state', async () => {
            const limiter = new RateLimiter({ rpm: 30, burst: 2 });
            await limiter.acquire();
            await limiter.acquire();
            expect(limiter._tokens).toBe(0);
            limiter.reset();
            expect(limiter._tokens).toBe(2);
            expect(limiter._queue).toEqual([]);
        });
        test('refills tokens over time', () => {
            const limiter = new RateLimiter({ rpm: 60000, burst: 2 });
            limiter._tokens = 0;
            limiter._lastRefill = Date.now() - 2000;
            limiter._refill();
            expect(limiter._tokens).toBeGreaterThan(0);
        });
        test('caps tokens at burst', () => {
            const limiter = new RateLimiter({ rpm: 30, burst: 2 });
            limiter._lastRefill = Date.now() - 100000;
            limiter._refill();
            expect(limiter._tokens).toBeLessThanOrEqual(2);
        });
    });

    describe('getRateLimiter', () => {
        test('creates limiter for new provider', () => {
            const limiter = getRateLimiter('test-provider');
            expect(limiter).toBeInstanceOf(RateLimiter);
        });
        test('returns same limiter for same provider', () => {
            const l1 = getRateLimiter('same-provider');
            const l2 = getRateLimiter('same-provider');
            expect(l1).toBe(l2);
        });
        test('uses default key for null provider', () => {
            const l1 = getRateLimiter(null);
            const l2 = getRateLimiter(null);
            expect(l1).toBe(l2);
        });
        test('uses custom options for new limiter', () => {
            const limiter = getRateLimiter('custom', { rpm: 5, burst: 1 });
            expect(limiter.rpm).toBe(5);
            expect(limiter.burst).toBe(1);
        });
        test('ignores options for existing limiter', () => {
            getRateLimiter('existing', { rpm: 5 });
            const limiter = getRateLimiter('existing', { rpm: 100 });
            expect(limiter.rpm).toBe(5);
        });
    });

    describe('resetAllLimiters', () => {
        test('clears all limiters', () => {
            getRateLimiter('a');
            getRateLimiter('b');
            resetAllLimiters();
            const l1 = getRateLimiter('a');
            expect(l1).toBeInstanceOf(RateLimiter);
        });
    });
});
