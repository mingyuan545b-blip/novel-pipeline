'use strict';

/**
 * budgetPolicy.js — 上下文/素材预算策略（唯一阈值来源）
 *
 * 原则6（配置统一）：预算阈值、降级阈值、深度下限集中此处，禁止散落硬编码。
 * 原则1（单一数据源）：token/字符预算的换算规则只有这里一份定义。
 *
 * 语义约定（消除历史混用）：
 *   - charBudget（字符预算）：声明式 totalBudget 的含义，用于 selectItems 裁剪素材文本长度
 *   - tokenCeiling（token上限）：由模型真实上下文 × modelSafeLimitRatio 得出，用于防溢出
 *   - plannedChars：按"深度×条数上限"估算的素材字符占用，用于降级判定
 */

/** 深度（L0-L4）默认条数上限：浅层可多带条目，深层只带少数重点 */
const ITEM_COUNT_BY_DEPTH = Object.freeze({ L0: 8, L1: 5, L2: 3, L3: 2, L4: 1 });

/** 降级动作（按严重度递增）：none → 丢低优先级非必需 → 丢全部非必需 → 压必需类深度 */
const DEGRADATION_ACTIONS = Object.freeze({
    NONE: 'none',
    DROP_OPTIONAL_TAIL: 'drop-optional-tail',
    DROP_ALL_OPTIONAL: 'drop-all-optional',
    REDUCE_REQUIRED_DEPTH: 'reduce-required-depth',
});

const BUDGET_POLICY = Object.freeze({
    /** 模型可用上下文的安全使用比例（其余留给输出/波动/系统提示） */
    modelSafeLimitRatio: 0.6,

    /** 声明未给 totalBudget 时的素材字符预算兜底 */
    defaultCharBudget: 8000,

    /** L4（原始）未声明 maxChars 时的字符占用估算 */
    rawDepthChars: 4000,

    /** 自动决策允许达到的最大深度（用户 override 不受限），防止 prompt 被原始 JSON 灌爆 */
    maxAutoDepth: 'L3',

    /** 降级判定阈值（plannedChars / charBudget），阈值必须递增 */
    degradationThresholds: Object.freeze([
        Object.freeze({ level: 'green',  ratio: 0.75, label: '充裕', action: DEGRADATION_ACTIONS.NONE }),
        Object.freeze({ level: 'yellow', ratio: 0.90, label: '良好', action: DEGRADATION_ACTIONS.DROP_OPTIONAL_TAIL }),
        Object.freeze({ level: 'orange', ratio: 1.00, label: '偏满', action: DEGRADATION_ACTIONS.DROP_ALL_OPTIONAL }),
        Object.freeze({ level: 'red',    ratio: Infinity, label: '超限', action: DEGRADATION_ACTIONS.REDUCE_REQUIRED_DEPTH }),
    ]),

    /** 各必需性下允许降到的最低深度（信息密度下限，防止"名字|定位"空壳） */
    minDepthByRequirement: Object.freeze({ required: 'L2', optional: 'L0' }),

    /** 一致性关键类型：任何 Agent、任何章节都不得丢弃（保逻辑/伏笔不崩） */
    neverDropTypes: Object.freeze(['foreshadowing', 'character', 'worldview']),

    /** 降级时丢弃非必需类型的顺序 */
    dropOptionalByPriorityAsc: true,

    /**
     * 相关性门控（"每章只组合必要提示词"的核心开关）
     * 非必需类型的加载条件：命中任一即加载，否则整类不注入
     *   required / neverDropTypes / 场景命中(sceneBoost>0) / 本章意图命中 / 大纲点名
     */
    relevanceGating: Object.freeze({
        enabled: true,
        /** 不参与相关性门控的类型（由各 Agent 声明自行决定） */
        exemptTypes: Object.freeze(['character', 'relationship', 'worldview', 'foreshadowing']),
    }),
});

module.exports = { BUDGET_POLICY, ITEM_COUNT_BY_DEPTH, DEGRADATION_ACTIONS };
