const { cleanChapterContent } = require('../../contentUtils');
const { saveAgentOutput } = require('../../fileOutput');
const { resolveGenreFromProject } = require('../../genreConfig');
const { assembleMaterialState } = require('../materialStateAssembler');
const { injectMaterials, buildCharacterByFormat } = require('../materialInjector');
const { resolveConfig } = require('../../../config');
const logger = require('../../../shared/logger');
const store = require('../../../store');

/**
 * 润色字数守卫（2026-09-21 20章E2E）。
 * 回归背景：ch4 定稿前 2206 字 → 润色后 1850 字（-16%），章节仍被判 material-updated，
 * 最终成品比 2500 下限少 650 字 —— 前置所有字数门禁全部白做。
 * 原因：输出契约只校验"润色后 ≥ 输入 80%"（PO-001，相对值），不管绝对下限。
 * 规则：正文已低于最低要求时，润色只允许持平或变长，禁止再缩短。
 */
function guardPolishedLength(polished, original, project, genre) {
    const polishedWc = (polished || '').replace(/\s/g, '').length;
    const originalWc = (original || '').replace(/\s/g, '').length;
    if (!polishedWc) return { content: original, wordCount: originalWc, reverted: true, reason: '润色输出为空' };
    if (originalWc === 0) return { content: polished, wordCount: polishedWc, reverted: false };
    let rejectMin = 0;
    try { rejectMin = resolveConfig(genre, project).word.rejectMin; } catch (_) { logger.warn('polisher', _.message || _); }
    if (rejectMin > 0 && originalWc < rejectMin && polishedWc < originalWc) {
        logger.warn('polisher', `润色导致字数下降且低于下限(${originalWc}→${polishedWc}，下限${rejectMin})，回退定稿正文`);
        return { content: original, wordCount: originalWc, reverted: true, reason: `原文已低于下限${rejectMin}字，润色不得再缩短` };
    }
    return { content: polished, wordCount: polishedWc, reverted: false };
}

async function handlePolisher({ projectId, chapter, agentContext, runAgent, materials, project }) {
    const genre = resolveGenreFromProject(project);
    const scheduled = await assembleMaterialState('polisher', {
        projectId, chapter, materials: materials || [], ctx: {}, project, genre
    });
    const mats = scheduled.materials;

    // 角色简表段：通过声明式配置（characterFormat='simple'）自动选择buildCharacterBriefSection
    const charSec = buildCharacterByFormat(mats.character, 'polisher', '润色时保持一致');

    // 其余素材通过统一注入层注入（foreshadowFilter='none'已从声明读取）
    const materialAgentContext = { content: '' };
    injectMaterials(scheduled, materialAgentContext, {
        agentType: 'polisher',
        totalBudget: 3000,
    });

    agentContext.content = `请润色以下已通过审核的正文。

【规则】
1. 只做文采提升，不改变剧情/人物/设定/字数
2. 只输出润色后的正文，不输出任何分析、注释、说明、比较、思考过程
3. 不要逐段分析原文，不要标注修改了哪里，不要解释为什么这样改
4. 直接输出完整的润色后正文，格式与原文一致
${charSec}${materialAgentContext.content}

【正文】
${(chapter.content || '').substring(0, 8000)}`;

    const result = await runAgent('polisher', agentContext);
    const polished = cleanChapterContent(result.response);
    const original = chapter.content || chapter.reviserOutput || chapter.writerOutput || '';
    const guarded = guardPolishedLength(polished, original, project, genre);
    if (guarded.reverted) {
        logger.warn('polisher', `[字数守卫] ${guarded.reason}`);
        chapter.polisherOutput = original;
        chapter.polisherGuard = { reverted: true, reason: guarded.reason, polishedWordCount: (polished || '').replace(/\s/g, '').length };
    } else {
        chapter.polisherOutput = guarded.content;
    }
    saveAgentOutput(projectId, chapter, 'polisher', chapter.polisherOutput);
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapter.id, chapter);
    return { step: 'polisher', result, passed: true, chapter };
}

module.exports = { handlePolisher, guardPolishedLength };
