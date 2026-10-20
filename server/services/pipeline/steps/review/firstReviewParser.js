/**
 * firstReviewParser.js — 初审结果解析与保存
 *
 * 从 firstReview.js 拆出，负责：
 * - parseAndSaveReview: JSON解析+自动纠正+软硬分离+保存reviews表
 * - fallbackMarkdownReview: JSON解析失败时降级到Markdown解析
 * - buildWriterConstraints: 构建4种创作约束（任务系统/角色状态/关系阶段/叙事桥接/上一季结局）
 */
const logger = require('../../../../shared/logger');
const { uuidv4, store, extractJSON, getMetrics } = require('./reviewShared');
const { autoCorrectContradiction, separateSoftFromHard, hasCriticalBlocker } = require('./reviewSoftHardSeparator');

/**
 * 解析初审结果并保存到reviews表
 * @returns {Object|null} 返回未通过结果对象，通过时返回null（由主流程继续处理hardBlock）
 */
async function parseAndSaveReview(result, chapter, chapterId, projectId, round, ctx) {
    try {
        const parsed = extractJSON(result.response);
        if (!parsed) throw new Error('JSON extraction failed');

        // 自动纠正：passed=false但summary正向时改为通过
        autoCorrectContradiction(parsed, 'firstReview');

        // 软硬分离：无critical硬伤时强制通过，软性issues降级为suggestions
        separateSoftFromHard(parsed, 'firstReview');

        const revId = uuidv4();
        await store.setItem('reviews', revId, {
            id: revId, chapterId, projectId, step: 'first-review', type: 'first-review',
            reviewer: 'first-review-agent', result: parsed, passed: !!parsed.passed,
            content: parsed.summary, issues: parsed.issues || [], suggestions: parsed.suggestions || [],
            round, createdAt: new Date().toISOString()
        });

        if (!parsed.passed) {
            try { getMetrics(projectId).recordAgentPassRate('first-review', false, chapter.chapterNumber); } catch (e) { logger.warn('firstReview', e.message || e); }  // DEGRADE: 影响=getMetrics 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
            if (hasCriticalBlocker(parsed)) parsed._criticalBlocker = true;
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
            return { step: 'first-review', result, passed: false, feedback: parsed, chapter };
        }
    } catch (e) {
        return await fallbackMarkdownReview(result, chapter, chapterId, projectId, round);
    }
    return null;
}

/** JSON解析失败时降级到Markdown解析 */
async function fallbackMarkdownReview(result, chapter, chapterId, projectId, round) {
    logger.warn('firstReview', 'first-review JSON parse failed, fallback to markdown');
    const text = result.response || '';
    const criticalSection = text.match(/严重问题[\s\S]{0,200}/)?.[0] || '';
    const criticalIsEmpty = /严重问题\s*\n\s*(?:\*\*无\*\*|无[。，.]|没有|不存在|无严重问题)/.test(criticalSection);
    const hasCriticalIssues = !criticalIsEmpty && /严重问题[^]*?(?:设定矛盾|逻辑错误|重大缺陷|❌|⚠️|矛盾|不一致|冲突|断裂)/.test(criticalSection);
    const fallbackPassed = !hasCriticalIssues;
    const fallbackFeedback = {
        passed: fallbackPassed,
        summary: hasCriticalIssues ? '初审发现严重问题（Markdown格式）' : '初审通过（Markdown格式）',
        issues: hasCriticalIssues ? [{ description: '审核返回Markdown格式，检测到严重问题', severity: 'high' }] : [],
        suggestions: []
    };
    const revId = uuidv4();
    await store.setItem('reviews', revId, {
        id: revId, chapterId, projectId, step: 'first-review', type: 'first-review',
        reviewer: 'first-review-agent', result: fallbackFeedback, passed: fallbackPassed,
        content: fallbackFeedback.summary, issues: fallbackFeedback.issues, suggestions: [],
        round, createdAt: new Date().toISOString()
    });
    if (!fallbackPassed) {
        try { getMetrics(projectId).recordAgentPassRate('first-review', false, chapter.chapterNumber); } catch (e) { logger.warn('firstReview', e.message || e); }  // DEGRADE: 影响=getMetrics 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
        if (hasCriticalIssues) fallbackFeedback._criticalBlocker = true;
        chapter.updatedAt = new Date().toISOString();
        await store.setItem('chapters', chapterId, chapter);
        return { step: 'first-review', result, passed: false, feedback: fallbackFeedback, chapter };
    }
    return null;
}

