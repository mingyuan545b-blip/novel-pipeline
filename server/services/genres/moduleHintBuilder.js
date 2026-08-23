/**
 * moduleHintBuilder.js — 题材功能模块提示生成器
 *
 * 职责：根据题材启用的模块，为不同agent生成专属提示
 * 注入位置：writer/reviewer的prompt中段（素材区之后，约束区之前）
 *
 * 设计原则：
 * - 模块提示是"功能声明"，告诉agent当前题材启用了哪些功能
 * - 不重复约束内容（约束已通过constraintPresets合并注入）
 * - 不重复素材内容（素材已通过materialTemplates合并注入）
 * - 只声明模块元信息：模块名+描述+本章是否启用
 */

'use strict';

const { getModulesForAgent } = require('./genreModuleAssembler');

const WRITER_MODULE_HINT_HEADER = '【功能模块提示 - 本章启用的题材功能】';
const REVIEWER_MODULE_HINT_HEADER = '【功能模块提示 - 审核时需知晓的题材功能】';

/**
 * 为writer生成模块提示
 * @param {object} genre - 题材插件对象
 * @returns {string} 模块提示文本（空字符串表示无模块）
 */
function buildWriterModuleHint(genre) {
    const modules = getModulesForAgent(genre, 'writer');
    if (modules.length === 0) return '';

    const lines = modules.map(m => `- ${m.label}：${m.description}`);
    return `\n\n${WRITER_MODULE_HINT_HEADER}\n本章题材启用了以下功能模块，写作时请充分利用：\n${lines.join('\n')}`;
}

/**
 * 为审核员生成模块提示
 * @param {object} genre - 题材插件对象
 * @param {string} agentType - 审核员类型（first-review/second-review等）
 * @returns {string} 模块提示文本（空字符串表示无模块）
 */
function buildReviewerModuleHint(genre, agentType = 'first-review') {
    const modules = getModulesForAgent(genre, agentType);
    if (modules.length === 0) return '';

    const lines = modules.map(m => `- ${m.label}：${m.description}`);
    return `\n\n${REVIEWER_MODULE_HINT_HEADER}\n本章题材启用了以下功能模块，审核时请知晓这些功能的设定边界：\n${lines.join('\n')}`;
}

/**
 * 通用模块提示生成
 * @param {object} genre - 题材插件对象
 * @param {string} agentType - agent类型
 * @returns {string} 模块提示文本
 */
function buildModuleHint(genre, agentType) {
    if (!genre) return '';
    const isReviewer = ['first-review', 'second-review', 'fast-review', 'final-editor'].includes(agentType);
    const isWriter = ['writer', 'reviser', 'polisher', 'intent-planner', 'outline', 'material-manager'].includes(agentType);
    if (isReviewer) {
        return buildReviewerModuleHint(genre, agentType);
    }
    if (isWriter) {
        return buildWriterModuleHint(genre);
    }
    // reader等非写作/审核agent不注入模块提示
    return '';
}

module.exports = {
    buildWriterModuleHint,
    buildReviewerModuleHint,
    buildModuleHint
};
