'use strict';

/**
 * debugPersister fallback 集成测试（G7）
 *
 * 测试策略：
 * - 使用 mock pool 模拟 PG，mock fallbackWriter 模拟文件归档
 * - 验证 PG 不可用/失败时日志正确转 fallback
 * - 验证 buffer 上限保护、连续失败切换、统计字段
 *
 * 文件位置：tests/unit/debugPersisterFallback.test.js
 */

const {
    DebugPersister,
    FLUSH_BATCH_SIZE,
    BUFFER_FORCE_FALLBACK_THRESHOLD,
    CONSECUTIVE_FAILURES_THRESHOLD
} = require('../../server/shared/debugPersister');

// 创建 mock fallback writer
function createMockFallbackWriter() {
    const writes = [];
    const batches = [];
    return {
        write: jest.fn((traceId, entry) => {
            writes.push({ traceId, entry });
            return true;
        }),
        writeBatch: jest.fn((batch) => {
            batches.push(...batch);
            return batch.length;
        }),
        getStats: jest.fn(() => ({ totalWritten: writes.length + batches.length })),
        _writes: writes,
        _batches: batches
    };
}

// 创建 mock PG client（模拟连接失败）
function createFailingClient(errorMsg = 'PG connection lost') {
    return {
        query: async () => { throw new Error(errorMsg); },
        release: () => {}
    };
}

// 创建 mock PG pool
function createMockPool(client) {
    return {
        connect: async () => client,
        query: async () => { throw new Error('pool query failed'); }
    };
}

