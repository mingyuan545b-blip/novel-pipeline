const store = require('../../store');
const llm = require('../../services/llm');
const logger = require('../../shared/logger');
const { getOutlineApiConfig } = require('./constants');
const { getVisibleMaterials } = require('./volumeHelpers');
const { buildVolumeRhythmGuidance } = require('./volumeRhythm');
const { buildMaterialSummary } = require('./outlineFormatter');
const { getReaderAdvisory, formatAdvisoryForOutline } = require('./readerAdvisory');
const { getGenrePlugin } = require('../genreConfig');
const { buildConstraintInjection } = require('../prompts/constraintInjector');
const { buildStyleInjection } = require('../prompts/styleInjector');
const { getDataContext } = require('../dataContext');
const { handleVolumeTransition } = require('./outlineVolumeTransition');
const { parseAndSaveOutlines } = require('./outlineResultSaver');

async function supplementChapterOutlines(projectId, existingCount, supplementCount = 30, retryHint = '') {
    const _suppCtx = await getDataContext(projectId);
    const project = await _suppCtx.getProject();
    if (!project) throw new Error('Project not found');

    const { isVolumeComplete, adjustedCount } = await handleVolumeTransition(projectId, existingCount, supplementCount);
    supplementCount = adjustedCount;

    const targetChapterForVis = existingCount + 1;
    const vis = await getVisibleMaterials(projectId, targetChapterForVis, { purpose: 'outline' });
    const filteredMaterials = vis.materials;
    const currentVolSubplane = vis.currentVolSubplane;

    const chapters = (await store.queryItems('chapters', { projectId })).sort((a, b) => a.chapterNumber - b.chapterNumber);
    const { endingGuidance } = buildEndingGuidance(project, chapters, existingCount, supplementCount);

    let materialSummary = buildMaterialSummary(filteredMaterials, currentVolSubplane);
    if (materialSummary.length > 6000) materialSummary = materialSummary.substring(0, 6000);

    let recentChaptersSummary = buildRecentChaptersSummary(chapters, isVolumeComplete);
    if (recentChaptersSummary.length > 3000) recentChaptersSummary = recentChaptersSummary.substring(0, 3000);

    const existingTitles = chapters.map(c => c.title).filter(Boolean);
    const existingOutlineStarts = chapters.map(c => (c.outline || '').substring(0, 50)).filter(s => s.length > 0);

    const lockedSubNames = vis.lockedSubplaneNames;
    ({ recentChaptersSummary, materialSummary } = maskLockedSubplanes(lockedSubNames, recentChaptersSummary, materialSummary, existingTitles, existingOutlineStarts));

    const constraintInjection = await buildConstraintInjection(projectId, 'outline');
    const styleInjection = await buildStyleInjection(projectId);
    const genreSection = constraintInjection ? `\n\n${constraintInjection}` : '';
    const styleSection = styleInjection ? `\n\n${styleInjection}` : '';

    const genrePlugin = getGenrePlugin({ ...(project?.styleProfile || {}), genre: project?.genre, styleTemplateId: project?.styleTemplateId, genreProfile: project?.genreProfile });
    const genreStyle = genrePlugin?.styleProfile || {};
    const titleRule = genreStyle.titleRule || '章节标题要有画面感和吸引力，让读者一看就想点进来';
    const pacingRule = genrePlugin?.foundation?.additionalFoundationRules?.length ? genrePlugin.foundation.additionalFoundationRules.join('\n') : '- 每章必须有明确的剧情推进\n- 章末必须有钩子或悬念';
    const constraintRule = genrePlugin?.foundation?.additionalConstraints?.length ? genrePlugin.foundation.additionalConstraints.map(c => `- ${c.label}：${c.desc}`).join('\n') : '';

    const volumeRhythmGuidance = await buildVolumeRhythmGuidance(projectId, supplementCount, existingCount);
    const readerAdvisorySection = await buildReaderAdvisorySection(projectId, existingCount);
    const volumeTransitionGuidance = isVolumeComplete ? `\n\n【关键：新一卷开始！】\n这是第${Math.floor(existingCount / 30) + 1}卷的开篇！\n- 与上一卷的衔接：主角从上一卷获得了新能力/新认知，引发新的冲突\n- 必须引入新的配角互动和情感线推进` : '';

    const messages = buildPromptMessages(project, existingCount, supplementCount, titleRule, pacingRule, constraintRule, volumeRhythmGuidance, volumeTransitionGuidance, genreSection, styleSection, readerAdvisorySection, existingTitles, endingGuidance, retryHint, materialSummary, recentChaptersSummary);

    logger.info('outlineSupplementer', '[PIPELINE] generating {count} new outlines after chapter {existing}', { count: supplementCount, existing: existingCount });

    const result = await llm.chat(messages, { temperature: 0.8, maxTokens: 32768, apiConfig: await getOutlineApiConfig() });
    const responseText = result.choices?.[0]?.message?.content || '';

    return await parseAndSaveOutlines(projectId, responseText, existingCount, supplementCount);
}

