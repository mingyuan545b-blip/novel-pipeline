'use strict';

/**
 * materialLifecyclePolicy.js — 素材生命周期/归档保护策略（唯一阈值来源）
 *
 * 背景（2026-09-18 五章E2E实测）：
 *   章节返修时 cleanChapterMaterials 会"先归档本章来源素材，再重建"，
 *   保护判定原先是 `mat.name.includes('主角')` —— 纯字符串匹配（违反语义优先原则）：
 *   主角名为"茅十七"（不 contain '主角'）→ 被误归档；实测该项目 37 条素材中 19 条
 *   被归档（含全部 4 个角色），素材库对写作端形同虚设。
 */
const MATERIAL_LIFECYCLE_POLICY = Object.freeze({
    /** 角色定位达到这些级别 → 不参与归档（语义判定，不看名字） */
    protectedRoleLevels: Object.freeze(['protagonist', 'key-supporting']),
    /** 最近 N 章出现过（lastAppearChapter）的素材不归档，避免误伤当前剧情线 */
    recencyWindowChapters: 5,
});

module.exports = { MATERIAL_LIFECYCLE_POLICY };