/** 断点2修复：构建4种创作约束（让审核标准与创作约束一致） */
async function buildWriterConstraints(ctx, projectId, chapter, project) {
    const sections = [];
    const chapterNum = chapter?.chapterNumber || 1;

    // 0. 任务系统状态（审核员需要知道主线/支线任务，才能判断是否偏离）
    try {
        const quests = await ctx.getQuests();
        const activeQuests = quests.filter(q => q.status === 'active' || q.status === 'in_progress');
        const mainQuests = activeQuests.filter(q => q.type === 'main' || !q.type);
        const sideQuests = activeQuests.filter(q => q.type === 'side');
        if (mainQuests.length > 0 || sideQuests.length > 0) {
            let questText = '';
            if (mainQuests.length > 0) {
                questText += `【主线任务 - 必须推进】\n${mainQuests.map(q => `  - ${q.title || q.name}: ${q.description || q.objective || ''}（进度: ${q.progress || 0}%）`).join('\n')}`;
            }
            if (sideQuests.length > 0) {
                if (questText) questText += '\n';
                questText += `【支线任务 - 可穿插】\n${sideQuests.map(q => `  - ${q.title || q.name}: ${q.description || q.objective || ''}（进度: ${q.progress || 0}%）`).join('\n')}`;
            }
            sections.push(`【📜 任务系统约束（审核依据——判断主线偏离）】\n${questText}\n审核规则：如发现正文完全偏离主线任务（如主线是寻宝，正文却在谈恋爱且无关联），判定为high`);
        }
    } catch (e) { logger.warn('firstReview', 'writer constraints quests:', e.message); }  // DEGRADE: 影响=初审结果解析 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    // 1. 角色动态状态全量快照（审核员需要知道状态继承规则，才能判断状态倒退）
    try {
        const stateKVIndex = require('../../../../services/stateKVIndex');
        const { detectGenre } = require('../../../../services/genreConfig');
        const genreObj = detectGenre(project?.styleProfile || {});
        const genreId = genreObj?.id || null;
        const summary = await stateKVIndex.generateDetailedSummary(projectId, chapterNum, genreId);
        if (summary && summary !== '无角色状态数据') {
            sections.push(`【📊 角色状态继承约束（审核依据——判断状态倒退）】\n以下是writer看到的角色状态全量快照，正文必须在此基础上延续：\n${summary}\n审核规则：石化/伤势/中毒等负面状态只能恶化或维持，境界/战力等正面状态只能提升或维持。如发现状态倒退（如石化进度变小、伤势无故消失），判定为critical`);
        }
    } catch (e) { logger.warn('firstReview', 'writer constraints state:', e.message); }  // DEGRADE: 影响=require 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    // 2. 关系阶段守卫（审核员需要知道关系阶段铁律，才能判断关系越级）
    try {
        const { buildRelationshipStageGuard } = require('../../relationshipStageGuard');
        const guard = await buildRelationshipStageGuard(projectId, chapterNum);
        if (guard) {
            sections.push(`【🔗 关系阶段守卫（审核依据——判断关系越级）】\n以下是writer看到的关系阶段铁律，正文必须遵守：\n${guard}\n审核规则：如发现关系越级（如仇人突然变挚友、陌生人突然表白），判定为critical`);
        }
    } catch (e) { logger.warn('firstReview', 'writer constraints relationship:', e.message); }  // DEGRADE: 影响=require 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    // 3. 叙事桥接（审核员需要知道跳章衔接要求，才能判断衔接质量）
    try {
        const skipped = await ctx.getSkippedChapters(chapterNum);
        if (skipped && skipped.length > 0) {
            const bridgeMaterials = await ctx.getNarrativeBridgeMaterials(chapterNum);
            sections.push(`【🌉 叙事桥接约束（审核依据——判断跳章衔接）】\n本章跳过了章节：${skipped.join('、')}\nwriter需要衔接这些跳过章节的事件。\n审核规则：如发现跳过章节的事件未被提及或衔接断裂，判定为high`);
        }
    } catch (e) { logger.warn('firstReview', 'writer constraints bridge:', e.message); }  // DEGRADE: 影响=ctx.getSkippedChapters 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    // 4. 上一季结局（审核员需要知道跨季承接要求）
    try {
        const { getPreviousSeasonFinale } = require('../../../../services/projectService');
        const prevFinale = await getPreviousSeasonFinale(projectId);
        if (prevFinale) {
            sections.push(`【🎬 上一季结局约束（审核依据——判断跨季承接）】\n上一季结局：${prevFinale}\n审核规则：如发现与上一季结局矛盾（如已死角色复活、已销毁物品再现），判定为critical`);
        }
    } catch (e) { logger.warn('firstReview', 'writer constraints season:', e.message); }  // DEGRADE: 影响=require 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    if (sections.length === 0) return '';
    return `\n\n${sections.join('\n\n')}`;
}

module.exports = { parseAndSaveReview, fallbackMarkdownReview, buildWriterConstraints };
