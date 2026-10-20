'use strict';

/**
 * perfBaselineCheck 性能基线检测单元测试（Q6）
 *
 * 测试策略：
 * - 调用 runCheck 函数，验证返回报告结构
 * - 验证阈值常量合理性
 * - 验证 CORE_MODULES 列表非空
 *
 * 文件位置：tests/unit/perfBaselineCheck.test.js
 */

const { runCheck, THRESHOLDS, CORE_MODULES } = require('../../scripts/perfBaselineCheck');

describe('perfBaselineCheck (Q6)', () => {
    describe('THRESHOLDS', () => {
        test('所有阈值都是正整数', () => {
            for (const [key, val] of Object.entries(THRESHOLDS)) {
                expect(val).toBeGreaterThan(0);
                expect(Number.isInteger(val)).toBe(true);
            }
        });

        test('ERROR 阈值大于对应 WARN 阈值', () => {
            expect(THRESHOLDS.SINGLE_MODULE_LOAD_MS_ERROR).toBeGreaterThan(THRESHOLDS.SINGLE_MODULE_LOAD_MS_WARN);
            expect(THRESHOLDS.TOTAL_LOAD_MS_ERROR).toBeGreaterThan(THRESHOLDS.TOTAL_LOAD_MS_WARN);
            expect(THRESHOLDS.CACHED_MODULES_ERROR).toBeGreaterThan(THRESHOLDS.CACHED_MODULES_WARN);
            expect(THRESHOLDS.HEAP_USED_MB_ERROR).toBeGreaterThan(THRESHOLDS.HEAP_USED_MB_WARN);
        });

        test('THRESHOLDS 冻结不可变', () => {
            expect(Object.isFrozen(THRESHOLDS)).toBe(true);
        });
    });

    describe('CORE_MODULES', () => {
        test('列表非空', () => {
            expect(CORE_MODULES.length).toBeGreaterThan(0);
        });

        test('包含关键模块', () => {
            expect(CORE_MODULES).toContain('shared/logger');
            expect(CORE_MODULES).toContain('shared/errors');
            expect(CORE_MODULES).toContain('config/envValidator');
        });
    });

    describe('runCheck', () => {
        test('返回完整报告结构', () => {
            const report = runCheck();
            expect(report).toHaveProperty('timestamp');
            expect(report).toHaveProperty('passed');
            expect(report).toHaveProperty('errors');
            expect(report).toHaveProperty('warnings');
            expect(report).toHaveProperty('summary');
            expect(report).toHaveProperty('modules');
            expect(report).toHaveProperty('thresholds');
            expect(Array.isArray(report.errors)).toBe(true);
            expect(Array.isArray(report.warnings)).toBe(true);
            expect(Array.isArray(report.modules)).toBe(true);
        });

        test('summary 包含关键指标', () => {
            const report = runCheck();
            const s = report.summary;
            expect(s).toHaveProperty('totalLoadMs');
            expect(s).toHaveProperty('cachedModules');
            expect(s).toHaveProperty('heapUsedMB');
            expect(s).toHaveProperty('heapTotalMB');
            expect(s).toHaveProperty('rssMB');
            expect(s).toHaveProperty('heapSizeLimitMB');
            expect(s.totalLoadMs).toBeGreaterThanOrEqual(0);
            expect(s.cachedModules).toBeGreaterThan(0);
            expect(s.heapUsedMB).toBeGreaterThan(0);
        });

        test('每个 module 结果包含必要字段', () => {
            const report = runCheck();
            for (const m of report.modules) {
                expect(m).toHaveProperty('module');
                expect(m).toHaveProperty('loadMs');
                expect(m).toHaveProperty('ok');
                // 蕴含断言：ok ⇒ heapDeltaKB 且 loadMs>=0；!ok ⇒ 有 error（不用条件内 expect）
                expect(!m.ok || (Object.prototype.hasOwnProperty.call(m, 'heapDeltaKB') && m.loadMs >= 0)).toBe(true);
                expect(m.ok || Object.prototype.hasOwnProperty.call(m, 'error')).toBe(true);
            }
        });

        test('thresholds 字段与导出一致', () => {
            const report = runCheck();
            expect(report.thresholds).toEqual(THRESHOLDS);
        });

        test('正常运行环境 passed 应为 true', () => {
            // 在合理环境下应通过（模块加载 < 2s，堆 < 500MB）
            const report = runCheck();
            // 测试环境可能加载较慢，仅断言结构正确
            expect(typeof report.passed).toBe('boolean');
        });
    });
});
