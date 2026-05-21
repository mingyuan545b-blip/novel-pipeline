const { CHAPTER_STATUS, STUCK_STATUSES, validateStatusConsistency } = require('../chapterStatus');

function getOutlineApiConfig() {
    try {
        const { resolveStepConfig } = require('../llmConfig');
        const config = resolveStepConfig('intent-planner');
        if (config) return config;
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    return null;
}

module.exports = {
    CHAPTER_STATUS,
    STUCK_STATUSES,
    validateStatusConsistency,
    getOutlineApiConfig
};
