const logger = require('../../shared/logger');
const store = require('../../store');
const { getMetrics } = require('../metricsCollector');
const { getCircuitBreaker } = require('../reviewCircuitBreaker');
const { createVersionTag } = require('../versionControl');
const { resolveConfig } = require('../../config');
const { resolveGenreFromProject } = require('../genreConfig');
const { getDataContext } = require('../dataContext');
const { PIPELINE_CONFIG } = require('../pipelineConfig');

async function checkAlertLoop(projectId) {
    const ALERT_CONSECUTIVE_CHAPTERS = PIPELINE_CONFIG.ALERT_CONSECUTIVE_CHAPTERS;
    const ALERT_FAIL_RATE_THRESHOLD = PIPELINE_CONFIG.ALERT_FAIL_RATE_THRESHOLD;

    const metrics = getMetrics(projectId);
    const report = await metrics.getReport();
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
    } catch(_) { logger.warn('pipelineUtils', _.message || _); }  // DEGRADE: 影响=getCircuitBreaker 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

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

    logger.error('pipelineUtils', `🚨 ALERT_LOOP TRIGGERED: ${alerts.map(a => `${a.agentType}=${a.failRate}`).join(', ')}`);
    logger.error('pipelineUtils', `Diagnostic suggestions: ${diagnosticReport.suggestions.join('; ')}`);

    return diagnosticReport;
}

async function runBranchingWrite(projectId, chapterId, chapter, context, runAgentFn, options = {}) {
    const mode = context.mode || 'novel';
    const metrics = getMetrics(projectId);

    logger.info('pipelineUtils', 'A/B branching: running two writer versions...');

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

    const _branchCtx = await getDataContext(projectId);
    const project = await _branchCtx.getProject();
    const _branchGenre = resolveGenreFromProject(project);
    const _branchConfig = resolveConfig(_branchGenre, project);
    const minWords = _branchConfig.word.targetMin;
    const maxWords = _branchConfig.word.maxChapter;

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

    logger.info('pipelineUtils', `Branching result: A=${wordCountA}字 B=${wordCountB}字 → Selected ${selectedBranch} (${reason})`);

    try {
        metrics.recordBranching(
            chapter.chapterNumber || 0,
            wordCountA,
            wordCountB,
            selectedBranch,
            reason
        );
    } catch (e) { logger.warn('pipelineUtils', '[pipeline-utils]', e.message || e); }  // DEGRADE: 影响=metrics.recordBranching 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    try {
        createVersionTag(projectId, chapterId, chapter.chapterNumber || 0, (chapter.version || 0) + 1, selectedBranch === 'A' ? contentB : contentA, {
            branch: selectedBranch === 'A' ? 'B-rejected' : 'A-rejected',
            parentTag: null,
            reason: 'branching-unselected'
        });
    } catch (e) { logger.warn('pipelineUtils', '[pipeline-utils]', e.message || e); }  // DEGRADE: 影响=createVersionTag 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

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
