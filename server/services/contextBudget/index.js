const constants = require('./contextBudgetConstants');
const { ContextBudget, calculateMaxBatchChapters } = require('./contextBudgetManager');

module.exports = {
    ContextBudget, calculateMaxBatchChapters,
    estimateTokens: constants.estimateTokens,
    truncateToTokens: constants.truncateToTokens,
    CONTEXT_BUDGETS: constants.CONTEXT_BUDGETS,
    COMPACT_PRIORITIES: constants.COMPACT_PRIORITIES,
    LONG_PRIORITIES: constants.LONG_PRIORITIES,
    ULTRA_LONG_PRIORITIES: constants.ULTRA_LONG_PRIORITIES,
    COMPACT_MODELS: constants.COMPACT_MODELS,
    LONG_CONTEXT_MODELS: constants.LONG_CONTEXT_MODELS,
    ULTRA_LONG_CONTEXT_MODELS: constants.ULTRA_LONG_CONTEXT_MODELS,
    SAFETY_MARGIN: constants.SAFETY_MARGIN,
    MODEL_RATIOS: constants.MODEL_RATIOS,
    DEFAULT_RATIOS: constants.DEFAULT_RATIOS,
    resolveModelBudget: constants.resolveModelBudget,
    resolveModelCategory: constants.resolveModelCategory
};
