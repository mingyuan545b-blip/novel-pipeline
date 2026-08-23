'use strict';

/**
 * 约束反馈模块（Constraint Feedback Module）
 *
 * 注册到pipelineModuleRegistry，在章节审核通过后自动收集约束执行反馈
 * 详见 SOP: docs/sop/08-约束执行规范.md 第三节
 */

const store = require('../../../store');
const { collectConstraintFeedback } = require('../../prompts/constraintFeedbackCollector');
const logger = require('../../../shared/logger');

const MODULE_ID = 'constraint-feedback';

async function onPostApproval(projectId, chapterNumber, chapterContent) {
    if (!projectId || !chapterNumber || !chapterContent) return;

    try {
        const chapters = await store.queryItems('chapters', { projectId });
        const sorted = chapters
            .filter(c => c.chapterNumber < chapterNumber && c.content)
            .sort((a, b) => b.chapterNumber - a.chapterNumber);
        const prevChapterContent = sorted[0]?.content || '';

        const materials = await store.queryItems('materials', { projectId });
        const sideCharacterNames = materials
            .filter(m => m.type === 'character' && !(m.tags || []).includes('主角'))
            .map(m => m.name)
            .filter(Boolean);

        await collectConstraintFeedback(
            projectId, chapterNumber, chapterContent, prevChapterContent, sideCharacterNames
        );

        logger.info('constraintFeedbackModule', '[POST-APPROVAL] project={projectId} ch={chapterNumber} feedback collected', {
            projectId, chapterNumber,
        });
    } catch (err) {
        logger.error('constraintFeedbackModule', '[POST-APPROVAL-ERROR] project={projectId} ch={chapterNumber} error={error}', {
            projectId, chapterNumber, error: err.message,
        });
    }
}

function registerConstraintFeedbackModule() {
    const { registerModule } = require('../../pipelineModuleRegistry');
    registerModule(MODULE_ID, { onPostApproval }, 'constraintFeedback', 'on');
    logger.info('constraintFeedbackModule', 'Module registered: constraint-feedback');
}

module.exports = {
    registerConstraintFeedbackModule,
    onPostApproval,
    MODULE_ID,
};
