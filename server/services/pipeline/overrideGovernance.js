'use strict';

/**
 * override治理（Override Governance）
 *
 * 规范：override必须基于"规则"而非"关键词"
 * 治理：同类问题连续3章被override，第4次禁止override
 *
 * 详见 SOP: docs/sop/08-约束执行规范.md 第四节
 */

const store = require('../../store');
const { getDataContext } = require('../dataContext');
const logger = require('../../shared/logger');
const { getOverrideConfig } = require('../prompts/constraintGovernanceConfig');

const OVERRIDE_GOVERNANCE_WINDOW = getOverrideConfig().windowChapters;
const OVERRIDE_GOVERNANCE_THRESHOLD = getOverrideConfig().thresholdCount;

async function checkOverrideEligibility(projectId, issueType) {
    if (!projectId || !issueType) return { eligible: true };

    const recentOverrides = await _getRecentOverrides(projectId, issueType);
    if (recentOverrides.length >= OVERRIDE_GOVERNANCE_THRESHOLD) {
        logger.warn('overrideGovernance', '[OVERRIDE-BLOCKED] project={projectId} issueType={issueType} consecutiveCount={count}', {
            projectId, issueType, count: recentOverrides.length,
        });
        return {
            eligible: false,
            reason: `同类问题[${issueType}]连续${recentOverrides.length}次被override，本次禁止override，必须修复`,
            consecutiveCount: recentOverrides.length,
        };
    }

    return { eligible: true, consecutiveCount: recentOverrides.length };
}

async function recordOverride(projectId, chapterNumber, issueType, reason, governanceStatus) {
    if (!projectId || !issueType) return;

    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    if (!project) return;

    if (!project.overrideHistory) project.overrideHistory = [];
    project.overrideHistory.push({
        chapterNumber,
        issueType,
        reason,
        governanceStatus,
        timestamp: new Date().toISOString(),
    });

    const recentCutoff = chapterNumber - OVERRIDE_GOVERNANCE_WINDOW;
    project.overrideHistory = project.overrideHistory.filter(o => o.chapterNumber > recentCutoff);

    await store.setItem('projects', projectId, project);
}

async function _getRecentOverrides(projectId, issueType) {
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    if (!project?.overrideHistory) return [];

    const sorted = [...project.overrideHistory].sort((a, b) => b.chapterNumber - a.chapterNumber);
    const recent = sorted.filter(o => o.issueType === issueType).slice(0, OVERRIDE_GOVERNANCE_WINDOW);

    let consecutive = 0;
    for (const o of recent) {
        if (o.governanceStatus === 'eligible') consecutive++;
        else break;
    }
    return recent.slice(0, consecutive);
}

function shouldOverridePerspectiveViolation(issue, protagonistName) {
    if (!issue?.originalText) return false;

    const text = issue.originalText;

    const directlyStatesInnerState = /(?:觉得|感到|心想|暗想|内心|心里想|心中想|脑中想|脑海中想|暗道|心道)/.test(text);
    if (directlyStatesInnerState) return false;

    if (protagonistName) {
        const nonProtagonistSubjects = text.match(new RegExp(`(?!${protagonistName})[\\u4e00-\\u9fa5]{2,4}(?:觉得|感到|心想|暗想|内心)`));
        if (nonProtagonistSubjects) return false;
    }

    const isExternalObservation = /(?:眼神|表情|脸色|脸上|眉头|目光|动作|脚步|呼吸|声音|语气|神态|姿态)/.test(text);
    const isSubjectiveInference = /(?:看来|看起来|似乎|仿佛|想必|八成|估计|大概|应该|推测|猜测|看样子)/.test(text);

    return isExternalObservation || isSubjectiveInference;
}

module.exports = {
    checkOverrideEligibility,
    recordOverride,
    shouldOverridePerspectiveViolation,
    OVERRIDE_GOVERNANCE_WINDOW,
    OVERRIDE_GOVERNANCE_THRESHOLD,
};
