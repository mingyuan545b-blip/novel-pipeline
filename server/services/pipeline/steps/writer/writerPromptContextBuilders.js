/**
 * writerPromptContextBuilders.js — writer prompt 上下文构建函数集
 *
 * 从 writerPromptBuilder.js 拆分而来，遵循200行单文件硬限制
 * 包含：叙事桥梁/时间线/伏笔/角色活动/角色状态摘要/守卫提示 等上下文构建函数
 */
const logger = require('../../../../shared/logger');
const { STATUS_VALUES } = require('../../../chapterStatus');

async function _buildNarrativeBridge(ctx, chapter) {
    const skippedChapters = await ctx.getSkippedChapters(chapter.chapterNumber);
    if (skippedChapters.length === 0) return '';
    const bridgeMats = await ctx.getNarrativeBridgeMaterials();
    if (bridgeMats.length === 0) return '';
    let section = '\n\n【⚠️ 叙事断裂提醒 - 以下章节被跳过，必须在正文中自然过渡】\n';
    for (const bm of bridgeMats) {
        const bridgeContent = bm.currentContent || bm.initialContent || '';
        try {
            const parsed = JSON.parse(bridgeContent);
            section += `\n--- 跳过章节：第${parsed.skippedChapter}章《${parsed.title}》---\n跳过原因：${parsed.reason}\n大纲概要：${parsed.outline || '无'}\n内容摘要：${parsed.contentSummary || '无'}\n关键事件：${parsed.keyEvents || '无'}\n衔接指导：${parsed.narrativeBridge || '无'}\n`;
        } catch (_) { section += `\n${bridgeContent}\n`; }
    }
    section += '\n【衔接规则】1.必须在本章前1/3处通过角色回忆/对话/场景暗示提及跳过章节的关键信息 2.不能假装跳过章节的事件没发生过 3.角色状态必须与跳过章节的结局一致';
    return section;
}

async function _buildTimeline(ctx, chapter) {
    try {
        const timelineSummary = await ctx.getTimelineSummary(chapter.chapterNumber, 5, 800);
        if (timelineSummary) return `\n\n${timelineSummary}\n【时间线规则】本章事件必须与前章时间线保持连贯，不得出现时间矛盾。主线时间线事件必须延续推进，不得遗忘或跳过。`;
    } catch (_) { logger.warn('writerPrompt', _.message || _); }  // DEGRADE: 影响=ctx.getTimelineSummary 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return '';
}

async function _buildForeshadow(ctx, chapter) {
    try {
        const foreshadowHint = await ctx.getForeshadowHint(chapter.chapterNumber);
        if (foreshadowHint) return `\n\n${foreshadowHint}\n【伏笔规则】必须尊重已有伏笔状态，不得遗忘或矛盾。超期伏笔优先推进。`;
    } catch (_) { logger.warn('writerPrompt', _.message || _); }  // DEGRADE: 影响=ctx.getForeshadowHint 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return '';
}

async function _buildCharacterActivity(ctx, chapter) {
    try {
        const activityHint = await ctx.getCharacterActivityHint(chapter.chapterNumber);
        if (activityHint) return `\n\n${activityHint}`;
    } catch (_) { logger.warn('writerPrompt', _.message || _); }  // DEGRADE: 影响=ctx.getCharacterActivityHint 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return '';
}

/** 方案C：构建角色状态摘要（按出场过滤+深度分级）
 *  利用L0-L4深度分级系统：
 *  - 使用brief summary（L2摘要，只含热点角色+重要字段，有maxChars限制）
 *  - 不使用detailed summary（全量角色+全字段，会导致prompt膨胀）
 */
async function _buildCharacterStateSummary(projectId, chapter, styleProfile) {
    try {
        const stateKVIndex = require('../../../../services/stateKVIndex');
        const { detectGenre } = require('../../../../services/genreConfig');
        const genreObj = detectGenre(styleProfile || {});
        const genreId = genreObj?.id || null;
        const chapterNum = chapter?.chapterNumber || 1;

        // 使用brief summary（L2摘要，只含热点角色+重要字段，maxChars限制）
        const maxChars = 1500;
        const summary = await stateKVIndex.generateBriefSummary(projectId, chapterNum, genreId, maxChars);
        if (!summary || summary === '无热点角色状态') return '';
        return `\n\n【📊 角色状态摘要 - 必须严格继承，禁止状态倒退】\n以下是热点角色截至上一章的累积状态，本章必须在此基础上延续：\n${summary}\n【状态继承规则】\n1. 石化/伤势/中毒等负面状态只能恶化或维持，不能无故消失\n2. 境界/战力/技能等正面状态只能提升或维持，不能倒退\n3. 装备/法宝等持有物只能增加或消耗，不能凭空出现或消失\n4. 如需改变状态，必须有明确的剧情事件驱动`;
    } catch (err) {
        logger.warn('writerPrompt', 'Failed to build character state summary:', err.message);
        return '';
    }
}

/** 断点1修复：构建守卫提示（按场景过滤，避免无关提示膨胀prompt）
 *  场景过滤规则：
 *  - 战力守卫：仅战斗场景注入
 *  - 伏笔检查：仅涉及伏笔的章节注入
 *  - 角色弧线：仅角色发展章节注入
 *  - 时间线矛盾/长线审计/跨章重复/任务系统：所有章节都注入（基础约束）
 */