function buildEndingGuidance(project, chapters, existingCount, supplementCount) {
    let endingGuidance = '';
    // Schema-First：通过归一化函数读取targetChapters，兼容targetChapterCount历史字段名
    const { normalizeTargetChapters } = require("../../config/targetChaptersNormalizer");
    const targetChapterCount = normalizeTargetChapters(project);
    const targetWordCount = project?.targetWordCount || null;
    const currentTotalWords = chapters.filter(c => c.content).reduce((sum, c) => sum + (c.content || '').length, 0);

    if (targetChapterCount) {
        const remaining = targetChapterCount - existingCount;
        if (remaining <= 0) return { endingGuidance, shouldStop: true, reason: '已达到目标章数' };
        if (remaining <= supplementCount) {
            endingGuidance += `\n\n【关键：即将完结】\n本批大纲是全书最后${remaining}章，必须规划大结局！`;
        } else if (remaining <= supplementCount * 2) {
            endingGuidance += `\n\n【注意：接近完结】\n距离目标${targetChapterCount}章还剩约${remaining}章，开始收束剧情`;
        }
    }
    if (targetWordCount) {
        const remainingWords = targetWordCount - currentTotalWords;
        if (remainingWords <= 0) return { endingGuidance, shouldStop: true, reason: '已达到目标字数' };
        const avgWords = existingCount > 0 ? Math.round(currentTotalWords / existingCount) : 3000;
        const estimatedRemaining = Math.ceil(remainingWords / avgWords);
        if (estimatedRemaining <= supplementCount) {
            endingGuidance += `\n\n【字数目标：即将完结】\n当前总字数${currentTotalWords}，目标${targetWordCount}`;
        }
    }
    return { endingGuidance, shouldStop: false };
}

function buildRecentChaptersSummary(chapters, isVolumeComplete) {
    if (isVolumeComplete) {
        return chapters.slice(-3).map(ch => `第${ch.chapterNumber}章 ${ch.title} [${ch.scene || '主世界'}]`).join('\n') + '\n（以上为上一卷末尾章节，本卷从主世界重新开始）';
    }
    return chapters.slice(-5).map(ch => `第${ch.chapterNumber}章 ${ch.title}: ${(ch.outline || ch.content || '').substring(0, 200)}`).join('\n');
}

function maskLockedSubplanes(lockedSubNames, recentChaptersSummary, materialSummary, existingTitles, existingOutlineStarts) {
    for (const ln of lockedSubNames) {
        const escapedFull = ln.full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedShort = ln.short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        recentChaptersSummary = recentChaptersSummary.replace(new RegExp(escapedFull, 'g'), '[已锁定小世界]').replace(new RegExp(escapedShort, 'g'), '[已锁定小世界]');
        materialSummary = materialSummary.replace(new RegExp(escapedFull, 'g'), '[已锁定小世界]').replace(new RegExp(escapedShort, 'g'), '[已锁定小世界]');
    }
    return { recentChaptersSummary, materialSummary };
}

async function buildReaderAdvisorySection(projectId, existingCount) {
    try {
        const advisory = await getReaderAdvisory(projectId, existingCount + 1);
        const text = formatAdvisoryForOutline(advisory);
        return text ? `\n\n${text}` : '';
    } catch (_) { return ''; }
}

function buildPromptMessages(project, existingCount, supplementCount, titleRule, pacingRule, constraintRule, volumeRhythmGuidance, volumeTransitionGuidance, genreSection, styleSection, readerAdvisorySection, existingTitles, endingGuidance, retryHint, materialSummary, recentChaptersSummary) {
    return [
        {
            role: 'system',
            content: `你是一个小说章节大纲生成器。根据已有的素材库和已有章节，为小说补充新的章节大纲：\n\n已有${existingCount}章，需要再生成${supplementCount}章的后续大纲：\n\n【重要：标题命名规则】\n${titleRule}\n\n【重要：大纲节奏规则】\n${pacingRule}\n${constraintRule ? '\n【题材约束】\n' + constraintRule : ''}\n- 每章大纲必须有明确的剧情推进\n- 章末必须有钩子或悬念\n\n配角戏份：偶尔给配角高光时刻，情感线自然推进。\n${volumeRhythmGuidance}${volumeTransitionGuidance}${genreSection}${styleSection}${readerAdvisorySection}\n【重要：去重规则】\n- 新章节标题不能与已有标题重复\n- 新章节大纲不能与已有大纲内容重复\n\n已有章节标题（禁止重复）${existingTitles.join('、')}${endingGuidance}${retryHint ? `\n\n【⚠️ 重试提示】\n${retryHint}` : ''}\n\n输出JSON数组格式：\n[\n  {"title": "章节标题", "outline": "章节大纲：200字以上，包含场景、人物、事件、伏笔安排"},\n  ...\n]`
        },
        {
            role: 'user',
            content: `小说名：${project.name}\n小说描述：${project.description || ''}\n\n【素材库摘要】\n${materialSummary}\n\n【最近章节】\n${recentChaptersSummary}\n\n请生成第${existingCount + 1}到第${existingCount + supplementCount}章的大纲。注意：标题和大纲不能与已有内容重复！`
        }
    ];
}

module.exports = { supplementChapterOutlines };
