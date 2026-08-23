const { TokenBucketLimiter, SlidingWindowLimiter } = require('../../server/services/tokenBucketLimiter');

describe('tokenBucketLimiter', () => {
    describe('TokenBucketLimiter', () => {
        test('initializes with full capacity', () => {
            const bucket = new TokenBucketLimiter(100, 1000);
            expect(bucket.tokens).toBe(1000);
            expect(bucket.capacity).toBe(1000);
            expect(bucket.rate).toBe(100);
        });

        test('tryConsume succeeds when enough tokens', () => {
            const bucket = new TokenBucketLimiter(100, 1000);
            expect(bucket.tryConsume(100)).toBe(true);
            expect(bucket.tokens).toBe(900);
        });

        test('tryConsume fails when not enough tokens', () => {
            const bucket = new TokenBucketLimiter(100, 100);
            bucket.tokens = 50;
            expect(bucket.tryConsume(100)).toBe(false);
        });

        test('tryConsume defaults to 1 token', () => {
            const bucket = new TokenBucketLimiter(100, 1000);
            expect(bucket.tryConsume()).toBe(true);
            expect(bucket.tokens).toBe(999);
        });

        test('waitTime returns 0 when enough tokens', () => {
            const bucket = new TokenBucketLimiter(100, 1000);
            expect(bucket.waitTime(100)).toBe(0);
        });

        test('waitTime returns positive when not enough tokens', () => {
            const bucket = new TokenBucketLimiter(100, 100);
            bucket.tokens = 0;
            expect(bucket.waitTime(100)).toBeGreaterThan(0);
        });

        test('getStatus returns current state', () => {
            const bucket = new TokenBucketLimiter(50, 500);
            bucket.tryConsume(100);
            const status = bucket.getStatus();
            expect(status.tokens).toBeDefined();
            expect(status.capacity).toBe(500);
            expect(status.rate).toBe(50);
        });

        test('refills tokens over time', () => {
            const bucket = new TokenBucketLimiter(100, 1000);
            bucket.tokens = 0;
            bucket.lastRefill = Date.now() - 1000;
            bucket._refill();
            expect(bucket.tokens).toBeGreaterThan(0);
        });

        test('does not exceed capacity on refill', () => {
            const bucket = new TokenBucketLimiter(100, 100);
            bucket.tokens = 99;
            bucket.lastRefill = Date.now() - 10000;
            bucket._refill();
            expect(bucket.tokens).toBeLessThanOrEqual(100);
        });
    });

    describe('SlidingWindowLimiter', () => {
        test('allows requests within limit', () => {
            const limiter = new SlidingWindowLimiter(60000, 5);
            expect(limiter.tryRequest()).toBe(true);
        });

        test('blocks requests over limit', () => {
            const limiter = new SlidingWindowLimiter(60000, 2);
            limiter.tryRequest();
            limiter.tryRequest();
            expect(limiter.tryRequest()).toBe(false);
        });

        test('waitTime returns 0 when under limit', () => {
            const limiter = new SlidingWindowLimiter(60000, 5);
            expect(limiter.waitTime()).toBe(0);
        });

        test('waitTime returns positive when at limit', () => {
            const limiter = new SlidingWindowLimiter(60000, 1);
            limiter.tryRequest();
            expect(limiter.waitTime()).toBeGreaterThan(0);
        });

        test('cleans old requests from window', () => {
            const limiter = new SlidingWindowLimiter(1, 1);
            limiter.tryRequest();
            const wait = limiter.waitTime();
            expect(wait).toBeGreaterThanOrEqual(0);
        });
    });
});
