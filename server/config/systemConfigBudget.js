/**
 * systemConfigBudget — 项目级 token / 费用预算熔断配置
 *
 * 背景：2026-09-30 外部评审指出单个四五百万字项目约 1.7 亿 tokens，
 *   而系统此前只有"按步裁剪上下文"的软策略（budgetPolicy.js），
 *   没有"这个项目已经花了多少、超过阈值就停"的总闸。
 *   缺少总闸的后果：一次失控的重试风暴可以无声烧掉整个月的额度。
 *
 * 与 budgetPolicy.js 的分工（勿混）：
 *   budgetPolicy.js —  上下文预算：单次调用的提示词怎么分、超了怎么降级（微观）
 *   systemConfigBudget — 项目预算：累计消耗到多少就熔断（宏观）
 *
 * 文件位置：server/config/systemConfigBudget.js
 */

const PROJECT_BUDGET = {
    // 总开关。关闭后所有项目都不做预算检查与记账
    ENABLED: true,

    // 超限时是否硬停（抛 BudgetExceededError 中断当前调用）。
    // false = 只告警不拦截，用于观察期
    HARD_STOP: true,

    // 累计消耗达到该比例开始告警（不拦截）
    WARN_RATIO: 0.8,

    // 项目未显式配置时的默认上限。0 = 不限制
    DEFAULT_TOKEN_LIMIT: 0,
    DEFAULT_COST_LIMIT_CNY: 0,

    // 模型名未命中单价表时的兜底单价（元/百万 token），取值偏保守（宁可高估）
    DEFAULT_PRICE_PER_MTOK_CNY: 2,

    // 模型名（小写子串匹配）→ 单价（元/百万 token）。
    // 这是估算值，非计费依据；实际价格以供应商账单为准，可在此按需修正
    MODEL_PRICES_PER_MTOK_CNY: {
        'qwen3.8': 2,
        'qwen3.6': 2,
        'qwen3.5': 2,
        'qwen3-235b': 2,
        'qwen3-32b': 2,
        'qwen-turbo': 0.3,
        'deepseek': 1,
        'glm-4': 1,
        'moonshot': 12,
        'gpt-4o': 20,
    },
};

module.exports = { PROJECT_BUDGET };
