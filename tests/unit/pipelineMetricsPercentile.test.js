'use strict';

/**
 * pipelineMetrics 分位数测试（方向 M3）
 *
 * 覆盖：
 * 1. getAllMetrics 返回 p50/p95/p99 字段
 * 2. getSlowestSteps 按 p95 降序排列
 * 3. 分位数正确性
 *
 * 文件位置：tests/unit/pipelineMetricsPercentile.test.js
 */

const {
    recordStepStart,
    recordStepEnd,
    getStepMetrics,
    getAllMetrics,
    getSlowestSteps,
    resetMetrics
} = require('../../server/services/pipelineMetrics');

describe('pipelineMetrics - M3 分位数', () => {
    beforeEach(() => {
        resetMetrics();
    });

    describe('getAllMetrics 分位数字段', () => {
        test('应返回 p50Ms/p95Ms/p99Ms 字段', () => {
            const token = recordStepStart('writer', 'proj-1');
            recordStepEnd(token, true);

            const all = getAllMetrics();
            expect(all.writer).toHaveProperty('p50Ms');
            expect(all.writer).toHaveProperty('p95Ms');
            expect(all.writer).toHaveProperty('p99Ms');
        });

        test('单次执行 p50/p95/p99 应相等', () => {
            const token = recordStepStart('writer', 'proj-1');
            recordStepEnd(token, true);

            const metrics = getAllMetrics().writer;
            expect(metrics.p50Ms).toBe(metrics.p95Ms);
            expect(metrics.p95Ms).toBe(metrics.p99Ms);
        });

        test('10 次执行 p95 应为第 10 个值', () => {
            // 通过 mock startTime 控制耗时
            for (let i = 1; i <= 10; i++) {
                const token = recordStepStart('writer', 'proj-1');
                // 回溯 startTime 让耗时为 i*100
                token.startTime = Date.now() - (i * 100);
                recordStepEnd(token, true);
            }

            const metrics = getAllMetrics().writer;
            // 排序后 [100,200,...,1000]，p95 = ceil(0.95*10) = 10 → idx=9 → 1000
            expect(metrics.p95Ms).toBe(1000);
        });

        test('长尾分布 p99 应远大于 p50', () => {
            // 9 个 100ms + 1 个 10000ms
            for (let i = 0; i < 9; i++) {
                const token = recordStepStart('writer', 'proj-1');
                token.startTime = Date.now() - 100;
                recordStepEnd(token, true);
            }
            const token = recordStepStart('writer', 'proj-1');
            token.startTime = Date.now() - 10000;
            recordStepEnd(token, true);

            const metrics = getAllMetrics().writer;
            expect(metrics.p50Ms).toBe(100);
            expect(metrics.p99Ms).toBe(10000);
        });
    });

    describe('getSlowestSteps 最慢步骤排行', () => {
        test('应按 p95Ms 降序排列', () => {
            // writer: 5 次 5000ms
            for (let i = 0; i < 5; i++) {
                const token = recordStepStart('writer', 'proj-1');
                token.startTime = Date.now() - 5000;
                recordStepEnd(token, true);
            }
            // reviewer: 5 次 1000ms
            for (let i = 0; i < 5; i++) {
                const token = recordStepStart('reviewer', 'proj-1');
                token.startTime = Date.now() - 1000;
                recordStepEnd(token, true);
            }

            const slow = getSlowestSteps(10);
            expect(slow).toHaveLength(2);
            expect(slow[0].stepName).toBe('writer');
            expect(slow[0].p95Ms).toBe(5000);
            expect(slow[1].stepName).toBe('reviewer');
            expect(slow[1].p95Ms).toBe(1000);
        });

        test('应限制返回数量', () => {
            for (let i = 0; i < 5; i++) {
                const token = recordStepStart(`step${i}`, 'proj-1');
                token.startTime = Date.now() - (i + 1) * 1000;
                recordStepEnd(token, true);
            }

            const slow = getSlowestSteps(3);
            expect(slow).toHaveLength(3);
        });

        test('无数据时应返回空数组', () => {
            expect(getSlowestSteps(5)).toEqual([]);
        });

        test('应包含 avgMs 与 count 字段', () => {
            const token = recordStepStart('writer', 'proj-1');
            token.startTime = Date.now() - 1000;
            recordStepEnd(token, true);

            const slow = getSlowestSteps(5);
            expect(slow[0]).toHaveProperty('avgMs');
            expect(slow[0]).toHaveProperty('count');
            expect(slow[0].count).toBe(1);
        });

        test('G1: 应包含 p50Ms/p95Ms/p99Ms 字段', () => {
            const token = recordStepStart('writer', 'proj-1');
            token.startTime = Date.now() - 1000;
            recordStepEnd(token, true);

            const slow = getSlowestSteps(5);
            expect(slow[0]).toHaveProperty('p50Ms');
            expect(slow[0]).toHaveProperty('p95Ms');
            expect(slow[0]).toHaveProperty('p99Ms');
        });
    });

    describe('getStepMetrics 单步查询含分位数', () => {
        test('应返回分位数字段', () => {
            const token = recordStepStart('writer', 'proj-1');
            recordStepEnd(token, true);

            const metrics = getStepMetrics('writer');
            expect(metrics).toHaveProperty('p50Ms');
            expect(metrics).toHaveProperty('p95Ms');
            expect(metrics).toHaveProperty('p99Ms');
        });

        test('不存在的步骤应返回 null', () => {
            expect(getStepMetrics('nonexistent')).toBeNull();
        });
    });
});
