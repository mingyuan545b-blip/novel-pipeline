'use strict';

/**
 * percentile 工具单元测试（方向 M3）
 *
 * 覆盖：
 * 1. percentile 单值计算（p50/p95/p99）
 * 2. 空数组与单元素边界
 * 3. computePercentiles 批量计算
 * 4. 不同分布的分位数正确性
 *
 * 文件位置：tests/unit/percentile.test.js
 */

const { percentile, computePercentiles } = require('../../server/utils/percentile');

describe('percentile 工具 - M3', () => {
    describe('percentile 单值计算', () => {
        test('空数组应返回 0', () => {
            expect(percentile([], 0.5)).toBe(0);
        });

        test('单元素数组应返回该元素', () => {
            expect(percentile([42], 0.5)).toBe(42);
            expect(percentile([42], 0.95)).toBe(42);
        });

        test('p50 中位数（偶数个元素）', () => {
            // [1,2,3,4,5,6,7,8,9,10] p50 = ceil(0.5*10) = 5 → idx=4 → 第5个=5
            const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            expect(percentile(values, 0.5)).toBe(5);
        });

        test('p50 中位数（奇数个元素）', () => {
            // [1,2,3,4,5] p50 = ceil(0.5*5) = 3 → idx=2 → 第3个=3
            const values = [1, 2, 3, 4, 5];
            expect(percentile(values, 0.5)).toBe(3);
        });

        test('p95 应接近最大值', () => {
            const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
            // p95 = ceil(0.95*10) = 10 → idx=9 → 第10个=1000
            expect(percentile(values, 0.95)).toBe(1000);
        });

        test('p99 应为最大值', () => {
            const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
            // p99 = ceil(0.99*10) = 10 → idx=9 → 第10个=1000
            expect(percentile(values, 0.99)).toBe(1000);
        });

        test('未排序数组应内部排序后计算', () => {
            const unsorted = [10, 1, 5, 3, 8, 2, 7, 4, 9, 6];
            // 排序后 [1,2,3,4,5,6,7,8,9,10]，p50 = 5
            expect(percentile(unsorted, 0.5)).toBe(5);
        });

        test('不应修改原数组', () => {
            const values = [3, 1, 2];
            const original = [...values];
            percentile(values, 0.5);
            expect(values).toEqual(original);
        });
    });

    describe('computePercentiles 批量计算', () => {
        test('应返回 p50/p95/p99 三个字段', () => {
            const result = computePercentiles([1, 2, 3, 4, 5]);
            expect(result).toHaveProperty('p50');
            expect(result).toHaveProperty('p95');
            expect(result).toHaveProperty('p99');
        });

        test('空数组应返回全 0', () => {
            const result = computePercentiles([]);
            expect(result.p50).toBe(0);
            expect(result.p95).toBe(0);
            expect(result.p99).toBe(0);
        });

        test('20 个元素的 p95 应为第 19 个值', () => {
            const values = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
            // [100, 200, ..., 2000] p95 = ceil(0.95*20) = 19 → idx=18 → 第19个=1900
            const result = computePercentiles(values);
            expect(result.p95).toBe(1900);
        });

        test('长尾分布 p99 应远大于 p50', () => {
            // 90 个 100 + 10 个 10000
            const values = [...Array(90).fill(100), ...Array(10).fill(10000)];
            const result = computePercentiles(values);
            expect(result.p50).toBe(100);
            expect(result.p99).toBe(10000);
        });
    });
});
