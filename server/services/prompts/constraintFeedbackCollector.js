'use strict';

/**
 * 约束执行反馈收集器（Constraint Feedback Collector）
 *
 * 功能：每章生成后统计T0/T1约束执行情况，存入项目状态
 * 作用：为下一章prompt提供"上章约束执行反馈"，形成闭环
 *
 * 详见 SOP: docs/sop/08-约束执行规范.md 第三节
 */

const store = require('../../store');
const { getDataContext } = require('../dataContext');
const { runAllMetaConstraintDetections } = require('./constraintDetectionRegistry');
const { getFeedbackConfig } = require('./constraintGovernanceConfig');
const logger = require('../../shared/logger');

const FEEDBACK_WINDOW = getFeedbackConfig().windowChapters;
const FEEDBACK_RATES = {
    escalateToHardBlock: getFeedbackConfig().rateEscalateToHardBlock,
    weightIncrease: getFeedbackConfig().rateWeightIncrease,
    weightDecrease: getFeedbackConfig().rateWeightDecrease,
};

async function collectConstraintFeedback(projectId, chapterNumber, chapterContent, prevChapterContent, sideCharacterNames) {
    const params = {
        content: chapterContent,
        chapterNumber,
        prevChapterContent,
        sideCharacterNames,
    };

    const detectionResults = await runAllMetaConstraintDetections(params);

    const chapterStats = {};
    for (const [id, result] of Object.entries(detectionResults)) {
        chapterStats[id] = {
            violated: result.violated,
            violationCount: result.violations.length,
            actual: result.actual,
            threshold: result.threshold,
        };
    }

    await _saveChapterFeedback(projectId, chapterNumber, chapterStats);

    const cumulative = await _computeCumulativeStats(projectId, chapterNumber);
    await _saveCumulativeStats(projectId, cumulative);

    logger.info('constraintFeedbackCollector', '[FEEDBACK-COLLECT] project={projectId} ch={chapterNumber} stats={stats}', {
        projectId, chapterNumber, stats: chapterStats,
    });

    return { chapterStats, cumulative };
}

async function _saveChapterFeedback(projectId, chapterNumber, stats) {
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    if (!project) return;

    if (!project.constraintFeedback) project.constraintFeedback = {};
    if (!project.constraintFeedback.chapters) project.constraintFeedback.chapters = {};
    project.constraintFeedback.chapters[chapterNumber] = {
        stats,
        timestamp: new Date().toISOString(),
    };

    await store.setItem('projects', projectId, project);
}

async function _computeCumulativeStats(projectId, currentChapter) {
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    if (!project?.constraintFeedback?.chapters) return {};

    const chapters = project.constraintFeedback.chapters;
    const recentStart = Math.max(1, currentChapter - FEEDBACK_WINDOW + 1);
    const recentChapterNumbers = [];
    for (let n = recentStart; n < currentChapter; n++) recentChapterNumbers.push(n);

    const cumulative = {};
    const constraintIds = new Set();
    for (const num of Object.keys(chapters)) {
        const chStats = chapters[num].stats || {};
        Object.keys(chStats).forEach(id => constraintIds.add(id));
    }

    for (const id of constraintIds) {
        let recentViolations = 0;
        let recentTotal = 0;
        let totalViolations = 0;
        let totalChapters = 0;

        for (const num of recentChapterNumbers) {
            const ch = chapters[num];
            if (!ch?.stats?.[id]) continue;
            recentTotal++;
            if (ch.stats[id].violated) recentViolations++;
        }

        for (const num of Object.keys(chapters)) {
            const ch = chapters[num];
            if (!ch?.stats?.[id]) continue;
            totalChapters++;
            if (ch.stats[id].violated) totalViolations++;
        }

        cumulative[id] = {
            recent3Rate: recentTotal > 0 ? 1 - (recentViolations / recentTotal) : 1,
            totalRate: totalChapters > 0 ? 1 - (totalViolations / totalChapters) : 1,
            recentViolationCount: recentViolations,
            totalViolationCount: totalViolations,
        };
    }

    return cumulative;
}

async function _saveCumulativeStats(projectId, cumulative) {
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    if (!project) return;
    if (!project.constraintFeedback) project.constraintFeedback = {};
    project.constraintFeedback.cumulative = cumulative;
    project.constraintFeedback.lastUpdated = new Date().toISOString();
    await store.setItem('projects', projectId, project);
}

async function getConstraintFeedbackForPrompt(projectId, chapterNumber) {
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    if (!project?.constraintFeedback) return null;

    const cumulative = project.constraintFeedback.cumulative || {};
    const chapters = project.constraintFeedback.chapters || {};
    const prevChapter = chapters[chapterNumber - 1];

    if (!prevChapter && Object.keys(cumulative).length === 0) return null;

    const lines = [];
    lines.push('## 上章约束执行反馈（自动生成，权重已调整）');

    if (prevChapter) {
        const stats = prevChapter.stats || {};
        for (const [id, s] of Object.entries(stats)) {
            if (s.violated) {
                lines.push(`- ${id}: 上章违规${s.violationCount}次，本章权重×1.5`);
            }
        }
    }

    for (const [id, c] of Object.entries(cumulative)) {
        if (c.recent3Rate < FEEDBACK_RATES.escalateToHardBlock) {
            lines.push(`- ${id}: 连续${FEEDBACK_WINDOW}章执行率${(c.recent3Rate * 100).toFixed(0)}%，已升级为hardBlock`);
        } else if (c.recent3Rate < FEEDBACK_RATES.weightIncrease) {
            lines.push(`- ${id}: 近${FEEDBACK_WINDOW}章执行率${(c.recent3Rate * 100).toFixed(0)}%，本章权重×1.5`);
        } else if (c.recent3Rate > FEEDBACK_RATES.weightDecrease) {
            lines.push(`- ${id}: 近${FEEDBACK_WINDOW}章执行率${(c.recent3Rate * 100).toFixed(0)}%（已内化，权重×0.8）`);
        }
    }

    return lines.length > 1 ? lines.join('\n') : null;
}

module.exports = {
    collectConstraintFeedback,
    getConstraintFeedbackForPrompt,
    FEEDBACK_WINDOW,
};
