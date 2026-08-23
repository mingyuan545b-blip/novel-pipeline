/**
 * chapterIntentsSchema - 章节意图Schema单一数据源
 *
 * 标准结构：{ chapters: { "chapter-0001": IntentData, ... } }
 * 历史问题：chapters字段曾为数组类型，导致读取逻辑混乱
 *
 * 关键字段定义基于chapterIntent.js第90-104行的fullIntent结构
 */

// 顶层结构字段
const TOP_LEVEL_FIELDS = {
    CHAPTERS: 'chapters',  // 必须是对象类型，不能是数组
};

// 单个Intent的标准字段（来自chapterIntent.js第90-104行）
const INTENT_FIELDS = {
    CHAPTER: 'chapter',           // 章节号（number）
    GOAL: 'goal',                 // 章节目标（string）
    OUTLINE_NODE: 'outlineNode',  // 大纲节点（string）
    MUST_KEEP: 'mustKeep',        // 必须保留项（string[]）
    MUST_AVOID: 'mustAvoid',      // 必须避免项（string[]）
    STYLE_EMPHASIS: 'styleEmphasis',  // 风格强调（string|null）
    HOOK_ADVANCE: 'hookAdvance',     // 推进钩子（string[]）
    HOOK_RESOLVE: 'hookResolve',     // 解决钩子（string[]）
    CONFLICT_DESIGN: 'conflictDesign',   // 冲突设计（string）
    CHAPTER_END_HOOK: 'chapterEndHook',  // 章末钩子（string）
    READER_CONCERNS: 'readerConcerns',   // 阅读者关注（object|null）
    OUTLINE_ADJUSTMENT: 'outlineAdjustment',  // 大纲调整（object|null）
    HOOK_AGENDA: 'hookAgenda',     // 钩子议程（object）
    GENERATED_AT: 'generatedAt',   // 生成时间（ISO string）
};

// 章节key格式：chapter-XXXX（4位数字补零）
const CHAPTER_KEY_PATTERN = /^chapter-\d{4}$/;

// 默认空结构
const DEFAULT_STRUCTURE = { chapters: {} };

// 必填字段（生成时必须有值）
const REQUIRED_INTENT_FIELDS = [INTENT_FIELDS.CHAPTER, INTENT_FIELDS.GOAL];

module.exports = {
    TOP_LEVEL_FIELDS,
    INTENT_FIELDS,
    CHAPTER_KEY_PATTERN,
    DEFAULT_STRUCTURE,
    REQUIRED_INTENT_FIELDS,
};
