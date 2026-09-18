'use strict';

/**
 * materialContentPolicy.js — 素材内容合并策略（唯一配置来源）
 *
 * 背景（陷阱清单 P0 / 2026-09-18 实测复现）：
 *   materialActions.handleUpdateAction 用 `currentContent: update.content || existing.currentContent`
 *   整体覆盖 → 章节状态摘要把角色人设字段冲掉（实测主角 1031字 → 307字，
 *   深度补全的成果一章即失效，违反原则1"单一数据源/不得消费端堵漏"）。
 *
 * 对策（陷阱清单给出的方向）：merge 模式——保留原有标签，只更新"状态类"标签，追加新标签。
 */
const MATERIAL_CONTENT_POLICY = Object.freeze({
    /** 走合并模式的内容类型（人设最关键的先覆盖角色） */
    mergeTypes: Object.freeze(['character']),
    /** 状态类标签：允许被新内容覆盖（其余标签保留更丰富的一版，防人设退化） */
    stateSectionLabels: Object.freeze(['当前状态', '最新状态', '本章状态', '基本信息', '当前处境', '状态']),
    /** 标签解析：匹配【标签】形式的分节标记 */
    sectionPattern: '【([^】]{1,20})】',
});

module.exports = { MATERIAL_CONTENT_POLICY };
