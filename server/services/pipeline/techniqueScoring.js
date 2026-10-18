'use strict';

/**
 * techniqueScoring.js — 技法注入「基础分」归一化（纯函数模块）
 *
 * 背景（源头打分缺陷，2026-10-19 侦察）：
 *   技法库 success_rate 的规范单位是 **0–100 百分数**（见 libraryStore.DEFAULT_SUCCESS_RATE = 50，
 *   实测取值集合 {50,17,10,13}），但 techniqueScheduler 直接用
 *   `let score = tech.success_rate || 0.5` 当作 0–1 使用 —— 基础分恒为 50 左右，
 *   彻底压过场景/阶段/大纲/认知/题材/反馈等全部加减小项（量级 ±0.1~0.6），
 *   导致「自适应调度」形同虚设（选择结果只剩"按库内静态成功率排序"）。
 *
 * 修法（源头治理 · 模块化 · 不硬编码）：把「单位换算 + 中性先验 + 基础权重」收敛到本纯函数模块，
 *   调度器只调用 baseScore()，不再让隐含单位假设散落在打分链里；各 boost 保持各自语义。
 */

/** 未记录/非法成功率时的中性先验（0–1） */
const DEFAULT_SUCCESS_RATE = 0.5;
/** 库内成功率的单位刻度（百分数） */
const SCALE = 100;
/** 基础分权重：与各 boost 同量级（0.1~0.6），确保自适应加分能真正影响排序 */
const BASE_WEIGHT = 1;

/**
 * 把库内 success_rate（0–100）归一化到 0–1。
 * @param {*} raw
 * @returns {number} 0–1；非有限值或 ≤0 时返回中性先验
 */
function normalizeSuccessRate(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_SUCCESS_RATE;
    return Math.min(1, n / SCALE);
}

/**
 * 技法基础分（注入排序的起点，叠加各类 boost 之前）。
 * @param {{success_rate?: number}} tech
 * @returns {number}
 */
function baseScore(tech) {
    return normalizeSuccessRate(tech && tech.success_rate) * BASE_WEIGHT;
}

module.exports = { DEFAULT_SUCCESS_RATE, SCALE, BASE_WEIGHT, normalizeSuccessRate, baseScore };
