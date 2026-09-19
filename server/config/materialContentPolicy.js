'use strict';

/**
 * materialContentPolicy.js — 素材内容合并与"防膨胀"策略（唯一配置来源）
 *
 * 背景：
 *   - 陷阱清单 P0：handleUpdateAction 整体覆盖 currentContent → 章节状态冲掉人设
 *   - 2026-09-18：改为合并后必须防止"设定无限追加"（长篇跑 1000+ 章会膨胀到不可用）
 *
 * 分层策略（三类标签区别对待）：
 *   1. 人设类（persona）  —— 永不删除，允许缓慢增长，但受单字段上限约束
 *   2. 状态类（state）    —— 轮转覆盖（只留最新），不累积
 *   3. 事件类（event，标签含"第N章"/"本章"）—— 滚动窗口，只保留最近 N 条
 * 最后再叠加"单素材总字数上限"，超限按 [事件 → 状态历史 → 人设] 顺序裁剪。
 */
const MATERIAL_CONTENT_POLICY = Object.freeze({
    /** 走合并模式的内容类型（人设最关键） */
    mergeTypes: Object.freeze(['character']),

    /** 状态类标签：允许被新内容覆盖（不累积） */
    stateSectionLabels: Object.freeze([
        '当前状态', '最新状态', '本章状态', '基本信息', '当前处境', '状态', '当前目标', '身体状态',
    ]),

    /** 人设类标签：永不被裁剪删除（只可能在最后按上限截断单字段） */
    personaSectionLabels: Object.freeze([
        '身份', '身份/职位', '性格', '核心欲望', '内在矛盾', '成长弧光', '标志性细节', '标志性动作',
        '说话语气', '说话风格', '说话风味', '行为模式', '人格魅力', '哲学观', '金句库', '出场设计',
        '外貌', '能力', '弱点', '动机', '习惯', '性格/行为', '关联伏笔',
    ]),

    /** 分节标签解析模式（【标签】形式） */
    sectionPattern: '【([^】]{1,20})】',

    /** 事件类标签识别（标签含"第N章"视为事件类，走滚动窗口） */
    eventSectionPattern: '第(\\d+)章',
    /** 事件类保留最近条数 */
    eventSectionWindow: 5,

    /** 单素材总字数上限（超出按优先级裁剪） */
    maxCharsByType: Object.freeze({
        character: 4000, worldview: 6000, 'power-system': 5000, institution: 3000,
        equipment: 2500, foreshadowing: 2000, default: 2500,
    }),
    /** 裁剪时单个人设字段的保底上限（避免某个字段吃掉全部预算） */
    personaFieldMaxChars: 800,

    /** 章节更新后的深度巡检：低于"要求字数 × 该比例"才触发 LLM 补全（控制 token） */
    driftRepairTriggerRatio: 0.7,
    /** 章节更新后的深度巡检开关（接入 material-manager 之后的收尾） */
    driftCheckEnabled: true,
});

module.exports = { MATERIAL_CONTENT_POLICY };
