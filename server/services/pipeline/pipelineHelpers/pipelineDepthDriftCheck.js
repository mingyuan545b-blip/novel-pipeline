'use strict';

/**
 * pipelineDepthDriftCheck.js — 每章角色深度巡检（从 pipelinePostApproval 拆出）
 *
 * 目的（Q2）：人设不崩，但也不能每章都花 token 补全。
 * 策略：先用 validateMaterialDepth 免费校验，只有某角色跌破"要求字数 × 阈值比例"
 *      才触发一次批量 LLM 补全（阈值见 config/materialContentPolicy.driftRepairTriggerRatio）。
 */
const logger = require('../../../shared/logger');

async function runDepthDriftCheck(projectId, chapterId, chapterNumber, pipelineLog, onStep, genre) {
    try {
        const { enforceChapterDrift } = require('../materialDepthEnforcer');
        const { getOutlineApiConfig } = require('../constants');
        const cp = genre?.characterProfile || {};
        const stats = await enforceChapterDrift(projectId, {
            apiConfig: await getOutlineApiConfig(),
            chapterNumber,
            roleWordCounts: { protagonist: cp.protagonistWordCount, supporting: cp.supportingWordCount, npc: cp.npcWordCount },
        });
        if (stats.drifted.length === 0) return stats;
        pipelineLog.push({
            step: 'material-depth-drift', status: 'warning', passed: stats.repaired > 0,
            errors: stats.drifted,
            summary: '角色深度退化' + stats.drifted.length + '项，已补全' + stats.repaired + '项：' + stats.drifted.join('、'),
            timestamp: new Date().toISOString(),
        });
        if (onStep) onStep({ step: 'material-depth-drift', passed: stats.repaired > 0, roleName: '深度巡检', feedback: { summary: '角色深度退化' + stats.drifted.length + '项，补全' + stats.repaired + '项' } });
        return stats;
    } catch (e) {
        logger.warn('postApproval', 'Depth drift check failed:', e.message);
        return { checked: 0, drifted: [], repaired: 0 };
    }
}

module.exports = { runDepthDriftCheck };
