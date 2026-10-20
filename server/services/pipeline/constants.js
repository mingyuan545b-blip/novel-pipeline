const logger = require('../../shared/logger');
const { CHAPTER_STATUS, STUCK_STATUSES, validateStatusConsistency } = require('../chapterStatus');

async function getOutlineApiConfig() {
    try {
        const { resolveStepConfig } = require('../llmConfig');
        const config = await resolveStepConfig('intent-planner');
        if (config) return config;
    } catch(_) { logger.warn('pipelineConst', _.message || _); }  // DEGRADE: 影响=require 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return null;
}

module.exports = {
    CHAPTER_STATUS,
    STUCK_STATUSES,
    validateStatusConsistency,
    getOutlineApiConfig
};
