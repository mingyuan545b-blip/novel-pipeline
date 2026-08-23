'use strict';

/**
 * rateLimiter + tokenBucketLimiter 补强测试（S4）
 *
 * 补强点：
 * - _processQueue 异步队列处理（含 setTimeout 分支）
 * - getTokenBucket 缓存逻辑
 * - TokenBucketLimiter.acquire 异步等待
 * - TokenBucketLimiter.reportUsage
 * - SlidingWindowLimiter._clean 边界
 *
 * 文件位置：tests/unit/rateLimiterEnhanced.test.js
 */

const { RateLimiter, getRateLimiter, getTokenBucket, resetAllLimiters } = require('../../server/services/rateLimiter');
const { TokenBucketLimiter, SlidingWindowLimiter } = require('../../server/services/tokenBucketLimiter');

describe('rateLimiter + tokenBucketLimiter 补强 (S4)', () => {
    beforeEach(() => {
        resetAllLimiters();
    });

    describe('RateLimiter._processQueue 异步队列', () => {
        test('队列中请求在 token 恢复后依次执行', async () => {
            const limiter = new RateLimiter({ rpm: 1000, burst: 1 });
            // 消耗唯一的 token
            await limiter.acquire();
            // 此时 token=0，后续 2 个请求入队
            const p1 = limiter.acquire();
            const p2 = limiter.acquire();
            // 等待队列处理完成（rpm=1000 → intervalMs=60ms）
            await new Promise(r => setTimeout(r, 300));
            await Promise.all([p1, p2]);
            expect(limiter._queue.length).toBe(0);
        });

        test('_processing 标志在队列空时重置', async () => {
            const limiter = new RateLimiter({ rpm: 1000, burst: 1 });
            await limiter.acquire();
            const p = limiter.acquire();
            await new Promise(r => setTimeout(r, 200));
            await p;
            // 额外等待 setImmediate 回调执行
            await new Promise(r => setImmediate(r));
            expect(limiter._processing).toBe(false);
        });

        test('getStats 反映队列长度', () => {
            const limiter = new RateLimiter({ rpm: 10, burst: 1 });
            // 直接操作内部状态，不触发异步队列
            limiter._queue = [() => {}, () => {}, () => {}];
            const stats = limiter.getStats();
            expect(stats.queuedRequests).toBe(3);
        });
    });

    describe('RateLimiter._refill 边界', () => {
        test('elapsed 不足时不补充 token', () => {
            const limiter = new RateLimiter({ rpm: 30, burst: 3 });
            limiter._tokens = 1;
            const before = limiter._tokens;
            // 立即调用，elapsed 接近 0
            limiter._refill();
            expect(limiter._tokens).toBe(before);
        });

        test('tokens 不超过 burst 上限', () => {
            const limiter = new RateLimiter({ rpm: 30, burst: 3 });
            limiter._tokens = 3;
            limiter._lastRefill = Date.now() - 100000;
            limiter._refill();
            expect(limiter._tokens).toBeLessThanOrEqual(3);
        });
    });

    describe('getRateLimiter 缓存', () => {
        test('null provider 使用 default key', () => {
            const l1 = getRateLimiter(null);
            const l2 = getRateLimiter(undefined);
            expect(l1).toBe(l2);
        });

        test('空字符串 provider 使用 default key', () => {
            const l1 = getRateLimiter('');
            const l2 = getRateLimiter('');
            expect(l1).toBe(l2);
        });

        test('不同 provider 返回不同实例', () => {
            const l1 = getRateLimiter('a');
            const l2 = getRateLimiter('b');
            expect(l1).not.toBe(l2);
        });
    });

    describe('getTokenBucket 缓存', () => {
        test('首次调用创建新 bucket', () => {
            const bucket = getTokenBucket('test-bucket');
            expect(bucket).toBeInstanceOf(TokenBucketLimiter);
        });

        test('相同 provider 返回相同实例', () => {
            const b1 = getTokenBucket('same-bucket');
            const b2 = getTokenBucket('same-bucket');
            expect(b1).toBe(b2);
        });

        test('null provider 使用 default key', () => {
            const b1 = getTokenBucket(null);
            const b2 = getTokenBucket(null);
            expect(b1).toBe(b2);
        });

        test('自定义 tpm 选项生效', () => {
            const bucket = getTokenBucket('custom-tpm', { tpm: 100000 });
            expect(bucket.capacity).toBe(100000);
            expect(bucket.rate).toBeCloseTo(100000 / 60, 1);
        });

        test('不同 provider 返回不同实例', () => {
            const b1 = getTokenBucket('x');
            const b2 = getTokenBucket('y');
            expect(b1).not.toBe(b2);
        });

        test('resetAllLimiters 清除 token bucket 缓存', () => {
            const b1 = getTokenBucket('reset-test');
            resetAllLimiters();
            const b2 = getTokenBucket('reset-test');
            expect(b1).not.toBe(b2);
        });
    });

    describe('TokenBucketLimiter.acquire 异步', () => {
        test('token 不足时异步等待后成功', async () => {
            const bucket = new TokenBucketLimiter(1000, 10);
            bucket.tokens = 0;
            // 等待很短时间后 token 恢复
            const start = Date.now();
            await bucket.acquire(1);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(0);
        });

        test('token 足够时立即返回', async () => {
            const bucket = new TokenBucketLimiter(100, 1000);
            const start = Date.now();
            await bucket.acquire(1);
            expect(Date.now() - start).toBeLessThan(50);
        });
    });

    describe('TokenBucketLimiter.reportUsage', () => {
        test('扣减额外 token', () => {
            const bucket = new TokenBucketLimiter(100, 1000);
            bucket.tokens = 500;
            bucket.reportUsage(200);
            expect(bucket.tokens).toBe(300);
        });

        test('扣减后不低于 0', () => {
            const bucket = new TokenBucketLimiter(100, 1000);
            bucket.tokens = 100;
            bucket.reportUsage(200);
            expect(bucket.tokens).toBe(0); // Math.max(0, -100) = 0
        });

        test('0 或负值不扣减', () => {
            const bucket = new TokenBucketLimiter(100, 1000);
            bucket.tokens = 500;
            bucket.reportUsage(0);
            expect(bucket.tokens).toBe(500);
            bucket.reportUsage(-10);
            expect(bucket.tokens).toBe(500);
        });
    });

    describe('TokenBucketLimiter.waitTime 边界', () => {
        test('token 足够返回 0', () => {
            const bucket = new TokenBucketLimiter(100, 1000);
            expect(bucket.waitTime(500)).toBe(0);
        });

        test('rate=0 时不抛错', () => {
            const bucket = new TokenBucketLimiter(0, 100);
            bucket.tokens = 0;
            // rate=0 时除法会得到 Infinity，但不应抛错
            const wait = bucket.waitTime(10);
            expect(wait).toBeGreaterThanOrEqual(0);
        });
    });

    describe('SlidingWindowLimiter 补强', () => {
        test('_clean 清除过期请求', () => {
            const limiter = new SlidingWindowLimiter(100, 5);
            limiter.requests = [Date.now() - 200, Date.now() - 150];
            limiter._clean();
            expect(limiter.requests.length).toBe(0);
        });

        test('tryRequest 达到上限返回 false', () => {
            const limiter = new SlidingWindowLimiter(60000, 2);
            expect(limiter.tryRequest()).toBe(true);
            expect(limiter.tryRequest()).toBe(true);
            expect(limiter.tryRequest()).toBe(false);
        });

        test('waitTime 在窗口滑过后返回 0', async () => {
            const limiter = new SlidingWindowLimiter(50, 1);
            limiter.tryRequest();
            expect(limiter.waitTime()).toBeGreaterThan(0);
            await new Promise(r => setTimeout(r, 60));
            expect(limiter.waitTime()).toBe(0);
        });

        test('requests 数组在 _clean 后保留有效请求', () => {
            const limiter = new SlidingWindowLimiter(60000, 5);
            const now = Date.now();
            limiter.requests = [now - 100, now - 50, now];
            limiter._clean();
            expect(limiter.requests.length).toBe(3); // 都在窗口内
        });
    });
});
