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
    // offValue 必须是"关闭"语义的值（'off'）。
    // 修复 F2（docs/worklog/2026-10-17-假成果审查-问题统计.md）：
    // 原为 'on' → getModuleConfig 在项目未配置时返回 'on' → isModuleEnabled = (config !== 'on') = false
    // → 模块被永久禁用，16 个项目 / 137 章 0 条反馈数据。
    registerModule(MODULE_ID, { onPostApproval }, 'constraintFeedback', 'off');
    logger.info('constraintFeedbackModule', 'Module registered: constraint-feedback');
}

module.exports = {
    registerConstraintFeedbackModule,
    onPostApproval,
    MODULE_ID,
};
