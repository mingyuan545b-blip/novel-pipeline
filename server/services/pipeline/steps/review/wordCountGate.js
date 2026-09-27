const { getDataContext } = require('../../../dataContext');
const { resolveGenreFromProject } = require('../../../genreConfig');
const { resolveConfig } = require('../../../../config');

/**
 * @param {string} content 正文
 * @param {string} projectId 项目
 * @param {{allowLastRoundGrace?: boolean}} options
 *   allowLastRoundGrace=true 时，轻微不足（≥80%下限）降级为 warning 而非 critical hardBlock。
 *   回归背景（2026-09-21 20章E2E ch6）：字数问题被三道门禁重复拦截，其中这一道被标记为
 *   hardBlock —— 而 shouldOverrideReviewRejection 对 _hardBlock 明确拒绝覆盖，
 *   于是"末轮宽限"放行到审核链后又被这里掐死，整章作废。
 */
async function checkWordCountGate(content, projectId, options = {}) {
    try {
        const ctx = await getDataContext(projectId);
        const proj = await ctx.getProject();
        const genre = resolveGenreFromProject(proj);
        const config = resolveConfig(genre, proj);
        const rejectMin = config.word.rejectMin;
        const maxWords = config.word.maxChapter;
        const actualWc = (content || '').replace(/\s/g, '').length;
        const { LAST_ROUND_GRACE_RATIO } = require('../../pipelineHelpers/pipelineWordCount');
        const blocks = [];
        if (actualWc < rejectMin) {
            const graceful = options.allowLastRoundGrace && actualWc >= Math.round(rejectMin * LAST_ROUND_GRACE_RATIO);
            blocks.push({
                severity: graceful ? 'warning' : 'critical',
                description: `字数不达标：${actualWc}字 < 最低${rejectMin}字，${graceful ? '末轮宽限，降级为建议（字数由流水线统一管理）' : '必须扩展内容'}`,
                title: '字数不达标',
                _graceful: Boolean(graceful)
            });
        }
        if (actualWc > maxWords) {
            blocks.push({ severity: 'critical', description: `字数超标：${actualWc}字 > 上限${maxWords}字，必须精简内容`, title: '字数超标' });
        }
        return blocks;
    } catch (_) {
        return [];
    }
}

module.exports = { checkWordCountGate };
