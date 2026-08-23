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
