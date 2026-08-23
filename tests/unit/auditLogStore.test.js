'use strict';

/**
 * auditLog + auditLogStore 审计日志独立持久化测试（Q7）
 *
 * 测试策略：
 * - auditLogStore: mock PG pool / 真实临时目录验证 fallback 文件
 * - auditLog: 验证向后兼容（log/query/getStats/clearEntries API 不变）
 * - 验证持久化层与内存层职责分离
 *
 * 文件位置：tests/unit/auditLogStore.test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { AuditLogStore, auditLogStore, AUDIT_TABLE, FALLBACK_DIR_NAME, MEMORY_RETENTION } = require('../../server/shared/auditLogStore');
const auditLog = require('../../server/services/auditLog');

function makeTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
}

function makeEntry(overrides = {}) {
    return {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        action: 'project:create',
        projectId: 'p1',
        userId: 'system',
        timestamp: new Date().toISOString(),
        summary: 'test summary',
        metadata: { key: 'value' },
        ...overrides
    };
}

describe('auditLogStore (Q7)', () => {
    describe('常量', () => {
        test('AUDIT_TABLE 为字符串', () => {
            expect(typeof AUDIT_TABLE).toBe('string');
            expect(AUDIT_TABLE).toBe('audit_logs');
        });

        test('FALLBACK_DIR_NAME 为字符串', () => {
            expect(typeof FALLBACK_DIR_NAME).toBe('string');
            expect(FALLBACK_DIR_NAME).toBe('audit-fallback');
        });

        test('MEMORY_RETENTION 为正整数', () => {
            expect(MEMORY_RETENTION).toBeGreaterThan(0);
            expect(Number.isInteger(MEMORY_RETENTION)).toBe(true);
        });
    });

    describe('fallback 文件写入', () => {
        let tmpDir;
        beforeEach(() => { tmpDir = makeTmpDir(); });
        afterEach(() => { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true }); });

        test('无 PG 时写入 fallback 文件', async () => {
            const store = new AuditLogStore();
            store.setFallbackDir(tmpDir);
            const entry = makeEntry({ id: 'test-1' });
            await store.persist(entry);
            const dir = path.join(tmpDir, FALLBACK_DIR_NAME);
            const files = fs.readdirSync(dir);
            expect(files.length).toBe(1);
            const content = fs.readFileSync(path.join(dir, files[0]), 'utf8');
            const parsed = JSON.parse(content.trim());
            expect(parsed.id).toBe('test-1');
            expect(parsed.action).toBe('project:create');
        });

        test('多条目追加到同一文件', async () => {
            const store = new AuditLogStore();
            store.setFallbackDir(tmpDir);
            for (let i = 0; i < 5; i++) {
                await store.persist(makeEntry({ id: `test-${i}` }));
            }
            const dir = path.join(tmpDir, FALLBACK_DIR_NAME);
            const files = fs.readdirSync(dir);
            expect(files.length).toBe(1);
            const content = fs.readFileSync(path.join(dir, files[0]), 'utf8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(5);
        });

        test('fallbackWritten 递增', async () => {
            const store = new AuditLogStore();
            store.setFallbackDir(tmpDir);
            await store.persist(makeEntry());
            await store.persist(makeEntry());
            const stats = store.getStats();
            expect(stats.fallbackWritten).toBe(2);
            expect(stats.totalWritten).toBe(0); // PG 未启用
        });

        test('未设置 fallbackDir 时不抛错', async () => {
            const store = new AuditLogStore();
            const entry = makeEntry();
            await expect(store.persist(entry)).resolves.not.toThrow();
        });
    });

    describe('PG 写入', () => {
        test('PG 写入成功时调用 client.query', async () => {
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rowCount: 1 }),
                release: jest.fn()
            };
            const mockPool = {
                connect: jest.fn().mockResolvedValue(mockClient)
            };
            const store = new AuditLogStore();
            store.attachPool(mockPool);
            const entry = makeEntry({ id: 'pg-1' });
            await store.persist(entry);
            expect(mockClient.query).toHaveBeenCalledTimes(1);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            const stats = store.getStats();
            expect(stats.totalWritten).toBe(1);
            expect(stats.pgEnabled).toBe(true);
        });

        test('PG 写入失败时 fallback 到文件', async () => {
            const tmpDir = makeTmpDir();
            try {
                const mockClient = {
                    query: jest.fn().mockRejectedValue(new Error('PG down')),
                    release: jest.fn()
                };
                const mockPool = { connect: jest.fn().mockResolvedValue(mockClient) };
                const store = new AuditLogStore();
                store.attachPool(mockPool);
                store.setFallbackDir(tmpDir);
                const entry = makeEntry({ id: 'fallback-1' });
                await store.persist(entry);
                const dir = path.join(tmpDir, FALLBACK_DIR_NAME);
                const files = fs.readdirSync(dir);
                expect(files.length).toBe(1);
                const stats = store.getStats();
                expect(stats.totalErrors).toBe(1);
                expect(stats.fallbackWritten).toBe(1);
            } finally {
                if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });
    });

    describe('queryArchived', () => {
        test('无 PG 返回空数组', async () => {
            const store = new AuditLogStore();
            const result = await store.queryArchived({ limit: 10 });
            expect(result).toEqual([]);
        });

        test('PG 查询返回映射后的条目', async () => {
            const mockResult = {
                rows: [{
                    id: 'r1',
                    action: 'project:create',
                    project_id: 'p1',
                    user_id: 'u1',
                    timestamp: new Date('2026-06-28T12:00:00Z'),
                    summary: 'test',
                    metadata: '{"k":"v"}'
                }]
            };
            const mockPool = { query: jest.fn().mockResolvedValue(mockResult) };
            const store = new AuditLogStore();
            store.attachPool(mockPool);
            const result = await store.queryArchived({ action: 'project:create', limit: 10 });
            expect(result.length).toBe(1);
            expect(result[0].id).toBe('r1');
            expect(result[0].projectId).toBe('p1');
            expect(result[0].metadata).toEqual({ k: 'v' });
        });

        test('PG 查询失败返回空数组', async () => {
            const mockPool = { query: jest.fn().mockRejectedValue(new Error('PG down')) };
            const store = new AuditLogStore();
            store.attachPool(mockPool);
            const result = await store.queryArchived();
            expect(result).toEqual([]);
            expect(store.getStats().totalErrors).toBeGreaterThan(0);
        });
    });

    describe('getStats', () => {
        test('初始状态', () => {
            const store = new AuditLogStore();
            const stats = store.getStats();
            expect(stats.pgEnabled).toBe(false);
            expect(stats.totalWritten).toBe(0);
            expect(stats.totalErrors).toBe(0);
            expect(stats.fallbackWritten).toBe(0);
        });
    });
});

describe('auditLog (Q7 向后兼容)', () => {
    beforeEach(() => {
        auditLog.clearEntries();
    });

    describe('ACTIONS', () => {
        test('冻结不可变', () => {
            expect(Object.isFrozen(auditLog.ACTIONS)).toBe(true);
        });

        test('包含关键动作', () => {
            expect(auditLog.ACTIONS.PROJECT_CREATE).toBe('project:create');
            expect(auditLog.ACTIONS.PIPELINE_START).toBe('pipeline:start');
            expect(auditLog.ACTIONS.CONFIG_CHANGE).toBe('config:change');
        });
    });

    describe('log', () => {
        test('返回完整条目', () => {
            const entry = auditLog.log('project:create', {
                projectId: 'p1',
                summary: 'test',
                metadata: { k: 'v' }
            });
            expect(entry.id).toMatch(/^audit_\d+_/);
            expect(entry.action).toBe('project:create');
            expect(entry.projectId).toBe('p1');
            expect(entry.userId).toBe('system');
            expect(entry.summary).toBe('test');
            expect(entry.metadata).toEqual({ k: 'v' });
            expect(entry.timestamp).toBeTruthy();
        });

        test('默认值正确', () => {
            const entry = auditLog.log('test:action');
            expect(entry.projectId).toBeNull();
            expect(entry.userId).toBe('system');
            expect(entry.summary).toBe('');
            expect(entry.metadata).toEqual({});
        });

        test('写入内存条目', () => {
            auditLog.log('project:create', { summary: 'a' });
            auditLog.log('project:delete', { summary: 'b' });
            const all = auditLog.query();
            expect(all.length).toBe(2);
            // unshift: 最新的在前
            expect(all[0].action).toBe('project:delete');
        });

        test('异步触发持久化（不阻塞）', async () => {
            // 即使 auditLogStore 未配置 PG/fallback，log 也不应抛错
            const entry = auditLog.log('test:action');
            expect(entry).toBeDefined();
            // 等待微任务
            await new Promise(r => setImmediate(r));
        });
    });

    describe('query', () => {
        beforeEach(() => {
            auditLog.log('project:create', { projectId: 'p1', summary: 'a' });
            auditLog.log('project:delete', { projectId: 'p2', summary: 'b' });
            auditLog.log('pipeline:start', { projectId: 'p1', summary: 'c' });
        });

        test('按 action 过滤', () => {
            const result = auditLog.query({ action: 'project:create' });
            expect(result.length).toBe(1);
            expect(result[0].action).toBe('project:create');
        });

        test('按 projectId 过滤', () => {
            const result = auditLog.query({ projectId: 'p1' });
            expect(result.length).toBe(2);
        });

        test('按 since 过滤', () => {
            const future = new Date(Date.now() + 10000).toISOString();
            const result = auditLog.query({ since: future });
            expect(result.length).toBe(0);
        });

        test('limit 限制', () => {
            const result = auditLog.query({ limit: 1 });
            expect(result.length).toBe(1);
        });
    });

    describe('getStats', () => {
        test('初始状态', () => {
            const stats = auditLog.getStats();
            expect(stats.totalEntries).toBe(0);
            expect(stats.oldestEntry).toBeNull();
            expect(stats.newestEntry).toBeNull();
            expect(stats.actionCounts).toEqual({});
            // Q7: 包含持久化层统计
            expect(stats).toHaveProperty('persistence');
        });

        test('记录后统计正确', () => {
            auditLog.log('project:create');
            auditLog.log('project:create');
            auditLog.log('pipeline:start');
            const stats = auditLog.getStats();
            expect(stats.totalEntries).toBe(3);
            expect(stats.actionCounts['project:create']).toBe(2);
            expect(stats.actionCounts['pipeline:start']).toBe(1);
            expect(stats.newestEntry).toBeTruthy();
            expect(stats.oldestEntry).toBeTruthy();
        });
    });

    describe('clearEntries', () => {
        test('清空内存条目', () => {
            auditLog.log('test');
            expect(auditLog.query().length).toBe(1);
            auditLog.clearEntries();
            expect(auditLog.query().length).toBe(0);
        });
    });
});
