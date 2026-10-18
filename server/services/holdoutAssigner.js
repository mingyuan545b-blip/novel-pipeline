'use strict';

/**
 * holdoutAssigner.js — 留出集（holdout）分配（纯函数，可复现）
 *
 * 目的（D3-a）：为后续 A/B 双盲评估提供**稳定、可复现、无共享状态**的 train/holdout 划分。
 *   同一 (projectId, chapterNumber) 永远分到同一桶；换机器/换进程结果一致。
 * 设计取舍：用确定性字符串哈希（FNV-1a）而非随机数，保证可复现；比例/桶数可配置。
 */

const DEFAULT_BUCKETS = 10;
const DEFAULT_HOLDOUT_RATIO = 0.2;

/** FNV-1a 32-bit 字符串哈希（稳定、无依赖） */
function hashInt(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

/**
 * 该章节落入的桶号（0..buckets-1）。
 * @param {string} projectId
 * @param {number} chapterNumber
 * @param {number} [buckets]
 * @returns {number}
 */
function bucketOf(projectId, chapterNumber, buckets = DEFAULT_BUCKETS) {
    const n = Number(buckets);
    const size = Number.isInteger(n) && n > 0 ? n : DEFAULT_BUCKETS;
    return hashInt(`${projectId || ''}#${Number(chapterNumber) || 0}`) % size;
}

/**
 * 是否为留出集章节。
 * @param {string} projectId
 * @param {number} chapterNumber
 * @param {{ratio?:number, buckets?:number}} [opts]
 * @returns {boolean}
 */
function isHoldout(projectId, chapterNumber, opts = {}) {
    const buckets = Number.isInteger(opts.buckets) && opts.buckets > 0 ? opts.buckets : DEFAULT_BUCKETS;
    const ratio = Number.isFinite(opts.ratio) ? Math.min(1, Math.max(0, opts.ratio)) : DEFAULT_HOLDOUT_RATIO;
    const holdoutBuckets = Math.round(ratio * buckets);
    return bucketOf(projectId, chapterNumber, buckets) < holdoutBuckets;
}

module.exports = { hashInt, bucketOf, isHoldout, DEFAULT_BUCKETS, DEFAULT_HOLDOUT_RATIO };
