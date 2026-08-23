const store = require('../store');
const logger = require('../shared/logger');
const { METRICS_CONFIG } = require('./pipelineConfig');
const { getDataContext } = require('./dataContext');

const METRICS_KEY = '_pipeline_metrics';

class MetricsCollector {
    constructor(projectId) {
        this.projectId = projectId;
    }

    async _getMetrics() {
        const _mcCtx = await getDataContext(this.projectId);
        const project = await _mcCtx.getProject();
        if (!project) return null;
        if (!project[METRICS_KEY]) {
            project[METRICS_KEY] = {
                agentTimings: {}, reviewPassRates: {}, tokenUsage: {},
                chapterDurations: [], errorCounts: {}, agentPassRates: {},
                reviserLoops: [], hookResolutionLog: [], materialAddedLog: [], branchingLog: []
            };
        }
        if (!project[METRICS_KEY].agentPassRates) project[METRICS_KEY].agentPassRates = {};
        if (!project[METRICS_KEY].reviserLoops) project[METRICS_KEY].reviserLoops = [];
        if (!project[METRICS_KEY].hookResolutionLog) project[METRICS_KEY].hookResolutionLog = [];
        if (!project[METRICS_KEY].materialAddedLog) project[METRICS_KEY].materialAddedLog = [];
        if (!project[METRICS_KEY].branchingLog) project[METRICS_KEY].branchingLog = [];
        return project[METRICS_KEY];
    }

    async _save(metrics) {
        const _mcsCtx = await getDataContext(this.projectId);
        const project = await _mcsCtx.getProject();
        if (!project) return;
        project[METRICS_KEY] = metrics;
        await store.setItem('projects', this.projectId, project);
    }

    async recordAgentTiming(agentType, durationMs, tokenCount) {
        const metrics = await this._getMetrics();
        if (!metrics) return;
        if (!metrics.agentTimings[agentType]) {
            metrics.agentTimings[agentType] = { calls: 0, totalMs: 0, avgMs: 0, maxMs: 0, totalTokens: 0 };
        }
        const t = metrics.agentTimings[agentType];
        t.calls++; t.totalMs += durationMs; t.avgMs = Math.round(t.totalMs / t.calls);
        t.maxMs = Math.max(t.maxMs, durationMs); t.totalTokens += tokenCount || 0;
        await this._save(metrics);
    }

    async recordReviewResult(step, passed) {
        const metrics = await this._getMetrics();
        if (!metrics) return;
        if (!metrics.reviewPassRates[step]) metrics.reviewPassRates[step] = { total: 0, passed: 0 };
        metrics.reviewPassRates[step].total++;
        if (passed) metrics.reviewPassRates[step].passed++;
        await this._save(metrics);
    }

    async recordAgentPassRate(agentType, passed, chapterNumber) {
        const metrics = await this._getMetrics();
        if (!metrics) return;
        if (!metrics.agentPassRates[agentType]) metrics.agentPassRates[agentType] = { total: 0, passed: 0, failChapters: [] };
        metrics.agentPassRates[agentType].total++;
        if (passed) { metrics.agentPassRates[agentType].passed++; }
        else { if (metrics.agentPassRates[agentType].failChapters.length < METRICS_CONFIG.FAIL_CHAPTERS_CAP) metrics.agentPassRates[agentType].failChapters.push(chapterNumber); }
        await this._save(metrics);
    }

    async recordReviserLoop(chapterNumber, loopCount, totalReviserMs, issuesFixed) {
        const metrics = await this._getMetrics();
        if (!metrics) return;
        metrics.reviserLoops.push({ chapterNumber, loopCount, totalReviserMs, issuesFixed, timestamp: new Date().toISOString() });
        if (metrics.reviserLoops.length > METRICS_CONFIG.REVISER_LOOPS_MAX) metrics.reviserLoops = metrics.reviserLoops.slice(-METRICS_CONFIG.REVISER_LOOPS_TRIM);
        await this._save(metrics);
    }

    async recordHookResolution(hookName, chapterNumber, action) {
        const metrics = await this._getMetrics();
        if (!metrics) return;
        metrics.hookResolutionLog.push({ hookName, chapterNumber, action, timestamp: new Date().toISOString() });
        if (metrics.hookResolutionLog.length > METRICS_CONFIG.HOOK_LOG_MAX) metrics.hookResolutionLog = metrics.hookResolutionLog.slice(-METRICS_CONFIG.HOOK_LOG_TRIM);
        await this._save(metrics);
    }

    async recordMaterialAdded(chapterNumber, materialType, materialName, action) {
        const metrics = await this._getMetrics();
        if (!metrics) return;
        metrics.materialAddedLog.push({ chapterNumber, materialType, materialName, action, timestamp: new Date().toISOString() });
        if (metrics.materialAddedLog.length > METRICS_CONFIG.MATERIAL_LOG_MAX) metrics.materialAddedLog = metrics.materialAddedLog.slice(-METRICS_CONFIG.MATERIAL_LOG_TRIM);
        await this._save(metrics);
    }

    async recordBranching(chapterNumber, branchA, branchB, selectedBranch, reason) {
        const metrics = await this._getMetrics();
        if (!metrics) return;
        metrics.branchingLog.push({ chapterNumber, branchA, branchB, selectedBranch, reason, timestamp: new Date().toISOString() });
        if (metrics.branchingLog.length > METRICS_CONFIG.BRANCHING_LOG_MAX) metrics.branchingLog = metrics.branchingLog.slice(-METRICS_CONFIG.BRANCHING_LOG_TRIM);
        await this._save(metrics);
    }

    async recordChapterDuration(chapterNumber, durationMs, rounds) {
        const metrics = await this._getMetrics();
        if (!metrics) return;
        metrics.chapterDurations.push({ chapterNumber, durationMs, rounds, timestamp: new Date().toISOString() });
        if (metrics.chapterDurations.length > METRICS_CONFIG.CHAPTER_DURATIONS_MAX) metrics.chapterDurations = metrics.chapterDurations.slice(-METRICS_CONFIG.CHAPTER_DURATIONS_TRIM);
        await this._save(metrics);
    }

    async recordError(step, errorType) {
        const metrics = await this._getMetrics();
        if (!metrics) return;
        const key = `${step}:${errorType}`;
        metrics.errorCounts[key] = (metrics.errorCounts[key] || 0) + 1;
        await this._save(metrics);
    }

    /**
     * 重置agentPassRates — 清除所有Agent通过率统计
     * 用于章节重置时防止旧失败率触发Alert Loop
     */
    async resetAgentPassRates() {
        const metrics = await this._getMetrics();
        if (!metrics) return;
        metrics.agentPassRates = {};
        await this._save(metrics);
        logger.info('metricsRecorder', `[METRICS] Reset agentPassRates for project ${this.projectId}`);
    }

    /**
     * 从agentPassRates中移除指定章节的失败记录
     * @param {number} chapterNumber
     */
    async removeChapterFromFailRates(chapterNumber) {
        const metrics = await this._getMetrics();
        if (!metrics || !metrics.agentPassRates) return;
        for (const agentType of Object.keys(metrics.agentPassRates)) {
            const data = metrics.agentPassRates[agentType];
            if (data.failChapters) {
                data.failChapters = data.failChapters.filter(c => c !== chapterNumber);
            }
        }
        await this._save(metrics);
    }
}

module.exports = { MetricsCollector, METRICS_KEY };
