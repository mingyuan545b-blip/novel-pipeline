const logger = require('../../shared/logger');
const store = require('../../store');
const { detectAdultPerspective, detectTechJargon, detectPipelineMetadataLeak, detectOnomatopoeiaDensity, detectVisualAnchors, detectMotherChildDialogue, detectModernSlang, detectTellVerbs, calcInfoDripScore, extractEndingTension, detectCrossChapterRepetition, scanSensitiveWords } = require('../contentUtils');
const { resolveConfig } = require('../../config');
const { resolveGenreFromProject } = require('../genreConfig');

async function auditChapter(projectId, project, styleProfile, genre, chapterId) {
    const chapter = await store.getItem('chapters', chapterId);
    if (!chapter) return { error: '章节不存在' };
    const content = chapter.content || '';
    if (!content || content.replace(/\s/g, '').length < 100) return { chapterNumber: chapter.chapterNumber, violations: [], clean: true };
    const violations = [];
    const _genreQualityChecks = genre?.qualityChecks || {};

    const adult = detectAdultPerspective(content, styleProfile);
    for (const issue of adult.issues) {
        if (issue.desc && issue.desc.includes('全知旁白')) { violations.push({ type: 'omniscient', severity: 'critical', desc: issue.desc, category: '全知旁白' }); }
        else if (issue.severity === 'critical') { violations.push({ type: 'adultPerspective', severity: 'critical', desc: issue.desc, category: '视角越界' }); }
        else if (issue.severity === 'high') { violations.push({ type: 'adultPerspective', severity: 'critical', desc: issue.desc, category: '视角越界' }); }
    }

    const meta = detectPipelineMetadataLeak(content, styleProfile);
    for (const inst of (meta.instances || [])) {
        if (inst.type === '打破第四面墙' && !inst.allowable) { violations.push({ type: 'fourthWall', severity: 'critical', desc: `打破第四面墙："${inst.match}"→"${inst.suggestion}"`, category: '打破第四面墙', match: inst.match, suggestion: inst.suggestion }); }
        else if (!inst.allowable) { violations.push({ type: 'metadataLeak', severity: 'critical', desc: `系统机制直述："${inst.match}"→"${inst.suggestion}"`, category: '系统机制直述' }); }
    }

    const tech = detectTechJargon(content, styleProfile);
    const genreJargons = (tech.instances || []).filter(j => !j.allowable);
    if (genreJargons.length > 0 && _genreQualityChecks.terminology?.enabled !== false) {
        violations.push({ type: 'techJargon', severity: 'critical', desc: `题材术语未降维(${genreJargons.length}处)：${genreJargons.slice(0, 5).map(j => `"${j.match}"→"${j.suggestion}"`).join('、')}`, category: '系统机制直述', jargons: genreJargons.map(j => ({ match: j.match, suggestion: j.suggestion, perspective: j.perspective })) });
    }

    const slang = detectModernSlang(content, styleProfile);
    if (slang.count > 0) violations.push({ type: 'slang', severity: 'high', desc: `网络用语/网文腔(${slang.count}处)：${slang.instances.slice(0, 3).map(s => s.match).join('、')}`, category: '网络用语' });

    const ono = detectOnomatopoeiaDensity(content, styleProfile);
    if (ono.issues && ono.issues.length > 0 && _genreQualityChecks.onomatopoeia?.enabled) violations.push({ type: 'noOnomatopoeia', severity: ono.issues[0].severity, desc: ono.issues[0].desc, category: '拟声词不足', count: ono.count });

    const mc = detectMotherChildDialogue(content, styleProfile);
    if (mc.issues && mc.issues.length > 0 && _genreQualityChecks.motherChildDialogue?.enabled) violations.push({ type: 'noDialogue', severity: mc.issues[0].severity, desc: mc.issues[0].desc, category: '对话不足', count: mc.count });

    const vis = detectVisualAnchors(content, styleProfile);
    if (vis.issues && vis.issues.length > 0) violations.push({ type: 'noVisualAnchor', severity: vis.issues[0].severity, desc: vis.issues[0].desc, category: '视觉锚点不足', count: vis.count });

    try { const tellVerbs = detectTellVerbs(content); if (tellVerbs.count > 5) violations.push({ type: 'tellVerbs', severity: 'medium', desc: `告知式动词过多(${tellVerbs.count}处)，建议改为感官描写`, category: '告知式描写' }); } catch (_) { logger.warn('auditMethods', '[audit-methods]', _.message || _); }  // DEGRADE: 影响=detectTellVerbs 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    try { const infoDrip = calcInfoDripScore(content); if (infoDrip.score < 0.4) violations.push({ type: 'infoDump', severity: 'medium', desc: `设定说明堆砌(节奏分${infoDrip.score.toFixed(1)}，目标≥0.4)`, category: '设定堆砌' }); } catch (_) { logger.warn('auditMethods', '[audit-methods]', _.message || _); }  // DEGRADE: 影响=calcInfoDripScore 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    try { const ending = extractEndingTension(content); if (!ending.hasTension) violations.push({ type: 'noTension', severity: 'medium', desc: '章节收尾缺乏张力/悬念钩子', category: '收尾张力不足' }); } catch (_) { logger.warn('auditMethods', '[audit-methods]', _.message || _); }  // DEGRADE: 影响=extractEndingTension 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    try {
        const chapters = (await store.queryItems('chapters')).filter(c => c.projectId === projectId);
        const prevChapter = chapters.find(c => c.chapterNumber === chapter.chapterNumber - 1);
        if (prevChapter?.content) { const crossRep = detectCrossChapterRepetition(content, prevChapter.content); if (crossRep.hasRepetition) violations.push({ type: 'crossChapterRep', severity: 'high', desc: `与上一章内容重复(${crossRep.instances?.length || 0}处)`, category: '跨章重复' }); }
    } catch (_) { logger.warn('auditMethods', '[audit-methods]', _.message || _); }  // DEGRADE: 影响=store.queryItems 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    try { const sensitive = scanSensitiveWords(content); const blocks = (sensitive.instances || []).filter(i => i.severity === 'block'); if (blocks.length > 0) violations.push({ type: 'sensitiveWords', severity: 'critical', desc: `敏感词(${blocks.length}处): ${blocks.slice(0, 3).map(i => `"${i.match}"`).join('、')}`, category: '敏感词' }); } catch (_) { logger.warn('auditMethods', '[audit-methods]', _.message || _); }  // DEGRADE: 影响=scanSensitiveWords 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    const _auditConfig = resolveConfig(resolveGenreFromProject(project), project);
    const wc = content.replace(/\s/g, '').length;
    if (wc < _auditConfig.word.rejectMin) violations.push({ type: 'wordCountTooLow', severity: 'critical', desc: `字数${wc}低于最低要求${_auditConfig.word.rejectMin}字，还差${_auditConfig.word.rejectMin - wc}字`, category: '字数不足', current: wc, target: _auditConfig.word.rejectMin, gap: _auditConfig.word.rejectMin - wc });
    if (wc > _auditConfig.word.maxChapter) violations.push({ type: 'wordCountTooHigh', severity: 'high', desc: `字数${wc}超出上限${_auditConfig.word.maxChapter}字，超出${wc - _auditConfig.word.maxChapter}字`, category: '字数超标', current: wc, target: _auditConfig.word.maxChapter, gap: wc - _auditConfig.word.maxChapter });

    if (chapter.title && chapter.title.includes('小满版') && genre?.id === 'baby') violations.push({ type: 'titleSuffix', severity: 'medium', desc: '标题含"·小满版"后缀', category: '标题格式' });
    if (chapter.title && genre?.id === 'baby') {
        const techTitlePattern = /.{2,10}(与|和).{2,10}的.{2,12}(阀|舱|器|系统|装置|模块|层|网|栅|枢|匣|桥|阵|膜|筒|管|环|计|穹|帐|藤|盘|闸|桩|槽|廊|界|床|弦|台|笛|堤|阈|壁|带|阱|脊|幕|帷|庭|腔|渠|坝|巢|茧|枕|毯|垫|堰|屏|囊|脉|泵|隙|结)$/;
        if (techTitlePattern.test(chapter.title)) violations.push({ type: 'techTitle', severity: 'high', desc: `标题风格偏技术说明书："${chapter.title}"，应改为诗情画意的感官意象命名`, category: '标题风格' });
    }

    const result = { chapterId: chapter.id, chapterNumber: chapter.chapterNumber, title: chapter.title, wordCount: wc, violations, criticalCount: violations.filter(v => v.severity === 'critical').length, highCount: violations.filter(v => v.severity === 'high').length, clean: violations.length === 0, auditedAt: new Date().toISOString() };
    store.setItem('chapter-audits', chapter.id, result);
    return result;
}

