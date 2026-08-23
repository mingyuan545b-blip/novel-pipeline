/**
 * materialDepthCheckerProject.js — 项目级4类素材深度累计校验
 * （自 materialDepthChecker.js 提取，行为不变）
 */
const logger = require('../../shared/logger');
const store = require('../../store');
const entityCenter = require('../entityCenter');
const knowledgeAccess = require('../knowledgeBase/knowledgeAccess');
const { DEPTH_THRESHOLDS } = require('./materialDepthThresholds');

async function checkProjectMaterials(projectId) {
    const report = {
        projectId, checkedAt: new Date().toISOString(),
        passed: true, checks: {}, issues: []
    };

    try {
        // 实体中心
        const entities = await entityCenter.getEntitiesForProject(projectId, { entityType: 'character' });
        const protagonist = entities.find(e => e.roleLevel === 'protagonist');
        const supportingCount = entities.filter(e => e.roleLevel === 'supporting').length;
        const npcCount = entities.filter(e => e.roleLevel === 'npc').length;
        report.checks.entityCenter = {
            totalEntities: entities.length,
            hasProtagonist: !!protagonist,
            supportingCount,
            npcCount,
            passed: !!protagonist
        };
        if (!protagonist) {
            report.issues.push('无主角实体（roleLevel=protagonist），陷阱#70未修复或material-registrar未执行');
            report.passed = false;
        }

        // 知识库
        const facts = await store.queryItems('knowledge-facts', { projectId });
        const accessRecords = await knowledgeAccess.getAccessByProject(projectId);
        report.checks.knowledgeBase = {
            totalFacts: facts.length,
            totalAccess: accessRecords.length,
            passed: facts.length > 0 && accessRecords.length > 0
        };
        if (facts.length === 0) {
            report.issues.push('知识库事实为0，陷阱#67/#68未修复或material-organizer未生成knowledgeChanges');
            report.passed = false;
        }

        // 主线任务
        const quests = await store.queryItems('quests', { projectId });
        const mainQuest = quests.find(q => q.tags?.includes('主线') || q.type === 'main');
        report.checks.mainQuest = {
            totalQuests: quests.length,
            hasMainQuest: !!mainQuest,
            passed: quests.length >= DEPTH_THRESHOLDS.MIN_QUESTS_FOR_PROJECT && !!mainQuest
        };
        if (quests.length === 0) {
            report.issues.push('主线任务为0，陷阱#58未修复或autoInitProject未执行');
            report.passed = false;
        }

        // 角色深度累计
        const depthIssues = [];
        for (const e of entities) {
            const gs = e.genreState || {};
            const sum = (gs.innerVoiceCount || 0) + (gs.autonomousDecisionCount || 0) + (gs.subversiveBehaviorCount || 0);
            if (e.roleLevel === 'protagonist' && sum === 0) {
                depthIssues.push(`主角${e.name}深度三指标全0`);
            }
            if (e.roleLevel === 'supporting' && sum < DEPTH_THRESHOLDS.SUPPORTING_MIN_DEPTH_SUM) {
                depthIssues.push(`配角${e.name}深度和=${sum} < ${DEPTH_THRESHOLDS.SUPPORTING_MIN_DEPTH_SUM}（疑似工具人）`);
            }
        }
        report.checks.characterDepth = {
            protagonistDepth: protagonist ? {
                innerVoice: protagonist.genreState?.innerVoiceCount || 0,
                autonomous: protagonist.genreState?.autonomousDecisionCount || 0,
                subversive: protagonist.genreState?.subversiveBehaviorCount || 0
            } : null,
            passed: depthIssues.length === 0,
            issues: depthIssues
        };
        if (depthIssues.length > 0) {
            report.issues.push(`角色深度异常: ${depthIssues.join('; ')}`);
            report.passed = false;
        }

    } catch (e) {
        report.passed = false;
        report.issues.push(`校验异常: ${e.message}`);
        logger.warn('materialDepth', `checkProjectMaterials failed for ${projectId}: ${e.message}`);
    }

    return report;
}

module.exports = { checkProjectMaterials };
