/**
 * materialDepthChecker.js — 4类素材深度自动校验器
 *
 * 触发时机：pipeline成功完成后（orchestratorStepLoop.js feResult.success）
 * 校验内容：实体中心/知识库/主线任务/角色深度 四类素材是否到位
 * 异常处理：写入healthMonitor告警 + 返回校验报告
 *
 * 设计原则：
 * - 只读校验，不修改任何数据
 * - 单章节校验+项目级累计校验两层
 * - 异常自动告警，不需人盯
 */
const logger = require('../../shared/logger');
const store = require('../../store');
const entityCenter = require('../entityCenter');
const knowledgeAccess = require('../knowledgeBase/knowledgeAccess');
const healthMonitor = require('../healthMonitor');

// 校验阈值常量（禁止硬编码业务值的例外：阈值必须显式定义供调优）
const DEPTH_THRESHOLDS = {
    PROTAGONIST_MIN_INNER_VOICE: 1,
    PROTAGONIST_MIN_AUTONOMOUS: 0,
    SUPPORTING_MIN_DEPTH_SUM: 1,
    MIN_FACTS_PER_CHAPTER: 1,
    MIN_ACCESS_PER_CHAPTER: 1,
    MIN_QUESTS_FOR_PROJECT: 1
};

/**
 * 校验单章节4类素材到位情况
 * @param {string} projectId
 * @param {number} chapterNumber
 * @returns {Promise<object>} 校验报告 {passed, checks, issues}
 */
async function checkChapterMaterials(projectId, chapterNumber) {
    const report = {
        projectId, chapterNumber, checkedAt: new Date().toISOString(),
        passed: true, checks: {}, issues: []
    };

    try {
        // 检查1: material-organizer输出是否持久化
        const chapters = await store.queryItems('chapters', { projectId });
        const chapter = chapters.find(c => c.chapterNumber === chapterNumber);
        const moOutput = chapter?.materialOrganizerOutput;
        report.checks.materialOrganizerOutput = {
            exists: !!moOutput,
            length: moOutput ? moOutput.length : 0,
            passed: !!moOutput
        };
        if (!moOutput) {
            report.issues.push(`ch${chapterNumber}: materialOrganizerOutput为空（陷阱#68未修复或material-organizer未执行）`);
            report.passed = false;
        }

        // 检查2: 本章知识库增量（facts和access的chapterNumber等于本章）
        const facts = await store.queryItems('knowledge-facts', { projectId });
        const chapterFacts = facts.filter(f => f.chapterNumber === chapterNumber);
        report.checks.knowledgeFacts = {
            count: chapterFacts.length,
            threshold: DEPTH_THRESHOLDS.MIN_FACTS_PER_CHAPTER,
            passed: chapterFacts.length >= DEPTH_THRESHOLDS.MIN_FACTS_PER_CHAPTER
        };
        if (chapterFacts.length < DEPTH_THRESHOLDS.MIN_FACTS_PER_CHAPTER) {
            report.issues.push(`ch${chapterNumber}: 知识库事实${chapterFacts.length}条 < 阈值${DEPTH_THRESHOLDS.MIN_FACTS_PER_CHAPTER}`);
            report.passed = false;
        }

        const accessRecords = await knowledgeAccess.getAccessByProject(projectId);
        const chapterAccess = accessRecords.filter(a => (a.sinceChapter || a.chapterNumber) === chapterNumber);
        report.checks.knowledgeAccess = {
            count: chapterAccess.length,
            threshold: DEPTH_THRESHOLDS.MIN_ACCESS_PER_CHAPTER,
            passed: chapterAccess.length >= DEPTH_THRESHOLDS.MIN_ACCESS_PER_CHAPTER
        };
        if (chapterAccess.length < DEPTH_THRESHOLDS.MIN_ACCESS_PER_CHAPTER) {
            report.issues.push(`ch${chapterNumber}: 知识访问记录${chapterAccess.length}条 < 阈值${DEPTH_THRESHOLDS.MIN_ACCESS_PER_CHAPTER}`);
            report.passed = false;
        }

        // 检查3: 本章角色深度指标增量
        const entities = await entityCenter.getEntitiesForProject(projectId, { entityType: 'character' });
        const chapterDepthIssues = [];
        for (const e of entities) {
            const gs = e.genreState || {};
            // 角色深度指标是累加的，本章有内容则指标应>=1（至少主角）
            if (e.roleLevel === 'protagonist') {
                const iv = gs.innerVoiceCount || 0;
                const ad = gs.autonomousDecisionCount || 0;
                if (iv < DEPTH_THRESHOLDS.PROTAGONIST_MIN_INNER_VOICE) {
                    chapterDepthIssues.push(`主角${e.name} innerVoiceCount=${iv} < ${DEPTH_THRESHOLDS.PROTAGONIST_MIN_INNER_VOICE}`);
                }
            }
        }
        report.checks.characterDepth = {
            protagonistChecked: entities.filter(e => e.roleLevel === 'protagonist').length,
            passed: chapterDepthIssues.length === 0,
            issues: chapterDepthIssues
        };
        if (chapterDepthIssues.length > 0) {
            report.issues.push(`ch${chapterNumber}: 角色深度不足 - ${chapterDepthIssues.join('; ')}`);
            report.passed = false;
        }

    } catch (e) {
        report.passed = false;
        report.issues.push(`校验异常: ${e.message}`);
        logger.warn('materialDepth', `checkChapterMaterials failed for ch${chapterNumber}: ${e.message}`);
    }

    return report;
}

/**
 * 校验项目级4类素材累计情况（用于周期性健康检查）
 * @param {string} projectId
 * @returns {Promise<object>} 校验报告
 */
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

/**
 * Pipeline完成后自动校验并告警
 * @param {string} projectId
 * @param {number} chapterNumber
 */
async function verifyAndAlert(projectId, chapterNumber) {
    try {
        const report = await checkChapterMaterials(projectId, chapterNumber);
        if (!report.passed) {
            const level = report.issues.length >= 3 ? 'critical' : 'warning';
            const message = `ch${chapterNumber}素材深度异常: ${report.issues.join('; ')}`;
            healthMonitor.addAlert(level, 'material-depth', message);
            logger.warn('materialDepth', `[AUTO-CHECK] ${message}`);
        } else {
            logger.info('materialDepth', `[AUTO-CHECK] ch${chapterNumber}素材深度校验通过`);
        }
        return report;
    } catch (e) {
        logger.warn('materialDepth', `verifyAndAlert failed: ${e.message}`);
        return { passed: false, issues: [e.message] };
    }
}

module.exports = {
    checkChapterMaterials,
    checkProjectMaterials,
    verifyAndAlert,
    DEPTH_THRESHOLDS
};
