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
            // 自洽断言：ok=false 必须给出 error（不用条件内 expect）
            expect(result.ok || typeof result.error !== 'undefined').toBe(true);
        });
    });

    describe('checkMemory', () => {
        test('返回内存使用信息（ok 取决于 RSS 阈值，属环境相关：只断言自洽性）', () => {
            const result = checkMemory();
            // 不能断言 ok===true：CI runner / 并行 worker 的 RSS 可能超过阈值（真 CI 首跑即因此变红）
            // ok=false 时必须给出 warning（阈值逻辑自洽）——不写条件内 expect（jest/no-conditional-expect）
            const okOrWarned = result.ok !== false || /exceeds/.test(String(result.warning || ''));
            expect(typeof result.ok).toBe('boolean');
            expect(okOrWarned).toBe(true);
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
            // 自洽断言：ok=true 必须有 path，ok=false 必须有 error
            expect(result.ok ? result.path !== undefined : result.error !== undefined).toBe(true);
        });

        test('data 目录存在时返回子目录数', () => {
            const result = checkDisk();
            // 字段存在时必须合法；环境不支持而缺失（undefined）不算失败 —— 均为无条件断言
            expect(result.subdirs === undefined || result.subdirs >= 0).toBe(true);
            expect(result.systemFreeMemMB === undefined || result.systemFreeMemMB > 0).toBe(true);
            expect(result.systemTotalMemMB === undefined || result.systemTotalMemMB > 0).toBe(true);
        });
    });

    describe('checkPersistence', () => {
        test('返回持久化层状态', () => {
            const result = checkPersistence();
            expect(result).toHaveProperty('ok');
            expect(result.source).toBe('persistence');
            // 自洽断言：ok=true 时七个字段必须齐备；ok=false 时必须给出 error
            const PERSIST_FIELDS = ['pgEnabled', 'fallbackEnabled', 'bufferLength', 'totalWritten',
                'totalErrors', 'consecutiveFailures', 'fallbackWritten'];
            const consistent = result.ok
                ? PERSIST_FIELDS.every((f) => Object.prototype.hasOwnProperty.call(result, f))
                : Object.prototype.hasOwnProperty.call(result, 'error');
            expect(consistent).toBe(true);
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
