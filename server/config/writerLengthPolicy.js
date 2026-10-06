'use strict';

/**
 * writerLengthPolicy.js — 执笔字数结构策略（唯一阈值来源）
 *
 * 背景（2026-09-18 五章E2E实测）：
 *   writer prompt 原先硬编码场景下限 400/600/500/400（合计1950字），
 *   而硬性最低 rejectMin=2500、目标 2500-3000 —— 提示词内部自相矛盾：
 *   模型锚定具体数字（1950），成稿稳定落在 1900~2479 字，永远差一点被退回。
 *
 * 对策：场景下限由 wordConfig.targetMin 按比例派生，合计 ≥ targetMin，
 *      并给出"成稿前自检总字数"的显式要求。禁止再硬编码场景字数。
 */
const SCENE_FLOOR_RATIOS = Object.freeze([0.22, 0.30, 0.26, 0.22]);
const SCENE_LABELS = Object.freeze(['场景1(铺垫)', '场景2(核心)', '场景3(推进)', '场景4(钩子)']);

/** 下限取整粒度（便于模型记忆与对齐） */
const FLOOR_ROUNDING = 50;

/**
 * 可救区（salvage band）策略（S7/P1-F）：
 * 项目 wordConfig 常见 rejectMin == targetMin → 可救区宽度为 0，
 * 低于目标的章节只能整章重生成，而重生成有"长度先验"（flash 实测 3 轮字数不变）。
 * 这里保证 rejectMin 至少比 targetMin 低 SALVAGE_BAND_RATIO，让
 * [rejectMin, targetMin) 的成稿走"结构化疗写"而非作废重写。
 */
const SALVAGE_BAND_RATIO = 0.1;
const SALVAGE_BAND_MIN = 50;

/** 收紧 rejectMin 至 targetMin 之下（只在过窄时下压，不抬高已有配置） */
function ensureSalvageBand(targetMin, rejectMin) {
    if (!Number.isFinite(targetMin) || targetMin <= 0) return rejectMin;
    if (!Number.isFinite(rejectMin) || rejectMin <= 0) return rejectMin;
    const band = Math.max(SALVAGE_BAND_MIN, Math.round(targetMin * SALVAGE_BAND_RATIO));
    return Math.min(rejectMin, targetMin - band);
}

module.exports = { SCENE_FLOOR_RATIOS, SCENE_LABELS, FLOOR_ROUNDING, SALVAGE_BAND_RATIO, SALVAGE_BAND_MIN, ensureSalvageBand };