async function _buildGuardHints(ctx, chapter, outlineText) {
    const chapterNum = chapter?.chapterNumber || 1;
    const sections = [];
    const outlineLower = (outlineText || '').toLowerCase();

    // 检测场景类型
    const isCombatScene = /战斗|打斗|对决|厮杀|交手|出手|攻击|防御|战力|境界|法术|符咒/.test(outlineLower);
    const hasForeshadowMention = /伏笔|悬念|线索|秘密|真相|谜团/.test(outlineLower);
    const isCharacterDevelopment = /突破|成长|转变|觉醒|蜕变|心境|感悟/.test(outlineLower);

    // 0. 任务系统提示（所有章节都注入，主线必须推进）
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
            sections.push(`【📜 任务系统提示 - 主线必须推进，支线可穿插】\n${questText}`);
        }
    } catch (e) { logger.warn('writerPrompt', 'quests hint:', e.message); }  // DEGRADE: 影响=写手上下文构建 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    // 1. 战力守卫提示（仅战斗场景注入）
    if (isCombatScene) {
        try {
            const hint = await ctx.getPowerCheckHint(chapterNum);
            if (hint) sections.push(`【⚔️ 战力守卫提示 - 必须遵守战力边界】\n${hint}`);
        } catch (e) { logger.warn('writerPrompt', 'power guard hint:', e.message); }  // DEGRADE: 影响=ctx.getPowerCheckHint 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }

    // 2. 伏笔检查提示（仅涉及伏笔的章节注入）
    if (hasForeshadowMention) {
        try {
            const hint = await ctx.getForeshadowCheckHint(chapterNum);
            if (hint) sections.push(`【📌 伏笔状态提示 - 禁止重复埋设已回收伏笔】\n${hint}`);
        } catch (e) { logger.warn('writerPrompt', 'foreshadow guard hint:', e.message); }  // DEGRADE: 影响=ctx.getForeshadowCheckHint 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }

    // 3. 角色弧线守卫提示（仅角色发展章节注入）
    if (isCharacterDevelopment) {
        try {
            const hint = await ctx.getCharacterArcCheckHint(chapterNum);
            if (hint) sections.push(`【🎭 角色弧线提示 - 必须符合角色发展轨迹】\n${hint}`);
        } catch (e) { logger.warn('writerPrompt', 'character arc hint:', e.message); }  // DEGRADE: 影响=ctx.getCharacterArcCheckHint 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }

    // 4. 时间线矛盾检测（所有章节都注入，基础约束）
    try {
        const conflicts = await ctx.detectTimelineConflicts(chapterNum);
        if (conflicts && conflicts.length > 0) {
            const conflictText = conflicts.map(c => `  - ${c.description || c.message || JSON.stringify(c)}`).join('\n');
            sections.push(`【⏰ 时间线矛盾警告 - 必须避免以下矛盾】\n${conflictText}`);
        }
    } catch (e) { logger.warn('writerPrompt', 'timeline conflict:', e.message); }  // DEGRADE: 影响=ctx.detectTimelineConflicts 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    // 5. 长线审计（仅当shouldRunAudit返回true时执行，通常每5章一次）
    try {
        if (ctx.shouldRunAudit(chapterNum)) {
            const report = await ctx.runFullAudit(chapterNum);
            if (report && !report.summary?.passed) {
                const { consistencyAuditService } = require('../../../../services/consistencyAuditService');
                const text = consistencyAuditService.formatAuditReport(report);
                if (text) sections.push(`【🔍 长线一致性审计 - 必须修复以下问题】\n${text}`);
            }
        }
    } catch (e) { logger.warn('writerPrompt', 'full audit:', e.message); }  // DEGRADE: 影响=if 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    // 6. 跨章重复检测（所有章节都注入，基础约束）
    try {
        const allChapters = await ctx.getChapters();
        const prevChapter = allChapters
            .filter(c => c.chapterNumber === chapterNum - 1 && c.content && (c.status === STATUS_VALUES.MATERIAL_UPDATED || c.status === STATUS_VALUES.APPROVED))
            .sort((a, b) => b.chapterNumber - a.chapterNumber)[0];
        if (prevChapter) {
            const { detectCrossChapterRepetition } = require('../review/reviewShared');
            const result = detectCrossChapterRepetition(chapter.content || '', prevChapter.content);
            if (result.hasRepetition) {
                sections.push(`【🔁 跨章重复警告 - 禁止逐字复制上一章内容】\n与上一章存在${result.repeatedCount}处相似段落(重叠率${(result.overlapScore * 100).toFixed(0)}%)，必须改写或删除`);
            }
        }
    } catch (e) { logger.warn('writerPrompt', 'cross chapter repetition:', e.message); }  // DEGRADE: 影响=ctx.getChapters 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    if (sections.length === 0) return '';
    return `\n\n【🛡️ 审核守卫提示 - 创作时必须遵守，违反将被退回】\n${sections.join('\n\n')}`;
}

module.exports = {
    _buildNarrativeBridge,
    _buildTimeline,
    _buildForeshadow,
    _buildCharacterActivity,
    _buildCharacterStateSummary,
    _buildGuardHints
};
