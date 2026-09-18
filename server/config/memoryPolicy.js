'use strict';

/**
 * memoryPolicy.js — 记忆注入策略（唯一阈值来源）
 *
 * 决议（2026-09-18，原则1 单一数据源）：
 *   长期记忆的注入源 = memory-pyramid（M0-M3 事实，带衰减）+ 卷摘要（叙事回顾）。
 *   二者是同一"记忆槽"的两种粒度，由 slotResolvers.resolveMemoryPyramid 统一产出；
 *   services/memory 的 L0-L4 层不再另开注入路径（其 core/active/recent 仅作 UI 诊断）。
 *   原因：此前 L0-L4 与 memory-pyramid 双轨并存，L4 卷摘要算完无人用（纯浪费）。
 */
const MEMORY_POLICY = Object.freeze({
    /** 是否把卷摘要（叙事记忆）并入记忆槽 */
    includeVolumeSummary: true,
    /** 卷摘要注入上限（字符），控制 token */
    volumeSummaryMaxChars: 600,
    /** 最多回看几卷（0 = 只当前卷） */
    volumeLookback: 0,
});

module.exports = { MEMORY_POLICY };
