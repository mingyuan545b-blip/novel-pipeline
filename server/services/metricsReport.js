const { METRICS_CONFIG } = require('./pipelineConfig');
const pipelineMetrics = require('./pipelineMetrics');

function buildReport(metrics) {
    if (!metrics) return { error: 'No metrics found' };

    const report = {
        agentTimings: {}, reviewPassRates: {}, agentPassRates: {},
        reviserLoopStats: {}, hookResolutionStats: {}, materialStats: {},
        recentChapters: [], topErrors: [], branchingStats: {},
        // M3：最慢步骤排行（按 p95 降序）
        topSlowestSteps: []
    };

    for (const [agent, data] of Object.entries(metrics.agentTimings)) {
        report.agentTimings[agent] = {
            calls: data.calls, avgMs: data.avgMs, maxMs: data.maxMs,
            avgTokens: Math.round(data.totalTokens / data.calls)
        };
    }

    for (const [step, data] of Object.entries(metrics.reviewPassRates)) {
        report.reviewPassRates[step] = { rate: data.total > 0 ? (data.passed / data.total * 100).toFixed(1) + '%' : 'N/A', total: data.total, passed: data.passed };
    }

    for (const [agent, data] of Object.entries(metrics.agentPassRates)) {
        report.agentPassRates[agent] = {
            passRate: data.total > 0 ? (data.passed / data.total * 100).toFixed(1) + '%' : 'N/A',
            total: data.total, passed: data.passed, recentFailChapters: data.failChapters.slice(-5)
        };
    }

    if (metrics.reviserLoops.length > 0) {
        const loops = metrics.reviserLoops;
        const avgLoops = loops.reduce((s, l) => s + l.loopCount, 0) / loops.length;
        const avgMs = loops.reduce((s, l) => s + l.totalReviserMs, 0) / loops.length;
        report.reviserLoopStats = {
            totalChapters: loops.length, avgLoopsPerChapter: avgLoops.toFixed(1),
            avgReviserMsPerChapter: Math.round(avgMs), maxLoops: Math.max(...loops.map(l => l.loopCount))
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
        for (const m of mats) { byType[m.materialType] = (byType[m.materialType] || 0) + 1; }
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

    // M3：填充最慢步骤排行（从 pipelineMetrics 实时获取，不依赖传入的 metrics 参数）
    report.topSlowestSteps = pipelineMetrics.getSlowestSteps(5);

    return report;
}

module.exports = { buildReport };