describe('debugPersister fallback (G7)', () => {
    describe('PG 不可用时直接走 fallback', () => {
        test('pushLog 无 pool 时调用 fallback.write', () => {
            const persister = new DebugPersister();
            const fb = createMockFallbackWriter();
            persister.attachFallbackWriter(fb);

            persister.pushLog('tr-1', {
                level: 'error',
                module: 'm',
                message: 'msg',
                context: { code: 'X' }
            });

            expect(fb.write).toHaveBeenCalledTimes(1);
            expect(fb._writes[0].traceId).toBe('tr-1');
            expect(fb._writes[0].entry.level).toBe('error');
            expect(persister._buffer.length).toBe(0); // 不进 buffer
            expect(persister._fallbackWritten).toBe(1);
        });

        test('pushLog 无 pool 且无 fallback 时静默丢弃', () => {
            const persister = new DebugPersister();
            persister.pushLog('tr-1', { level: 'error', module: 'm', message: 'x' });
            expect(persister._buffer.length).toBe(0);
            expect(persister._fallbackWritten).toBe(0);
        });

        test('flush 无 pool 时整批转 fallback', async () => {
            const persister = new DebugPersister();
            const fb = createMockFallbackWriter();
            persister.attachFallbackWriter(fb);

            // 先注入 pool 让 pushLog 进 buffer，再移除 pool
            const mockClient = {
                query: async () => ({ rowCount: 1 }),
                release: () => {}
            };
            persister.attachPool({ connect: async () => mockClient, query: async () => ({ rowCount: 1 }) });
            persister.pushLog('tr-1', { level: 'info', module: 'm', message: 'x' });
            expect(persister._buffer.length).toBe(1);

            // 模拟 PG 不可用：移除 pool
            persister._pool = null;
            persister._pgWriter = null;

            await persister.flush();
            expect(fb.writeBatch).toHaveBeenCalledTimes(1);
            expect(fb._batches.length).toBe(1);
            expect(persister._buffer.length).toBe(0);
        });
    });

    describe('PG flush 失败时转 fallback', () => {
        test('flush 写入失败时 batch 转 fallback，不放回 buffer', async () => {
            const persister = new DebugPersister();
            const fb = createMockFallbackWriter();
            persister.attachFallbackWriter(fb);

            const failingClient = createFailingClient();
            const pool = createMockPool(failingClient);
            persister.attachPool(pool);

            persister.pushLog('tr-1', { level: 'error', module: 'm', message: 'x' });
            await persister.flush();

            expect(persister._totalErrors).toBe(1);
            expect(persister._consecutiveFailures).toBe(1);
            expect(persister._buffer.length).toBe(0); // 不放回 buffer
            expect(fb.writeBatch).toHaveBeenCalledTimes(1);
            expect(fb._batches.length).toBe(1);
        });

        test('flush 成功时重置 consecutiveFailures', async () => {
            const persister = new DebugPersister();
            const fb = createMockFallbackWriter();
            persister.attachFallbackWriter(fb);

            // 先制造一次失败
            const failClient = createFailingClient();
            persister.attachPool(createMockPool(failClient));
            persister.pushLog('tr-1', { level: 'error', module: 'm', message: 'x' });
            await persister.flush();
            expect(persister._consecutiveFailures).toBe(1);

            // 切换到成功的 pool
            const okClient = {
                query: async () => ({ rowCount: 1 }),
                release: () => {}
            };
            persister.attachPool(createMockPool(okClient));
            persister.pushLog('tr-2', { level: 'info', module: 'm', message: 'y' });
            await persister.flush();

            expect(persister._consecutiveFailures).toBe(0);
            expect(persister._totalWritten).toBe(1);
        });
    });

    describe('连续失败阈值切换', () => {
        test('连续失败达到阈值后 pushLog 直接走 fallback', async () => {
            const persister = new DebugPersister();
            const fb = createMockFallbackWriter();
            persister.attachFallbackWriter(fb);

            const failClient = createFailingClient();
            persister.attachPool(createMockPool(failClient));

            // 制造 CONSECUTIVE_FAILURES_THRESHOLD 次失败
            for (let i = 0; i < CONSECUTIVE_FAILURES_THRESHOLD; i++) {
                persister.pushLog(`tr-fail-${i}`, { level: 'error', module: 'm', message: 'x' });
                await persister.flush();
            }
            expect(persister._consecutiveFailures).toBeGreaterThanOrEqual(CONSECUTIVE_FAILURES_THRESHOLD);

            // 现在 pushLog 应该直接走 fallback，不进 buffer
            const bufferBefore = persister._buffer.length;
            persister.pushLog('tr-after-threshold', { level: 'info', module: 'm', message: 'post' });

            expect(persister._buffer.length).toBe(bufferBefore); // buffer 不增长
            // fallback.write 被调用（注意：之前的失败是 writeBatch，这次是 write）
            expect(fb.write).toHaveBeenCalledWith('tr-after-threshold', expect.objectContaining({ level: 'info' }));
        });
    });

    describe('buffer 上限保护', () => {
        test('buffer 超 BUFFER_FORCE_FALLBACK_THRESHOLD 时 pushLog 走 fallback', () => {
            const persister = new DebugPersister();
            const fb = createMockFallbackWriter();
            persister.attachFallbackWriter(fb);

            // 用成功的 mock pool（不会触发 flush 失败）
            const okClient = {
                query: async () => ({ rowCount: 1 }),
                release: () => {}
            };
            persister.attachPool(createMockPool(okClient));

            // 手动填满 buffer 到阈值
            for (let i = 0; i < BUFFER_FORCE_FALLBACK_THRESHOLD; i++) {
                persister._buffer.push({ id: `id-${i}`, traceId: 'tr-x', timestamp: new Date().toISOString(), level: 'info', module: 'm', message: 'x', context: null });
            }

            // 下一条应该走 fallback
            persister.pushLog('tr-overflow', { level: 'warn', module: 'm', message: 'overflow' });

            expect(fb.write).toHaveBeenCalledTimes(1);
            expect(fb._writes[0].traceId).toBe('tr-overflow');
            // buffer 不应继续增长
            expect(persister._buffer.length).toBe(BUFFER_FORCE_FALLBACK_THRESHOLD);
        });
    });

    describe('getStats 包含 fallback 字段', () => {
        test('未注入 fallback 时 fallbackEnabled 为 false', () => {
            const persister = new DebugPersister();
            const stats = persister.getStats();
            expect(stats.fallbackEnabled).toBe(false);
            expect(stats.fallbackStats).toBeNull();
            expect(stats.consecutiveFailures).toBe(0);
            expect(stats.fallbackWritten).toBe(0);
        });

        test('注入 fallback 后 fallbackEnabled 为 true', () => {
            const persister = new DebugPersister();
            const fb = createMockFallbackWriter();
            persister.attachFallbackWriter(fb);
            const stats = persister.getStats();
            expect(stats.fallbackEnabled).toBe(true);
            expect(stats.fallbackStats).not.toBeNull();
        });

        test('fallback 写入后 fallbackWritten 递增', () => {
            const persister = new DebugPersister();
            const fb = createMockFallbackWriter();
            persister.attachFallbackWriter(fb);

            persister.pushLog('tr-1', { level: 'info', module: 'm', message: 'x' }); // 无 pool，走 fallback
            persister.pushLog('tr-2', { level: 'info', module: 'm', message: 'y' });

            const stats = persister.getStats();
            expect(stats.fallbackWritten).toBe(2);
        });
    });

    describe('attachFallbackWriter', () => {
        test('注入后可被 getStats 识别', () => {
            const persister = new DebugPersister();
            const fb = createMockFallbackWriter();
            persister.attachFallbackWriter(fb);
            expect(persister._fallbackWriter).toBe(fb);
        });

        test('重复注入覆盖旧 writer', () => {
            const persister = new DebugPersister();
            const fb1 = createMockFallbackWriter();
            const fb2 = createMockFallbackWriter();
            persister.attachFallbackWriter(fb1);
            persister.attachFallbackWriter(fb2);
            expect(persister._fallbackWriter).toBe(fb2);
        });
    });

    describe('常量导出', () => {
        test('BUFFER_FORCE_FALLBACK_THRESHOLD 为正整数', () => {
            expect(BUFFER_FORCE_FALLBACK_THRESHOLD).toBeGreaterThan(0);
            expect(Number.isInteger(BUFFER_FORCE_FALLBACK_THRESHOLD)).toBe(true);
        });

        test('CONSECUTIVE_FAILURES_THRESHOLD 为正整数', () => {
            expect(CONSECUTIVE_FAILURES_THRESHOLD).toBeGreaterThan(0);
            expect(Number.isInteger(CONSECUTIVE_FAILURES_THRESHOLD)).toBe(true);
        });
    });
});
