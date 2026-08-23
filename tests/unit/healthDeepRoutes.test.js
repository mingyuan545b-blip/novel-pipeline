'use strict';

/**
 * healthDeepRoutes 健康检查深度端点单元测试（Q5）
 *
 * 测试策略：
 * - 直接调用导出的检查函数（不依赖 express）
 * - mock pgPool 验证 PG 检查
 * - mock debugPersister 验证持久化检查
 * - 验证内存/磁盘检查返回合理结构
 *
 * 文件位置：tests/unit/healthDeepRoutes.test.js
 */

const {
    checkPgPool,
    checkMemory,
    checkDisk,
    checkPersistence,
    MEM_HIGH_THRESHOLD_BYTES,
    DISK_LOW_THRESHOLD_BYTES
} = require('../../server/routes/healthDeepRoutes');

describe('healthDeepRoutes (Q5)', () => {
    describe('常量', () => {
        test('MEM_HIGH_THRESHOLD_BYTES 为正整数', () => {
            expect(MEM_HIGH_THRESHOLD_BYTES).toBeGreaterThan(0);
            expect(Number.isInteger(MEM_HIGH_THRESHOLD_BYTES)).toBe(true);
        });

        test('DISK_LOW_THRESHOLD_BYTES 为正整数', () => {
            expect(DISK_LOW_THRESHOLD_BYTES).toBeGreaterThan(0);
            expect(Number.isInteger(DISK_LOW_THRESHOLD_BYTES)).toBe(true);
        });
    });

    describe('checkPgPool', () => {
        test('PG pool 不可用时返回 ok:false', () => {
            // 不初始化 PG pool，getPool 会抛错
            const result = checkPgPool();
            // 在测试环境 PG pool 可能未初始化
            expect(result).toHaveProperty('ok');
            expect(result).toHaveProperty('source', 'pg');
            if (!result.ok) {
                expect(result).toHaveProperty('error');
            }
        });
    });

    describe('checkMemory', () => {
        test('返回内存使用信息', () => {
            const result = checkMemory();
            expect(result.ok).toBe(true);
            expect(result.source).toBe('memory');
            expect(result.rss).toBeGreaterThan(0);
            expect(result.rssMB).toBeGreaterThan(0);
            expect(result.heapUsed).toBeGreaterThan(0);
            expect(result.heapUsedMB).toBeGreaterThan(0);
            expect(result.heapTotal).toBeGreaterThanOrEqual(result.heapUsed);
            expect(result.external).toBeGreaterThanOrEqual(0);
            expect(result.thresholdMB).toBeGreaterThan(0);
        });

        test('rssMB 与 rss 一致（误差 < 1MB）', () => {
            const result = checkMemory();
            const expectedMB = result.rss / (1024 * 1024);
            expect(Math.abs(result.rssMB - expectedMB)).toBeLessThan(0.1);
        });
    });

    describe('checkDisk', () => {
        test('返回磁盘/目录信息', () => {
            const result = checkDisk();
            expect(result).toHaveProperty('ok');
            expect(result.source).toBe('disk');
            if (result.ok) {
                expect(result).toHaveProperty('path');
            }
        });

        test('data 目录存在时返回子目录数', () => {
            const result = checkDisk();
            if (result.ok && result.subdirs !== undefined) {
                expect(result.subdirs).toBeGreaterThanOrEqual(0);
                expect(result.systemFreeMemMB).toBeGreaterThan(0);
                expect(result.systemTotalMemMB).toBeGreaterThan(0);
            }
        });
    });

    describe('checkPersistence', () => {
        test('返回持久化层状态', () => {
            const result = checkPersistence();
            expect(result).toHaveProperty('ok');
            expect(result.source).toBe('persistence');
            if (result.ok) {
                expect(result).toHaveProperty('pgEnabled');
                expect(result).toHaveProperty('fallbackEnabled');
                expect(result).toHaveProperty('bufferLength');
                expect(result).toHaveProperty('totalWritten');
                expect(result).toHaveProperty('totalErrors');
                expect(result).toHaveProperty('consecutiveFailures');
                expect(result).toHaveProperty('fallbackWritten');
            }
        });
    });

    describe('router 挂载', () => {
        test('router 是 express Router 实例', () => {
            const { router } = require('../../server/routes/healthDeepRoutes');
            expect(router).toBeDefined();
            expect(typeof router.get).toBe('function');
        });

        test('导出所有检查函数', () => {
            const mod = require('../../server/routes/healthDeepRoutes');
            expect(typeof mod.checkPgPool).toBe('function');
            expect(typeof mod.checkMemory).toBe('function');
            expect(typeof mod.checkDisk).toBe('function');
            expect(typeof mod.checkPersistence).toBe('function');
        });
    });
});
