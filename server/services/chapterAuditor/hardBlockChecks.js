const logger = require('../../shared/logger');
const { detectAdultPerspective, detectTechJargon, detectPipelineMetadataLeak, detectOnomatopoeiaDensity, detectVisualAnchors, detectMotherChildDialogue, detectModernSlang, detectTellVerbs, calcInfoDripScore, extractEndingTension, detectCrossChapterRepetition, scanSensitiveWords, validateTomatoMetrics } = require('../contentUtils');
const { resolveConfig } = require('../../config');
const { resolveGenreFromProject, detectGenre } = require('../genreConfig');

async function _runHardBlockChecks(content, styleProfile, project, projectId, store) {
    const issues = [];
    const genre = resolveGenreFromProject(project);
    const _auditConfig = resolveConfig(genre, project);

    try {
        const adultResult = detectAdultPerspective(content, styleProfile);
        if (adultResult.isAdultPerspective) {
            const criticals = adultResult.issues.filter(i => i.severity === 'critical');
            if (criticals.length > 0) issues.push(`视角违规(critical): ${criticals.map(i => i.desc).join('；')}`);
        }
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }

    try {
        const techResult = detectTechJargon(content, styleProfile);
        if (techResult.violationCount > 0 && genre?.id === 'baby') {
            const genreJargons = techResult.instances.filter(j => !j.allowable).map(j => `"${j.match}"`);
            if (genreJargons.length > 0) issues.push(`幼崽视角科技术语: ${genreJargons.join('、')}`);
        }
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }

    try {
        const leakResult = detectPipelineMetadataLeak(content);
        if (leakResult.hasLeak) issues.push(`流水线元数据泄露: ${leakResult.instances.map(i => i.match).join('、')}`);
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }

    try {
        const slangResult = detectModernSlang(content, styleProfile);
        if (slangResult.count > 0) issues.push(`网络用语: ${slangResult.instances.map(s => `"${s.match}"`).join('、')}`);
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }

    try {
        const sensitiveResult = scanSensitiveWords(content);
        if (sensitiveResult.blockCount > 0) issues.push(`敏感词(severity=block): ${sensitiveResult.instances.filter(i => i.severity === 'block').map(i => `"${i.match}"`).join('、')}`);
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }

    try {
        const chapters = await store.queryItems('chapters', c => c.projectId === projectId);
        const currentChapter = chapters.find(c => c.content === content || (c.content && content.includes(c.content.substring(0, 50))));
        if (currentChapter) {
            const prevChapter = chapters.find(c => c.chapterNumber === currentChapter.chapterNumber - 1);
            if (prevChapter?.content) {
                const crossRep = detectCrossChapterRepetition(content, prevChapter.content);
                if (crossRep.hasRepetition) issues.push(`跨章内容重复(${crossRep.instances?.length || 0}处)`);
            }
        }
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }

    try {
        const wc = content.replace(/\s/g, '').length;
        if (wc < _auditConfig.word.rejectMin) issues.push(`字数${wc}低于最低要求${_auditConfig.word.rejectMin}`);
        if (wc > _auditConfig.word.maxChapter) issues.push(`字数${wc}超出上限${_auditConfig.word.maxChapter}`);
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }

    // 陷阱#44: T0元约束检测——让约束词真正能阻断pipeline
    // 详见 SOP: docs/sop/08-约束执行规范.md 第六节
    try {
        const { runAllMetaConstraintDetections } = require('../prompts/constraintDetectionRegistry');
        const chapters = await store.queryItems('chapters', c => c.projectId === projectId);
        const sortedChapters = chapters.filter(c => c.content).sort((a, b) => b.chapterNumber - a.chapterNumber);
        const currentChapter = sortedChapters.find(c => c.content === content) || sortedChapters[0];
        const prevChapterContent = sortedChapters.find(c => c.chapterNumber === (currentChapter?.chapterNumber - 1))?.content || '';
        const recentChapterContents = sortedChapters
            .filter(c => c.chapterNumber < (currentChapter?.chapterNumber || 1))
            .slice(0, 5)
            .map(c => c.content);

        const materials = await store.queryItems('materials', m => m.projectId === projectId);
        const sideCharacterNames = materials
            .filter(m => m.type === 'character' && !(m.tags || []).includes('主角'))
            .map(m => m.name)
            .filter(Boolean);

        const metaResults = await runAllMetaConstraintDetections({
            content,
            chapterNumber: currentChapter?.chapterNumber || 1,
            prevChapterContent,
            recentChapterContents,
            sideCharacterNames,
        });

        for (const [id, result] of Object.entries(metaResults)) {
            if (result.violated && result.block !== false) {
                const topViolation = result.violations[0];
                issues.push(`T0元约束${id}违规: ${topViolation?.reason || '检测违规'} (实际${result.actual}/阈值${result.threshold})`);
            }
        }
    } catch (_) { logger.warn('hardBlockChecks', '[META-CONSTRAINT] ' + (_.message || _)); }

    return { blocked: issues.length > 0, issues };
}

