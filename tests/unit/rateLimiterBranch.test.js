const { RateLimiter, getRateLimiter, resetAllLimiters } = require('../../server/services/rateLimiter');

describe('rateLimiter - branch coverage', () => {
    beforeEach(() => {
        resetAllLimiters();
    });

    describe('RateLimiter - constructor', () => {
        test('uses default values when no options', () => {
            const limiter = new RateLimiter();
            expect(limiter.rpm).toBe(30);
            expect(limiter.burst).toBe(5);
        });

        test('uses custom rpm and burst', () => {
            const limiter = new RateLimiter({ rpm: 100, burst: 20 });
            expect(limiter.rpm).toBe(100);
            expect(limiter.burst).toBe(20);
        });
    });

    describe('RateLimiter - _tryAcquire', () => {
        test('returns true and decrements tokens when available', () => {
            const limiter = new RateLimiter({ rpm: 60, burst: 10 });
            expect(limiter._tryAcquire()).toBe(true);
            expect(limiter._tokens).toBe(9);
        });

        test('returns false when no tokens', () => {
            const limiter = new RateLimiter({ rpm: 60, burst: 1 });
            limiter._tokens = 0;
            expect(limiter._tryAcquire()).toBe(false);
        });
    });

    describe('RateLimiter - _refill', () => {
        test('adds tokens based on elapsed time', () => {
            const limiter = new RateLimiter({ rpm: 60, burst: 10 });
            limiter._tokens = 0;
            limiter._lastRefill = Date.now() - 2000;
            limiter._refill();
            expect(limiter._tokens).toBeGreaterThan(0);
        });

        test('caps tokens at burst', () => {
            const limiter = new RateLimiter({ rpm: 60, burst: 5 });
            limiter._tokens = 4;
            limiter._lastRefill = Date.now() - 10000;
            limiter._refill();
            expect(limiter._tokens).toBeLessThanOrEqual(5);
        });

        test('does nothing when no time elapsed', () => {
            const limiter = new RateLimiter({ rpm: 60, burst: 10 });
            limiter._tokens = 3;
            const before = limiter._tokens;
            limiter._refill();
            expect(limiter._tokens).toBe(before);
        });
    });

    describe('RateLimiter - acquire', () => {
        test('resolves immediately when tokens available', async () => {
            const limiter = new RateLimiter({ rpm: 60, burst: 10 });
            const started = Date.now();
            await limiter.acquire();
            expect(Date.now() - started).toBeLessThan(200);   // 有票即取，不排队
        });

        test('queues when tokens exhausted and resolves after wait', async () => {
            const limiter = new RateLimiter({ rpm: 60000, burst: 1 });
            await limiter.acquire();
            const promise = limiter.acquire();
            expect(promise).toBeInstanceOf(Promise);
            await promise;
        }, 10000);
    });

    describe('RateLimiter - getStats', () => {
        test('returns current stats', () => {
            const limiter = new RateLimiter({ rpm: 30, burst: 5 });
            const stats = limiter.getStats();
            expect(stats).toHaveProperty('rpm', 30);
            expect(stats).toHaveProperty('burst', 5);
            expect(stats).toHaveProperty('availableTokens');
            expect(stats).toHaveProperty('queuedRequests');
        });
    });

    describe('RateLimiter - reset', () => {
        test('resets tokens and queue', () => {
            const limiter = new RateLimiter({ rpm: 60000, burst: 1 });
            limiter._tokens = 0;
            limiter._queue = [jest.fn()];
            limiter._processing = true;
            limiter.reset();
            expect(limiter._tokens).toBe(1);
            expect(limiter._queue.length).toBe(0);
            expect(limiter._processing).toBe(false);
        });
    });

    describe('getRateLimiter', () => {
        test('creates new limiter for new provider', () => {
            const limiter = getRateLimiter('test-provider');
            expect(limiter).toBeInstanceOf(RateLimiter);
        });

        test('returns existing limiter for same provider', () => {
            const l1 = getRateLimiter('same-provider');
            const l2 = getRateLimiter('same-provider');
            expect(l1).toBe(l2);
        });

        test('uses default provider key when none given', () => {
            const limiter = getRateLimiter();
            expect(limiter).toBeInstanceOf(RateLimiter);
        });

        test('uses custom rpm and burst options', () => {
            const limiter = getRateLimiter('custom', { rpm: 100, burst: 20 });
            expect(limiter.rpm).toBe(100);
            expect(limiter.burst).toBe(20);
        });
    });
});
