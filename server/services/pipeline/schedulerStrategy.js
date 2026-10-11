const logger = require('../../shared/logger');

const SCHEDULER_STRATEGIES = new Map();

const DEFAULT_STRATEGY = {
    id: 'default',
    label: '默认策略',
    description: '按声明优先级+预算限制加载素材',
    select: function (items, need, budget) {
        const selected = [];
        let usedBudget = 0;
        for (const item of items) {
            if (usedBudget + (item.content?.length || 0) > budget) break;
            selected.push(item);
            usedBudget += item.content?.length || 0;
        }
        // 【根因修复 2026-10-11】预算 < 单条素材时，旧逻辑第一条就 break → 静默返回空数组，
        // 于是声明为 required 的素材类型变成 EMPTY（实测 ch5/ch6 的 second-review/polisher 角色卡=0，
        // Agent 拿不到任何角色上下文）。改为"至少给一条"（超出则按预算截断），避免空转。
        if (selected.length === 0 && items.length > 0) {
            const first = items[0];
            const len = first.content?.length || 0;
            if (budget > 0 && len > budget) selected.push({ ...first, content: String(first.content).slice(0, budget) });
            else selected.push(first);
        }
        return selected;
    }
};

SCHEDULER_STRATEGIES.set('default', DEFAULT_STRATEGY);

function registerStrategy(strategy) {
    if (!strategy?.id) throw new Error('Strategy must have an id');
    if (typeof strategy.select !== 'function') throw new Error('Strategy must have a select function');
    SCHEDULER_STRATEGIES.set(strategy.id, strategy);
    logger.info('schedulerStrategy', `Registered strategy: ${strategy.id}`);
}

function getStrategy(strategyId) {
    return SCHEDULER_STRATEGIES.get(strategyId || 'default') || DEFAULT_STRATEGY;
}

function getAllStrategies() {
    return Array.from(SCHEDULER_STRATEGIES.values());
}

function selectItems(items, need, budget, strategyId) {
    const strategy = getStrategy(strategyId);
    return strategy.select(items, need, budget);
}

module.exports = { registerStrategy, getStrategy, getAllStrategies, selectItems, DEFAULT_STRATEGY };
