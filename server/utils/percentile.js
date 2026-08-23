'use strict';

/**
 * 分位数计算工具（M3）
 *
 * 提供通用的 p50/p95/p99 分位数计算，供 pipelineMetrics/httpMetrics/llmMetrics 共用。
 *
 * 算法：nearest-rank method（最近秩法）
 * - 排序后取第 ceil(n * p) 个元素（1-based），转换为 0-based 索引
 * - 样本数不足时降级返回可用分位数
 *
 * 文件位置：server/utils/percentile.js
 */

/**
 * 计算分位数
 * @param {number[]} values - 数值数组（无需预排序）
 * @param {number} p - 百分位（0-1，如 0.5 表示 p50）
 * @returns {number} 分位数值，空数组返回 0
 */
function percentile(values, p) {
    if (!Array.isArray(values) || values.length === 0) return 0;
    if (values.length === 1) return values[0];

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    // nearest-rank: rank = ceil(p * n)，转换为 0-based 索引 = rank - 1
    const rank = Math.ceil(p * n);
    const idx = Math.min(Math.max(rank - 1, 0), n - 1);
    return sorted[idx];
}

/**
 * 批量计算常用分位数
 * @param {number[]} values - 数值数组
 * @returns {{p50: number, p95: number, p99: number}} 分位数对象
 */
function computePercentiles(values) {
    return {
        p50: percentile(values, 0.5),
        p95: percentile(values, 0.95),
        p99: percentile(values, 0.99)
    };
}

module.exports = { percentile, computePercentiles };
