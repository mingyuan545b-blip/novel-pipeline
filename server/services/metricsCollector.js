const store = require('../store');
const { METRICS_CONFIG } = require('./pipelineConfig');

const METRICS_KEY = '_pipeline_metrics';

class MetricsCollector {
    constructor(projectId) {
        this.projectId = projectId;
    }

    _getMetrics() {
        const project = store.getItem('projects', this.projectId);
        if (!project) return null;
        if (!project[METRICS_KEY]) {
            project[METRICS_KEY] = {
                agentTimings: {},
                reviewPassRates: {},
                tokenUsage: {},
                chapterDurations: [],
                errorCounts: {},
                agentPassRates: {},
                reviserLoops: [],
                hookResolutionLog: [],
                materialAddedLog: [],
                branchingLog: []
            };
        }
        if (!project[METRICS_KEY].agentPassRates) project[METRICS_KEY].agentPassRates = {};
        if (!project[METRICS_KEY].reviserLoops) project[METRICS_KEY].reviserLoops = [];
        if (!project[METRICS_KEY].hookResolutionLog) project[METRICS_KEY].hookResolutionLog = [];
        if (!project[METRICS_KEY].materialAddedLog) project[METRICS_KEY].materialAddedLog = [];
        if (!project[METRICS_KEY].branchingLog) project[METRICS_KEY].branchingLog = [];
        return project[METRICS_KEY];
    }

    _save(metrics) {
        const project = store.getItem('projects', this.projectId);
        if (!project) return;
        project[METRICS_KEY] = metrics;
        store.setItem('projects', this.projectId, project);
    }

    recordAgentTiming(agentType, durationMs, tokenCount) {
        const metrics = this._getMetrics();
        if (!metrics) return;
        if (!metrics.agentTimings[agentType]) {
            metrics.agentTimings[agentType] = { calls: 0, totalMs: 0, avgMs: 0, maxMs: 0, totalTokens: 0 };
        }
        const t = metrics.agentTimings[agentType];
        t.calls++;
        t.totalMs += durationMs;
        t.avgMs = Math.round(t.totalMs / t.calls);
        t.maxMs = Math.max(t.maxMs, durationMs);
        t.totalTokens += tokenCount || 0;
        this._save(metrics);
    }

    recordReviewResult(step, passed) {
        const metrics = this._getMetrics();
        if (!metrics) return;
        if (!metrics.reviewPassRates[step]) {
            metrics.reviewPassRates[step] = { total: 0, passed: 0 };
        }
        metrics.reviewPassRates[step].total++;
        if (passed) metrics.reviewPassRates[step].passed++;
        this._save(metrics);
    }

    recordAgentPassRate(agentType, passed, chapterNumber) {
        const metrics = this._getMetrics();
        if (!metrics) return;
        if (!metrics.agentPassRates[agentType]) {
            metrics.agentPassRates[agentType] = { total: 0, passed: 0, failChapters: [] };
        }
        metrics.agentPassRates[agentType].total++;
        if (passed) {
            metrics.agentPassRates[agentType].passed++;
        } else {
            if (metrics.agentPassRates[agentType].failChapters.length < METRICS_CONFIG.FAIL_CHAPTERS_CAP) {
                metrics.agentPassRates[agentType].failChapters.push(chapterNumber);
            }
        }
        this._save(metrics);
    }

    recordReviserLoop(chapterNumber, loopCount, totalReviserMs, issuesFixed) {
        const metrics = this._getMetrics();
        if (!metrics) return;
        metrics.reviserLoops.push({
            chapterNumber,
            loopCount,
            totalReviserMs,
            issuesFixed,
            timestamp: new Date().toISOString()
        });
        if (metrics.reviserLoops.length > METRICS_CONFIG.REVISER_LOOPS_MAX) {
            metrics.reviserLoops = metrics.reviserLoops.slice(-METRICS_CONFIG.REVISER_LOOPS_TRIM);
        }
        this._save(metrics);
    }

    recordHookResolution(hookName, chapterNumber, action) {
        const metrics = this._getMetrics();
        if (!metrics) return;
        metrics.hookResolutionLog.push({
            hookName,
            chapterNumber,
            action,
            timestamp: new Date().toISOString()
        });
        if (metrics.hookResolutionLog.length > METRICS_CONFIG.HOOK_LOG_MAX) {
            metrics.hookResolutionLog = metrics.hookResolutionLog.slice(-METRICS_CONFIG.HOOK_LOG_TRIM);
        }
        this._save(metrics);
    }

    recordMaterialAdded(chapterNumber, materialType, materialName, action) {
        const metrics = this._getMetrics();
        if (!metrics) return;
        metrics.materialAddedLog.push({
            chapterNumber,
            materialType,
            materialName,
            action,
            timestamp: new Date().toISOString()
        });
        if (metrics.materialAddedLog.length > METRICS_CONFIG.MATERIAL_LOG_MAX) {
            metrics.materialAddedLog = metrics.materialAddedLog.slice(-METRICS_CONFIG.MATERIAL_LOG_TRIM);
        }
        this._save(metrics);
    }

