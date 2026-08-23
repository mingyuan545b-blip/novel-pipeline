const { CONTEXT_BUDGETS: MODEL_BUDGETS } = require('../contextBudget');
const { CACHE_CONFIG } = require('../../config/systemConfig');

const MEMORY_LAYERS = {
    L0: 'core',
    L1: 'active',
    L2: 'recent',
    L3: 'archive',
    L4: 'compressed'
};

const CONTEXT_BUDGETS = MODEL_BUDGETS;

const LAYER_PRIORITIES = {
    L0: 100,
    L1: 80,
    L2: 60,
    L3: 40,
    L4: 20
};

const LAYER_DECAY_RATES = {
    L0: 0,
    L1: 0.02,
    L2: 0.05,
    L3: 0.10,
    L4: 0.15
};

const RECENCY_FLOOR = 10;
const RECENCY_TOUCH_BOOST = 100;
const COMPRESSION_THRESHOLD = 0.3;

module.exports = {
    MEMORY_LAYERS,
    CONTEXT_BUDGETS,
    LAYER_PRIORITIES,
    LAYER_DECAY_RATES,
    RECENCY_FLOOR,
    RECENCY_TOUCH_BOOST,
    COMPRESSION_THRESHOLD,
    CACHE_TTL: CACHE_CONFIG.CACHE_TTL,
    CACHE_MAX: CACHE_CONFIG.CACHE_MAX
};
