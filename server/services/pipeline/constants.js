const logger = require('../../shared/logger');
const { CHAPTER_STATUS, STUCK_STATUSES, validateStatusConsistency } = require('../chapterStatus');

async function getOutlineApiConfig() {
    try {
        const { resolveStepConfig } = require('../llmConfig');
        const config = await resolveStepConfig('intent-planner');
        if (config) return config;
    } catch(_) { logger.warn('pipelineConst', _.message || _); }
    return null;
}

module.exports = {
    CHAPTER_STATUS,
    STUCK_STATUSES,
    validateStatusConsistency,
    getOutlineApiConfig
};