    recordBranching(chapterNumber, branchA, branchB, selectedBranch, reason) {
        const metrics = this._getMetrics();
        if (!metrics) return;
        metrics.branchingLog.push({
            chapterNumber,
            branchA,
            branchB,
            selectedBranch,
            reason,
            timestamp: new Date().toISOString()
        });
        if (metrics.branchingLog.length > METRICS_CONFIG.BRANCHING_LOG_MAX) {
            metrics.branchingLog = metrics.branchingLog.slice(-METRICS_CONFIG.BRANCHING_LOG_TRIM);
        }
        this._save(metrics);
    }

    recordChapterDuration(chapterNumber, durationMs, rounds) {
        const metrics = this._getMetrics();
        if (!metrics) return;
        metrics.chapterDurations.push({ chapterNumber, durationMs, rounds, timestamp: new Date().toISOString() });
        if (metrics.chapterDurations.length > METRICS_CONFIG.CHAPTER_DURATIONS_MAX) {
            metrics.chapterDurations = metrics.chapterDurations.slice(-METRICS_CONFIG.CHAPTER_DURATIONS_TRIM);
        }
        this._save(metrics);
    }

    recordError(step, errorType) {
        const metrics = this._getMetrics();
        if (!metrics) return;
        const key = `${step}:${errorType}`;
        metrics.errorCounts[key] = (metrics.errorCounts[key] || 0) + 1;
        this._save(metrics);
    }

    getReport() {
        const metrics = this._getMetrics();
        if (!metrics) return { error: 'No metrics found' };

        const report = {
            agentTimings: {},
            reviewPassRates: {},
            agentPassRates: {},
            reviserLoopStats: {},
            hookResolutionStats: {},
            materialStats: {},
            recentChapters: [],
            topErrors: [],
            branchingStats: {}
        };

        for (const [agent, data] of Object.entries(metrics.agentTimings)) {
            report.agentTimings[agent] = { calls: data.calls, avgMs: data.avgMs, maxMs: data.maxMs, avgTokens: Math.round(data.totalTokens / data.calls) };
        }

        for (const [step, data] of Object.entries(metrics.reviewPassRates)) {
            report.reviewPassRates[step] = { rate: data.total > 0 ? (data.passed / data.total * 100).toFixed(1) + '%' : 'N/A', total: data.total, passed: data.passed };
        }

        for (const [agent, data] of Object.entries(metrics.agentPassRates)) {
            report.agentPassRates[agent] = {
                passRate: data.total > 0 ? (data.passed / data.total * 100).toFixed(1) + '%' : 'N/A',
                total: data.total,
                passed: data.passed,
                recentFailChapters: data.failChapters.slice(-5)
            };
        }

        if (metrics.reviserLoops.length > 0) {
            const loops = metrics.reviserLoops;
            const avgLoops = loops.reduce((s, l) => s + l.loopCount, 0) / loops.length;
            const avgMs = loops.reduce((s, l) => s + l.totalReviserMs, 0) / loops.length;
            report.reviserLoopStats = {
                totalChapters: loops.length,
                avgLoopsPerChapter: avgLoops.toFixed(1),
                avgReviserMsPerChapter: Math.round(avgMs),
                maxLoops: Math.max(...loops.map(l => l.loopCount))
            };
        }

        if (metrics.hookResolutionLog.length > 0) {
            const hooks = metrics.hookResolutionLog;
            const resolved = hooks.filter(h => h.action === 'resolved').length;
            const advanced = hooks.filter(h => h.action === 'advanced').length;
            const stale = hooks.filter(h => h.action === 'stale').length;
            report.hookResolutionStats = { total: hooks.length, resolved, advanced, stale, resolveRate: hooks.length > 0 ? (resolved / hooks.length * 100).toFixed(1) + '%' : 'N/A' };
        }

        if (metrics.materialAddedLog.length > 0) {
            const mats = metrics.materialAddedLog;
            const byType = {};
            for (const m of mats) {
                byType[m.materialType] = (byType[m.materialType] || 0) + 1;
            }
            report.materialStats = { totalAdded: mats.length, byType };
        }

        if (metrics.branchingLog.length > 0) {
            const branches = metrics.branchingLog;
            report.branchingStats = {
                totalBranches: branches.length,
                branchASelected: branches.filter(b => b.selectedBranch === 'A').length,
                branchBSelected: branches.filter(b => b.selectedBranch === 'B').length
            };
        }

        report.recentChapters = metrics.chapterDurations.slice(-METRICS_CONFIG.RECENT_CHAPTERS_REPORT);
        report.topErrors = Object.entries(metrics.errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ error: k, count: v }));

        return report;
    }
}

function getMetrics(projectId) {
    return new MetricsCollector(projectId);
}

module.exports = { MetricsCollector, getMetrics };
