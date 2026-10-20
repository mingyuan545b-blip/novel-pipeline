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
/**
 * 润色字数下限判定（唯一源）：true=可采纳润色稿；false=应保留原文（禁止缩短）。
 * 规则（2026-10-10 根因修复）：
 *   ① 已达标(≥targetMin)的稿件，不得被润色降回 targetMin 以下（封住"越润越短到 targetMin 之下"）；
 *   ② 终稿不得低于 rejectMin（且必须满足"不短于原文"才允许在该区间内）。
 * 此前的守卫只在"原文本身就 <rejectMin"时才回退 → 原文≥rejectMin 时完全不设防，
 * 加上只校验相对比例(0.8~1.2)，润色可"合法"缩水 20%，实测 20 章有 10 章跌破 targetMin。
 */
function shouldAcceptPolishedLength(originalWc, polishedWc, wordConfig) {
    if (!(polishedWc > 0)) return false;
    const targetMin = wordConfig?.targetMin || 0;
    const rejectMin = wordConfig?.rejectMin || 0;
    if (targetMin > 0 && originalWc >= targetMin && polishedWc < targetMin) return false;
    if (rejectMin > 0 && polishedWc < rejectMin && polishedWc < originalWc) return false;
    return true;
}

function guardPolishedLength(polished, original, project, genre) {
    const polishedWc = (polished || '').replace(/\s/g, '').length;
    const originalWc = (original || '').replace(/\s/g, '').length;
    if (!polishedWc) return { content: original, wordCount: originalWc, reverted: true, reason: '润色输出为空' };
    if (originalWc === 0) return { content: polished, wordCount: polishedWc, reverted: false };
    let word = {};
    try { word = resolveConfig(genre, project).word || {}; } catch (_) { logger.warn('polisher', _.message || _); }  // DEGRADE: 影响=resolveConfig 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    if (!shouldAcceptPolishedLength(originalWc, polishedWc, word)) {
        logger.warn('polisher', `[字数守卫] 润色稿被拒(${originalWc}→${polishedWc}，targetMin=${word.targetMin}，rejectMin=${word.rejectMin})，保留定稿正文`);
        return { content: original, wordCount: originalWc, reverted: true, reason: `润色不得把稿件降到下限以下（${originalWc}→${polishedWc}）` };
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

module.exports = { handlePolisher, guardPolishedLength, shouldAcceptPolishedLength };