async function auditAll(projectId) {
    const chapters = (await store.queryItems('chapters')).filter(c => c.projectId === projectId && !c.archived && c.content).sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    const results = [];
    const summary = { total: chapters.length, clean: 0, withViolations: 0, critical: 0, types: {} };
    for (const ch of chapters) {
        const result = await auditChapter(projectId, null, null, null, ch.id);
        results.push(result);
        if (result.clean) summary.clean++; else summary.withViolations++;
        if (result.criticalCount > 0) summary.critical++;
        for (const v of result.violations) summary.types[v.type] = (summary.types[v.type] || 0) + 1;
    }
    return { summary, results, auditedAt: new Date().toISOString() };
}

async function getAudit(projectId, chapterId) {
    const cached = await store.getItem('chapter-audits', chapterId);
    if (cached) return cached;
    return auditChapter(projectId, null, null, null, chapterId);
}

async function getViolationsByType(projectId, type) {
    const chapters = (await store.queryItems('chapters')).filter(c => c.projectId === projectId && !c.archived && c.content);
    const results = [];
    for (const ch of chapters) {
        const audit = await getAudit(projectId, ch.id);
        const matching = audit.violations?.filter(v => v.type === type) || [];
        if (matching.length > 0) results.push({ chapterNumber: ch.chapterNumber, chapterId: ch.id, title: ch.title, violations: matching });
    }
    return results;
}

module.exports = { auditChapter, auditAll, getAudit, getViolationsByType };
