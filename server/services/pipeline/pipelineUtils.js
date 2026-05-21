const store = require('../../store');
const { getMetrics } = require('../metricsCollector');
const { getCircuitBreaker } = require('../reviewCircuitBreaker');
const { createVersionTag } = require('../versionControl');
const { getModeConfig } = require('../contentUtils');
const { PIPELINE_CONFIG } = require('../pipelineConfig');

function checkAlertLoop(projectId) {
    const ALERT_CONSECUTIVE_CHAPTERS = PIPELINE_CONFIG.ALERT_CONSECUTIVE_CHAPTERS;
    const ALERT_FAIL_RATE_THRESHOLD = PIPELINE_CONFIG.ALERT_FAIL_RATE_THRESHOLD;

    const metrics = getMetrics(projectId);
    const report = metrics.getReport();
    if (!report?.agentPassRates) return null;

    const alerts = [];
    for (const [agentType, data] of Object.entries(report.agentPassRates)) {
        if (data.total < ALERT_CONSECUTIVE_CHAPTERS) continue;
        const failRate = 1 - (data.passed / data.total);
        if (failRate > ALERT_FAIL_RATE_THRESHOLD) {
            alerts.push({
                agentType,
                failRate: (failRate * 100).toFixed(1) + '%',
                total: data.total,
                passed: data.passed,
                recentFailChapters: data.recentFailChapters || []
            });
        }
    }

    if (alerts.length === 0) return null;

    const diagnosticReport = {
        triggered: true,
        timestamp: new Date().toISOString(),
        projectId,
        alerts,
        suggestions: [],
        circuitBreakerStatus: null
    };

    try {
        const cb = getCircuitBreaker(projectId);
        diagnosticReport.circuitBreakerStatus = cb.getStats();
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

    for (const alert of alerts) {
        if (['first-review', 'second-review', 'fast-review'].includes(alert.agentType)) {
            diagnosticReport.suggestions.push(`${alert.agentType}打回率${alert.failRate}，可能原因：提示词约束过严/模式冲突/素材不一致`);
        } else if (alert.agentType === 'final-editor') {
            diagnosticReport.suggestions.push('定稿人打回率过高，可能原因：writer输出质量不足/风格模板与素材冲突');
        } else if (alert.agentType === 'writer') {
            diagnosticReport.suggestions.push('writer打回率过高，可能原因：大纲指令模糊/上下文预算不足/素材过多导致信息过载');
        }
    }

    if (diagnosticReport.circuitBreakerStatus?.tripped) {
        diagnosticReport.suggestions.push('熔断器已激活，建议：1.检查提示词冲突 2.降低约束强度 3.人工审核最近3章内容');
    }

    console.error(`[PIPELINE] 🚨 ALERT_LOOP TRIGGERED: ${alerts.map(a => `${a.agentType}=${a.failRate}`).join(', ')}`);
    console.error(`[PIPELINE] Diagnostic suggestions: ${diagnosticReport.suggestions.join('; ')}`);

    return diagnosticReport;
}

async function runBranchingWrite(projectId, chapterId, chapter, context, runAgentFn, options = {}) {
    const mode = context.mode || 'novel';
    const metrics = getMetrics(projectId);

    console.log('[PIPELINE] A/B branching: running two writer versions...');

    const branchAContext = { ...context, temperature: (context.temperature || 0.7) };
    const branchBContext = { ...context, temperature: Math.min((context.temperature || 0.7) + PIPELINE_CONFIG.BRANCHING_TEMPERATURE_BOOST, PIPELINE_CONFIG.BRANCHING_MAX_TEMPERATURE) };

    const [resultA, resultB] = await Promise.all([
        runAgentFn('writer', { ...branchAContext, projectId }),
        runAgentFn('writer', { ...branchBContext, projectId })
    ]);

    const contentA = resultA.response || '';
    const contentB = resultB.response || '';

    const wordCountA = contentA.length;
    const wordCountB = contentB.length;

    let selectedBranch = 'A';
    let reason = '';

    const modeConfig = getModeConfig(mode);
    const minWords = modeConfig.minWords || 1500;
    const maxWords = modeConfig.maxWords || 3500;

    const aInRange = wordCountA >= minWords && wordCountA <= maxWords;
    const bInRange = wordCountB >= minWords && wordCountB <= maxWords;

    if (aInRange && !bInRange) {
        selectedBranch = 'A';
        reason = 'A in word range, B not';
    } else if (bInRange && !aInRange) {
        selectedBranch = 'B';
        reason = 'B in word range, A not';
    } else if (aInRange && bInRange) {
        const targetWords = (minWords + maxWords) / 2;
        selectedBranch = Math.abs(wordCountA - targetWords) <= Math.abs(wordCountB - targetWords) ? 'A' : 'B';
        reason = `Both in range, ${selectedBranch} closer to target ${Math.round(targetWords)}`;
    } else {
        selectedBranch = wordCountA >= wordCountB ? 'A' : 'B';
        reason = `Neither in range, ${selectedBranch} has more content`;
    }

    const selectedContent = selectedBranch === 'A' ? contentA : contentB;

    console.log(`[PIPELINE] Branching result: A=${wordCountA}字 B=${wordCountB}字 → Selected ${selectedBranch} (${reason})`);

    try {
        metrics.recordBranching(
            chapter.chapterNumber || 0,
            wordCountA,
            wordCountB,
            selectedBranch,
            reason
        );
    } catch (e) {}

    try {
        createVersionTag(projectId, chapterId, chapter.chapterNumber || 0, (chapter.version || 0) + 1, selectedBranch === 'A' ? contentB : contentA, {
            branch: selectedBranch === 'A' ? 'B-rejected' : 'A-rejected',
            parentTag: null,
            reason: 'branching-unselected'
        });
    } catch (e) {}

    return {
        content: selectedContent,
        branchA: wordCountA,
        branchB: wordCountB,
        selectedBranch,
        reason
    };
}

module.exports = {
    checkAlertLoop,
    runBranchingWrite
};
