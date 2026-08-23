'use strict';

/**
 * debugPersister 单元测试
 *
 * 测试策略：
 * - 使用 mock pool 模拟 PG 连接（不依赖真实数据库）
 * - 验证缓冲、批量写入、错误重试、统计等逻辑
 * - 验证告警持久化与删除
 *
 * 文件位置：tests/unit/debugPersister.test.js
 */

const { DebugPersister, FLUSH_BATCH_SIZE } = require('../../server/shared/debugPersister');

// 创建 mock client（模拟 PG 事务）
function createMockClient() {
    const queries = [];
    return {
        query: async (sql, params) => {
            queries.push({ sql, params });
            return { rowCount: params ? (Array.isArray(params) ? params.length : 1) : 0 };
        },
        begin: async () => queries.push({ sql: 'BEGIN' }),
        commit: async () => queries.push({ sql: 'COMMIT' }),
        rollback: async () => queries.push({ sql: 'ROLLBACK' }),
        release: () => {},
        _queries: queries
    };
}

// 创建 mock pool
function createMockPool(client) {
    return {
        connect: async () => client,
        query: async (sql, params) => client.query(sql, params)
    };
}

describe('debugPersister', () => {
    let persister;
    let client;
    let pool;

    beforeEach(() => {
        client = createMockClient();
        pool = createMockPool(client);
        persister = new DebugPersister();
        persister.attachPool(pool);
    });

    describe('pushLog + flush', () => {
        test('pushLog 未达批次不触发写入', async () => {
            persister.pushLog('tr-1', {
                timestamp: new Date().toISOString(),
                level: 'error',
                module: 'test',
                message: 'msg',
                context: {}
            });
            // 缓冲区有 1 条，但未达 FLUSH_BATCH_SIZE
            expect(persister._buffer.length).toBe(1);
            // 不应调用 client.query
            expect(client._queries.length).toBe(0);
        });

        test('达到批次大小触发自动 flush', async () => {
            for (let i = 0; i < FLUSH_BATCH_SIZE; i++) {
                persister.pushLog(`tr-${i}`, {
                    timestamp: new Date().toISOString(),
                    level: 'info',
                    module: 'test',
                    message: `msg-${i}`,
                    context: {}
                });
            }
            // 等待异步 flush
            await new Promise(resolve => setImmediate(resolve));
            await persister.flush();
            expect(persister._totalWritten).toBeGreaterThan(0);
            expect(persister._buffer.length).toBe(0);
        });

        test('手动 flush 写入缓冲区数据', async () => {
            persister.pushLog('tr-1', {
                timestamp: new Date().toISOString(),
                level: 'warn',
                module: 'm1',
                message: 'warn msg',
                context: { code: 'TEST' }
            });
            persister.pushLog('tr-1', {
                timestamp: new Date().toISOString(),
                level: 'error',
                module: 'm1',
                message: 'error msg',
                context: { status: 500 }
            });
            await persister.flush();
            expect(persister._totalWritten).toBe(2);
            expect(persister._buffer.length).toBe(0);
        });

        test('无 pool 时 pushLog 静默忽略', () => {
            const p = new DebugPersister();
            p.pushLog('tr-1', { level: 'error', module: 'm', message: 'x' });
            expect(p._buffer.length).toBe(0);
        });

        test('无 pool 时 flush 不报错', async () => {
            const p = new DebugPersister();
            await expect(p.flush()).resolves.not.toThrow();
        });
    });

    describe('persistAlert', () => {
        test('持久化告警调用 pool.query', async () => {
            const alert = {
                id: 'test-rule:level:error',
                ruleId: 'test-rule',
                ruleName: '测试规则',
                severity: 'critical',
                key: 'level:error',
                count: 15,
                threshold: 10,
                triggeredAt: Date.now(),
                acknowledged: false,
                sampleTraceId: 'tr-1',
                sampleMessage: 'sample'
            };
            await persister.persistAlert(alert);
            expect(client._queries.length).toBe(1);
            expect(client._queries[0].params[0]).toBe(alert.id);
        });

        test('无 pool 时 persistAlert 静默忽略', async () => {
            const p = new DebugPersister();
            await expect(p.persistAlert({ id: 'x' })).resolves.not.toThrow();
        });
    });

    describe('deleteAlert', () => {
        test('删除告警调用 pool.query', async () => {
            await persister.deleteAlert('test-id');
            expect(client._queries.length).toBe(1);
            expect(client._queries[0].params[0]).toBe('test-id');
        });

        test('无 pool 时 deleteAlert 静默忽略', async () => {
            const p = new DebugPersister();
            await expect(p.deleteAlert('x')).resolves.not.toThrow();
        });
    });

    describe('cleanup', () => {
        test('清理调用 DELETE 查询', async () => {
            await persister.cleanup();
            // 应该有 3 个 DELETE（logs, traces, alerts）
            const deleteQueries = client._queries.filter(q => q.sql.includes('DELETE'));
            expect(deleteQueries.length).toBe(3);
        });

        test('无 pool 时 cleanup 不报错', async () => {
            const p = new DebugPersister();
            await expect(p.cleanup()).resolves.not.toThrow();
        });
    });

    describe('getArchivedByTraceId', () => {
        test('从 PG 检索归档日志', async () => {
            // 模拟 PG 返回
            client.query = async () => ({
                rows: [
                    { trace_id: 'tr-archived', timestamp: new Date(), level: 'error', module: 'm', message: 'msg', context: { code: 'X' } }
                ]
            });
            const result = await persister.getArchivedByTraceId('tr-archived');
            expect(result).not.toBeNull();
            expect(result.traceId).toBe('tr-archived');
            expect(result.archived).toBe(true);
            expect(result.logs.length).toBe(1);
            expect(result.logs[0].level).toBe('error');
        });

        test('归档日志不存在返回 null', async () => {
            client.query = async () => ({ rows: [] });
            const result = await persister.getArchivedByTraceId('tr-not-exist');
            expect(result).toBeNull();
        });

        test('无 pool 返回 null', async () => {
            const p = new DebugPersister();
            const result = await p.getArchivedByTraceId('tr-1');
            expect(result).toBeNull();
        });
    });

    describe('listArchivedTraces', () => {
        test('从 PG 检索归档 traceId 列表', async () => {
            client.query = async () => ({
                rows: [
                    {
                        trace_id: 'tr-1',
                        created_at: new Date(),
                        updated_at: new Date(),
                        log_count: 5,
                        level_counts: { debug: 0, info: 3, warn: 1, error: 1 },
                        has_error: true
                    }
                ]
            });
            const result = await persister.listArchivedTraces({ limit: 10 });
            expect(result.length).toBe(1);
            expect(result[0].traceId).toBe('tr-1');
            expect(result[0].archived).toBe(true);
            expect(result[0].hasError).toBe(true);
        });

        test('无 pool 返回空数组', async () => {
            const p = new DebugPersister();
            const result = await p.listArchivedTraces();
            expect(result).toEqual([]);
        });
    });

    describe('getStats', () => {
        test('返回持久化统计信息', () => {
            persister.pushLog('tr-1', { level: 'info', module: 'm', message: 'x' });
            const stats = persister.getStats();
            expect(stats.enabled).toBe(true);
            expect(stats.bufferLength).toBe(1);
            expect(stats.totalWritten).toBe(0);
            expect(stats.totalErrors).toBe(0);
            expect(stats.retentionDays).toBeGreaterThan(0);
        });

        test('无 pool 时 enabled 为 false', () => {
            const p = new DebugPersister();
            const stats = p.getStats();
            expect(stats.enabled).toBe(false);
        });
    });

    describe('错误处理', () => {
        test('flush 写入失败时数据转 fallback，不放回 buffer (G7)', async () => {
            // 模拟写入失败
            client.query = async () => { throw new Error('PG connection lost'); };
            persister.pushLog('tr-1', { level: 'error', module: 'm', message: 'x' });
            await persister.flush();
            expect(persister._totalErrors).toBe(1);
            expect(persister._consecutiveFailures).toBe(1);
            // G7: 失败时 batch 转 fallback（无 fallbackWriter 时丢弃），不放回 buffer
            expect(persister._buffer.length).toBe(0);
        });

        test('flush 写入失败且有 fallbackWriter 时数据写入 fallback (G7)', async () => {
            client.query = async () => { throw new Error('PG connection lost'); };
            const fbWrites = [];
            persister.attachFallbackWriter({
                write: (tid, e) => { fbWrites.push({ tid, e }); return true; },
                writeBatch: (batch) => { fbWrites.push(...batch); return batch.length; },
                getStats: () => ({})
            });
            persister.pushLog('tr-1', { level: 'error', module: 'm', message: 'x' });
            await persister.flush();
            expect(persister._totalErrors).toBe(1);
            expect(fbWrites.length).toBe(1);
            expect(persister._fallbackWritten).toBe(1);
        });
    });
});
