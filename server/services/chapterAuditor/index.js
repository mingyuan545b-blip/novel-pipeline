const store = require('../../store');
const { detectGenre } = require('../genreConfig');
const { auditChapter, auditAll, getAudit, getViolationsByType } = require('./auditMethods');
const { reviewChapter } = require('./reviewMethods');
const { repairChapter, rollbackRepair, repairWithRetry } = require('./repairMethods');

class ChapterAuditor {
    constructor(projectId) {
        this.projectId = projectId;
        this._initialized = false;
    }

    async _init() {
        if (this._initialized) return;
        this.project = await store.getItem('projects', this.projectId);
        this.styleProfile = this.project?.styleProfile;
        this.genre = detectGenre(this.styleProfile);
        this.genreLabel = this.genre?.label || '通用';
        this._initialized = true;
    }

    async auditChapter(chapterId) {
        await this._init();
        return auditChapter(this.projectId, this.project, this.styleProfile, this.genre, chapterId);
    }

    async auditAll() {
        return auditAll(this.projectId);
    }

    async getAudit(chapterId) {
        return getAudit(this.projectId, chapterId);
    }

    async getViolationsByType(type) {
        return getViolationsByType(this.projectId, type);
    }

    async repairChapter(chapterId, repairInstructions, llmService, options = {}) {
        await this._init();
        return repairChapter(this.projectId, this.project, this.styleProfile, this.genre, this.genreLabel, chapterId, repairInstructions, llmService, options);
    }

    async reviewChapter(chapterId, llmService, apiConfig) {
        await this._init();
        return reviewChapter(this.projectId, this.project, this.styleProfile, this.genre, this.genreLabel, chapterId, llmService, apiConfig);
    }

    async rollbackRepair(snapshotId) {
        return rollbackRepair(this.projectId, snapshotId);
    }

    async repairWithRetry(chapterId, repairInstructions, llmService, pipelineService, options = {}) {
        await this._init();
        return repairWithRetry(this.projectId, this.project, this.styleProfile, this.genre, this.genreLabel, chapterId, repairInstructions, llmService, pipelineService, options);
    }
}

module.exports = { ChapterAuditor };