async function _buildTechniqueHints(content, styleProfile, projectId, store) {
    const hints = [];
    // F6 修复（docs/worklog/2026-10-17-假成果审查-问题统计.md）：
    // 原首行 `const genre = detectGenre(styleProfile)` —— detectGenre 在本文件从未定义/导入，
    // 调用即抛 ReferenceError；且该行在 try 之外 → reviewChapter 必抛，"手动初审"全程走不完。
    // 改为经 project 解析题材（store 由调用方传入正是为此），并整段 try 兜底，保证本函数永不抛。
    let genre = null;
    try {
        const project = (projectId && store) ? await store.getItem('projects', projectId) : null;
        genre = resolveGenreFromProject(project) || (styleProfile ? detectGenre(styleProfile) : null);
    } catch (e) {
        logger.warn('hardBlockChecks', 'genre resolve fallback: ' + (e.message || e));
        genre = null;
    }
    try {
        const tellResult = detectTellVerbs(content);
        if (tellResult.count > 0) hints.push(`【展示代替告知检测】发现${tellResult.count}处告知式描写(density:${tellResult.density}/千字)，请检查是否需要转化为动作/生理/环境描写`);
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }
    try {
        const dripScore = calcInfoDripScore(content);
        if (dripScore < 0.4) hints.push(`【信息注入节奏检测】info_drip_score=${dripScore.toFixed(2)}(<0.4)，存在连续设定说明，建议将信息包裹在动作冲突/对话博弈中`);
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }
    try {
        const endingResult = extractEndingTension(content);
        if (!endingResult.hasTension) hints.push(`【章节收尾检测】末段缺乏张力点，请检查是否需要增加悬念/抉择/伏笔提及/关系转折`);
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }
    try {
        const slangResult = detectModernSlang(content, styleProfile);
        if (slangResult.count > 0) hints.push(`【🚨年代语言污染检测 - 严重违规】发现${slangResult.count}处网络用语/网文腔：${slangResult.instances.map(s => `"${s.match}"(${s.type})`).join('、')}。必须全部替换`);
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }
    try {
        const adultResult = detectAdultPerspective(content, styleProfile);
        if (adultResult.isAdultPerspective) {
            const criticalDescs = adultResult.issues.filter(i => i.severity === 'critical').map(i => i.desc);
            const highDescs = adultResult.issues.filter(i => i.severity === 'high').map(i => i.desc);
            if (criticalDescs.length > 0) {
                const perspectiveDesc = genre?.id === 'baby' ? `幼崽角色出现成人化内心：${criticalDescs.join('；')}。必须重写为幼崽视角/幼崽行为驱动` : `视角违规：${criticalDescs.join('；')}`;
                hints.push(`【🚨视角违规检测 - 严重违规】${perspectiveDesc}`);
            }
            if (highDescs.length > 0) hints.push(`【⚠️视角偏移检测 - 需调整】${highDescs.join('；')}`);
        }
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }
    try {
        const techJargonResult = detectTechJargon(content, styleProfile);
        if (techJargonResult.violationCount > 0) {
            const genreJargons = techJargonResult.instances.filter(j => !j.allowable).map(j => `"${j.match}"(${j.perspective}视角)→"${j.suggestion}"`).join('、');
            const perspectiveLabel = genre?.id === 'baby' ? '幼崽视角' : '角色视角';
            hints.push(`【🚨科技术语检测 - ${perspectiveLabel}违规】发现${techJargonResult.violationCount}处${perspectiveLabel}中的科技术语：${genreJargons}。必须替换为感官隐喻`);
        }
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }
    try {
        const chapters = await store.queryItems('chapters', c => c.projectId === projectId);
        const currentChapter = chapters.find(c => c.content === content || (c.content && content.includes(c.content.substring(0, 50))));
        if (currentChapter) {
            const prevChapter = chapters.find(c => c.chapterNumber === currentChapter.chapterNumber - 1);
            if (prevChapter?.content) {
                const crossChapterResult = detectCrossChapterRepetition(content, prevChapter.content);
                if (crossChapterResult.hasRepetition) hints.push(`【跨章相似提示】与上一章存在${crossChapterResult.repeatedCount}处高度相似段落`);
            }
        }
    } catch (_) { logger.warn('hardBlockChecks', _.message || _); }
    return hints.length > 0 ? hints.join('\n') : '';
}

module.exports = { _runHardBlockChecks, _buildTechniqueHints };
