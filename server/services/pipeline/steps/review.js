const { v4: uuidv4 } = require('uuid');
const store = require('../../../store');
const { getModeConfig, detectModernSlang, detectAdultPerspective, detectTechJargon, detectPipelineMetadataLeak, detectCrossChapterRepetition, detectOnomatopoeiaDensity, detectVisualAnchors, detectMotherChildDialogue, detectTellVerbs, calcInfoDripScore, extractEndingTension } = require('../../contentUtils');
const { extractJSON } = require('../../jsonUtils');
const { scanContent: scanSensitiveWords } = require('../../sensitiveWordGuard');
const { validateChapterContent, detectGenre, getGenreReviewRules, getGenrePerspectiveSchema, runGenreFirstReviewIntercept, runGenreSecondReviewIntercept } = require('../../genreConfig');
const { getMetrics } = require('../../metricsCollector');
const reviewRemediation = require('../../reviewRemediation');
const { ValidationEngine } = require('../../validationEngine');

async function handleFirstReview(params) {
    const { projectId, chapter, agentContext, runAgent, saveAgentOutput, round, roundFailed, allFeedbackParts, chapterId } = params;
    const project = store.getItem('projects', projectId);
    let firstReviewExtra = '';
    const projForReviewRules = store.getItem('projects', projectId);
    if (projForReviewRules?.reviewPromptAdditions?.length > 0) {
        const adjusterReviewRules = projForReviewRules.reviewPromptAdditions
            .filter(r => r.source === 'adjuster')
            .map((r, i) => `${i + 1}. ${r.rule}`)
            .join('\n');
        if (adjusterReviewRules) {
            firstReviewExtra = `\n\n【调整员追加审核规则 - 必须检查】\n${adjusterReviewRules}`;
        }
    }

    let writingTechniqueHints = '';
    try {
        const content = chapter.content || '';
        const tellResult = detectTellVerbs(content);
        if (tellResult.count > 0) {
            writingTechniqueHints += `\n【展示代替告知检测】发现${tellResult.count}处告知式描写(density:${tellResult.density}/千字)，请检查是否需要转化为动作/生理/环境描写`;
        }
        const dripScore = calcInfoDripScore(content);
        if (dripScore < 0.4) {
            writingTechniqueHints += `\n【信息注入节奏检测】info_drip_score=${dripScore.toFixed(2)}(<0.4)，存在连续设定说明，建议将信息包裹在动作冲突/对话博弈中`;
        }
        const endingResult = extractEndingTension(content);
        if (!endingResult.hasTension) {
            writingTechniqueHints += `\n【章节收尾检测】末段缺乏张力点，请检查是否需要增加悬念/抉择/伏笔提及/关系转折`;
        }
        const projectForStyle = store.getItem('projects', projectId);
        const styleProfile = projectForStyle?.styleProfile;
        const genreHints = runGenreFirstReviewIntercept(content, styleProfile, { scene: chapter.scene, outline: chapter.outline });
        if (genreHints.hints?.length > 0) {
            for (const hint of genreHints.hints) {
                writingTechniqueHints += '\n' + hint;
            }
        }
        try {
            const allChaptersForPrev = store.queryItems('chapters', { projectId });
            const prevChapter = allChaptersForPrev
                .filter(c => c.chapterNumber === chapter.chapterNumber - 1 && c.content && c.status === 'approved')
                .sort((a, b) => b.chapterNumber - a.chapterNumber)[0];
            if (prevChapter) {
                const crossChapterResult = detectCrossChapterRepetition(content, prevChapter.content);
                if (crossChapterResult.hasRepetition) {
                    writingTechniqueHints += `\n【跨章相似提示】与上一章存在${crossChapterResult.repeatedCount}处相似段落(重叠率${(crossChapterResult.overlapScore * 100).toFixed(0)}%)。注意：只有完全逐字粘贴才算major，相似描写只算minor。`;
                }
            }
        } catch (_crossErr) {}
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

    const _frStyleProfile = project?.styleProfile;
    const _frGenre = detectGenre(_frStyleProfile);
    const _reviewRules = getGenreReviewRules(_frGenre);
    const _firstReviewPerspectiveRule = _reviewRules?.firstReview?.perspectiveRule || '';
    const _firstReviewTerminologyRule = _reviewRules?.firstReview?.terminologyRule || '';
    const _firstReviewOutputRule = _reviewRules?.firstReview?.outputRule || '';
    const _frPerspectiveSchema = getGenrePerspectiveSchema(_frGenre);
    const _frPerspectiveField = _frPerspectiveSchema.fields;
    const _frPerspectiveLabel = _frPerspectiveSchema.label;

    agentContext.content = `【任务】你是初审员，请审核并与素材库比对，绝不输出小说正文。\n\n【正文（仅供审核）】\n系统实际字数：${chapter.wordCount || (chapter.content || '').length}字\n${(chapter.content || '').substring(0, 8000)}${reviewRemediation.getReviewPromptInjection(projectId)}${firstReviewExtra}${writingTechniqueHints}\n${_firstReviewPerspectiveRule ? '\n' + _firstReviewPerspectiveRule + '\n' : ''}${_firstReviewTerminologyRule ? '\n' + _firstReviewTerminologyRule + '\n' : ''}${_firstReviewOutputRule ? '\n' + _firstReviewOutputRule + '\n' : ''}\n【输出格式 - 极其重要】\n先输出可读的Markdown审核报告，再在末尾附上JSON数据块（系统需要解析JSON）。\n\nMarkdown报告格式：\n## 初审结果：✅通过 / ❌未通过\n**审核概要**：一句话总结\n### 问题列表\n1. **[critical] 问题类型** - 位置：第X段\n   - 原文：\"...\"\n   - ${_frPerspectiveLabel}\n   - 违规原因：...\n   - 修改建议：...\n   - 改写为：\"...\"\n### 建议\n- ...\n\n末尾附上JSON数据块：\n${'```'}json\n{"passed":true/false,"summary":"拒绝/通过原因概述","issues":[{"title":"问题类型","location":"问题所在位置","originalText":"原文语句",${_frPerspectiveField},"violationReason":"违反了什么规则","howToFix":"具体怎么改","targetText":"改写后的完整句子","severity":"critical/high/medium"}],"suggestions":[{"title":"建议标题","description":"具体操作步骤"}]}\n${'```'}`;
    const result = await runAgent('first-review', agentContext);
    chapter.firstReviewOutput = result.response;
    chapter.status = 'first-reviewing';
    saveAgentOutput(projectId, chapter, 'first-review', result.response);

    if (!result.response || result.response.trim().length === 0) {
        console.warn('[PIPELINE] first-review returned empty response - defaulting to NOT passed (safe strategy)');
        const revId1Empty = uuidv4();
        store.setItem('reviews', revId1Empty, { id: revId1Empty, chapterId, projectId, step: 'first-review', type: 'first-review', reviewer: 'first-review-agent', result: { passed: false, summary: '审核员返回空响应，默认未通过（安全策略）' }, passed: false, content: '审核员返回空响应，默认未通过（安全策略）', issues: [{ desc: '审核Agent返回空响应，无法确认内容质量', severity: 'critical' }], suggestions: ['请检查LLM API配置是否正常'], round, createdAt: new Date().toISOString() });
        try { getMetrics(projectId).recordAgentPassRate('first-review', false, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        return { step: 'first-review', result, passed: false, roundFailed: true, feedbackPart: '【初审空响应】审核Agent未返回有效结果，内容质量无法确认，需要重新审核。' };
    }

    try {
        const parsed = extractJSON(result.response);
        if (!parsed) throw new Error('JSON extraction failed');
        if (!parsed.passed && parsed.summary) {
            const positiveSignals = /符合核心规范|视角锁定|降维处理得当|悬念钩子有效|字数达标|整体质量|符合要求|通过|达标|合格|良好|优秀|无严重|无重大|无明显/;
            const negativeSignals = /严重问题|重大缺陷|设定冲突|逻辑断裂|角色崩坏|OOC|视角违规|术语违规|未降维|泄露|超标|不足/;
            const hasPositive = positiveSignals.test(parsed.summary);
            const hasNegative = negativeSignals.test(parsed.summary);
            const hasCriticalIssues = (parsed.issues || []).some(i => i.severity === 'critical' || i.severity === 'blocker');
            if (hasPositive && !hasNegative && !hasCriticalIssues) {
                console.log(`[PIPELINE] first-review contradiction detected: passed=false but summary is positive. Auto-correcting to passed=true. Summary: "${parsed.summary?.substring(0, 80)}"`);
                parsed.passed = true;
                parsed._autoCorrected = true;
            }
        }
        const revId1 = uuidv4();
        store.setItem('reviews', revId1, { id: revId1, chapterId, projectId, step: 'first-review', type: 'first-review', reviewer: 'first-review-agent', result: parsed, passed: !!parsed.passed, content: parsed.summary, issues: parsed.issues || [], suggestions: parsed.suggestions || [], round, createdAt: new Date().toISOString() });
        if (!parsed.passed) {
            try { getMetrics(projectId).recordAgentPassRate('first-review', false, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
            const hasCriticalBlocker = (parsed.issues || []).some(i => i.severity === 'critical' || i.severity === 'blocker' || /设定冲突|严重OOC|角色崩坏|世界观矛盾|战力崩坏|逻辑断裂/.test(i.description || i.title || ''));
            if (hasCriticalBlocker) { parsed._criticalBlocker = true; console.log(`[PIPELINE] first-review detected critical_blocker, skipping second-review`); }
            try { const ve = new ValidationEngine(); const techIssues = (parsed.issues || []).filter(i => /技法|手法|技巧|节奏|节拍/.test(i.description || i.title || '')); if (techIssues.length > 0 && projectId) { const proj = store.getItem('projects', projectId); const m = proj?.mode || 'novel'; const enabledTechs = ve.getEnabledTechniques(m, 'writer'); for (const tech of enabledTechs.slice(0, 3)) { ve.recordTechniqueResult(tech.id, false); } } } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
            chapter.updatedAt = new Date().toISOString();
            store.setItem('chapters', chapterId, chapter);
            return { step: 'first-review', result, passed: false, feedback: parsed };
        }
    } catch (e) {
        console.warn('[PIPELINE] first-review JSON parse failed, fallback to markdown analysis');
        const text = result.response || '';
        const criticalSection = text.match(/严重问题[\s\S]{0,200}/)?.[0] || '';
        const criticalIsEmpty = /严重问题\s*\n\s*(?:\*\*无\*\*|无[。，.]|没有|不存在|无严重问题)/.test(criticalSection);
        const hasCriticalIssues = !criticalIsEmpty && /严重问题[^]*?(?:设定矛盾|逻辑错误|重大缺陷|❌|⚠️|矛盾|不一致|冲突|断裂)/.test(criticalSection);
        const fallbackPassed = !hasCriticalIssues;
        const fallbackFeedback = { passed: fallbackPassed, summary: hasCriticalIssues ? '初审发现严重问题（Markdown格式）' : '初审通过（Markdown格式）', issues: hasCriticalIssues ? [{ description: '审核返回Markdown格式，检测到严重问题', severity: 'high' }] : [], suggestions: [] };
        const revId1b = uuidv4();
        store.setItem('reviews', revId1b, { id: revId1b, chapterId, projectId, step: 'first-review', type: 'first-review', reviewer: 'first-review-agent', result: fallbackFeedback, passed: fallbackPassed, content: fallbackFeedback.summary, issues: fallbackFeedback.issues, suggestions: [], round, createdAt: new Date().toISOString() });
        if (!fallbackPassed) {
            try { getMetrics(projectId).recordAgentPassRate('first-review', false, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
            if (hasCriticalIssues) { fallbackFeedback._criticalBlocker = true; }
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
            return { step: 'first-review', result, passed: false, feedback: fallbackFeedback };
        }
    }

    try {
        const _content = chapter.content || '';
        const _proj = store.getItem('projects', projectId);
        const _styleProfile = _proj?.styleProfile;
        const _slangCheck = detectModernSlang(_content, _styleProfile);
        const _adultCheck = detectAdultPerspective(_content, _styleProfile);
        const _techJargonCheck = detectTechJargon(_content, _styleProfile);
        const _metadataLeak = detectPipelineMetadataLeak(_content, _styleProfile);
        let _crossChapterRepetition = null;
        try { const _allChapters = store.queryItems('chapters', { projectId }); const _prevChapter = _allChapters.filter(c => c.chapterNumber === chapter.chapterNumber - 1 && c.content && c.status === 'approved').sort((a, b) => b.chapterNumber - a.chapterNumber)[0]; if (_prevChapter) { _crossChapterRepetition = detectCrossChapterRepetition(_content, _prevChapter.content); } } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        const _hasCrossChapterDup = _crossChapterRepetition && _crossChapterRepetition.hasRepetition;
        let _sensitiveBlock = false; let _sensitiveHits = [];
        try { const _scanResult = scanSensitiveWords(_content); const _blockHits = _scanResult.hits.filter(h => h.severity === 'block'); if (_blockHits.length > 0) { _sensitiveBlock = true; _sensitiveHits = _blockHits; } } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        let _wordCountBlock = false; let _wordCountBlockDetail = ''; let _wordCountMaxBlock = false; let _wordCountMaxDetail = '';
        try { const _wcProj = store.getItem('projects', projectId); const _wcMode = _wcProj?.mode || 'novel'; const _wcModeConfig = getModeConfig(_wcMode); const _wcRejectMin = (_wcProj?.wordConfig || {}).rejectMin || _wcModeConfig.REJECT_MIN_WORDS || 1800; const _wcMaxWords = (_wcProj?.wordConfig || {}).maxWords || _wcModeConfig.MAX_CHAPTER_WORDS || 3500; const _actualWc = (_content || '').replace(/\s/g, '').length; if (_actualWc < _wcRejectMin) { _wordCountBlock = true; _wordCountBlockDetail = `${_actualWc}字 < 最低${_wcRejectMin}字`; } if (_actualWc > _wcMaxWords) { _wordCountMaxBlock = true; _wordCountMaxDetail = `${_actualWc}字 > 上限${_wcMaxWords}字`; } } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        const hardBlockIssues = []; const warningIssues = [];
        const genreIntercept = runGenreFirstReviewIntercept(_content, _styleProfile, { scene: chapter.scene, outline: chapter.outline });
        if (genreIntercept.hardBlockIssues?.length > 0) hardBlockIssues.push(...genreIntercept.hardBlockIssues);
        if (genreIntercept.warningIssues?.length > 0) warningIssues.push(...genreIntercept.warningIssues);
        const contentNameValidation = validateChapterContent(_content, _styleProfile);
        if (contentNameValidation.errors.length > 0) { hardBlockIssues.push({ severity: 'critical', description: `命名规范违规：${contentNameValidation.errors.join('；')}`, title: '命名违规' }); }
        if (_metadataLeak.count > 0) { const notAllowable = _metadataLeak.instances.filter(l => !l.allowable); const allowable = _metadataLeak.instances.filter(l => l.allowable); if (notAllowable.length > 0) { const leakDetails = notAllowable.slice(0, 5).map(l => `"${l.match}"(${l.perspective || '未知'}视角)→"${l.suggestion}"`).join('、'); hardBlockIssues.push({ severity: 'critical', description: `管线元数据/专业术语泄露：发现${notAllowable.length}处非成人视角中的问题词汇(${leakDetails})，必须替换为故事内合理表达`, title: '管线元数据/专业术语泄露' }); } if (allowable.length > 0) { const allowDetails = allowable.slice(0, 3).map(l => `"${l.match}"(成人语境,合理)`).join('、'); warningIssues.push({ severity: 'low', description: `成人角色语境中的专业术语(${allowDetails})使用合理，仅供参考`, title: '成人语境专业术语(合理)' }); } }
        if (_hasCrossChapterDup) { const dupDetails = _crossChapterRepetition.details.slice(0, 3).map(d => `"${d.preview}..."(${d.overlapPercent}%重叠)`).join('、'); warningIssues.push({ severity: 'high', description: `跨章重复：与上一章存在${_crossChapterRepetition.repeatedCount}处高度相似段落(重叠率${(_crossChapterRepetition.overlapScore * 100).toFixed(0)}%)：${dupDetails}`, title: '跨章内容重复' }); }
        if (_sensitiveBlock) { const sensitiveDetails = _sensitiveHits.slice(0, 5).map(h => `"${h.word}"(${h.category})`).join('、'); hardBlockIssues.push({ severity: 'critical', description: `敏感词拦截：发现${_sensitiveHits.length}处block级敏感词(${sensitiveDetails})，必须替换`, title: '敏感词拦截' }); }
        if (_wordCountBlock) { hardBlockIssues.push({ severity: 'critical', description: `字数不达标：${_wordCountBlockDetail}，必须扩展内容`, title: '字数不达标' }); }
        if (_wordCountMaxBlock) { hardBlockIssues.push({ severity: 'critical', description: `字数超标：${_wordCountMaxDetail}，必须精简内容`, title: '字数超标' }); }
        if (hardBlockIssues.length > 0) {
            console.warn(`[PIPELINE] HARD BLOCK (critical): ${hardBlockIssues.map(i => i.title).join('; ')}`);
            try { getMetrics(projectId).recordAgentPassRate('first-review', false, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
            chapter.updatedAt = new Date().toISOString();
            store.setItem('chapters', chapterId, chapter);
            return { step: 'first-review', result, passed: false, feedback: { passed: false, summary: `硬性检测拦截：${hardBlockIssues.map(i => i.title).join('；')}`, issues: [...hardBlockIssues, ...warningIssues], suggestions: hardBlockIssues.map(i => ({ description: i.description })), _hardBlock: true } };
        } else if (warningIssues.length > 0) { console.warn(`[PIPELINE] SOFT WARNING (non-critical): ${warningIssues.map(i => i.title).join('; ')} — not blocking`); }
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    try { getMetrics(projectId).recordAgentPassRate('first-review', true, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    let passFeedback = { passed: true, summary: '初审通过', issues: [], suggestions: [] };
    try {
        const parsed = extractJSON(result.response);
        if (parsed) {
            passFeedback = { passed: true, summary: parsed.summary || '初审通过', issues: parsed.issues || [], suggestions: parsed.suggestions || [] };
        }
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    return { step: 'first-review', result, passed: true, feedback: passFeedback };
}

async function handleFastReview(params) {
    const { projectId, chapter, agentContext, runAgent, saveAgentOutput, round, mode, chapterId } = params;
    const _fastProj = store.getItem('projects', projectId);
    const _fastGenre = detectGenre(_fastProj?.styleProfile);
    const _fastPerspectiveSchema = getGenrePerspectiveSchema(_fastGenre);
    const _fastPerspectiveField = _fastPerspectiveSchema.fields;
    const fastReviewPrefix = mode === 'tomato-short' ? '【任务】你是快审员，只输出JSON审核结果，绝不输出小说正文。请按番茄爽文8维度快审：\n\n【正文（仅供审核）】\n系统实际字数：' + (chapter.wordCount || (chapter.content || '').length) + '字\n' : '【任务】你是快审员，请快审，绝不输出小说正文。\n\n【正文（仅供审核）】\n系统实际字数：' + (chapter.wordCount || (chapter.content || '').length) + '字\n';
    agentContext.content = `${fastReviewPrefix}${(chapter.content || '').substring(0, 6000)}${reviewRemediation.getReviewPromptInjection(projectId)}\n\n【审核输出要求】issues中每个问题必须包含完整修改指导，让返修员能直接按指导修改。\n\n【输出格式】先输出可读Markdown报告，末尾附JSON数据块：\n${'```'}json\n{"passed":true/false,"summary":"概述","issues":[{"title":"问题类型","location":"位置","originalText":"原文",${_fastPerspectiveField},"violationReason":"违规原因","howToFix":"修改方法","targetText":"改写后","severity":"critical/high/medium"}],"suggestions":[{"title":"","description":"步骤"}]}\n${'```'}`;
    const result = await runAgent('fast-review', agentContext);
    chapter.firstReviewOutput = result.response;
    chapter.status = 'first-reviewing';
    saveAgentOutput(projectId, chapter, 'fast-review', result.response);

    if (!result.response || result.response.trim().length === 0) {
        console.warn('[PIPELINE] fast-review returned empty response - defaulting to NOT passed (safe strategy)');
        const revIdFEmpty = uuidv4();
        store.setItem('reviews', revIdFEmpty, { id: revIdFEmpty, chapterId, projectId, step: 'fast-review', type: 'fast-review', reviewer: 'fast-review-agent', result: { passed: false, summary: '快审员返回空响应，默认未通过（安全策略）' }, passed: false, content: '快审员返回空响应，默认未通过（安全策略）', issues: [{ desc: '快审Agent返回空响应，无法确认内容质量', severity: 'critical' }], suggestions: ['请检查LLM API配置是否正常'], round, createdAt: new Date().toISOString() });
        try { getMetrics(projectId).recordAgentPassRate('fast-review', false, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        return { step: 'fast-review', result, passed: false, roundFailed: true, feedbackPart: '【快审空响应】审核Agent未返回有效结果，内容质量无法确认，需要重新审核。' };
    }

    try {
        const parsed = extractJSON(result.response);
        if (!parsed) throw new Error('JSON extraction failed');
        const revIdFR = uuidv4();
        store.setItem('reviews', revIdFR, { id: revIdFR, chapterId, projectId, step: 'fast-review', type: 'fast-review', reviewer: 'fast-review-agent', result: parsed, passed: !!parsed.passed, content: parsed.summary, issues: parsed.issues || [], suggestions: parsed.suggestions || [], round, createdAt: new Date().toISOString() });
        if (!parsed.passed) {
            try { getMetrics(projectId).recordAgentPassRate('fast-review', false, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
            return { step: 'fast-review', result, passed: false, feedback: parsed };
        }
    } catch (e) {
        console.warn('[PIPELINE] fast-review JSON parse failed, fallback to markdown analysis');
        const text = result.response || '';
        const hasPipelineBlock = /\[PIPELINE_BLOCK:/.test(text);
        const hasCriticalIssues = hasPipelineBlock || /严重问题|设定矛盾|逻辑错误|重大缺陷/.test(text);
        const fallbackPassed = !hasCriticalIssues;
        const fallbackFeedback = { passed: fallbackPassed, summary: hasPipelineBlock ? '快审发现阻断问题（PIPELINE_BLOCK）' : (hasCriticalIssues ? '快审发现严重问题（Markdown格式）' : '快审通过（Markdown格式）'), issues: hasCriticalIssues ? [{ description: hasPipelineBlock ? text.match(/\[PIPELINE_BLOCK:([^\]]*)/)?.[1] || '阻断问题' : '审核返回Markdown格式，检测到严重问题', severity: 'high' }] : [], suggestions: [] };
        const revIdFRfb = uuidv4();
        store.setItem('reviews', revIdFRfb, { id: revIdFRfb, chapterId, projectId, step: 'fast-review', type: 'fast-review', reviewer: 'fast-review-agent', result: fallbackFeedback, passed: fallbackPassed, content: fallbackFeedback.summary, issues: fallbackFeedback.issues, suggestions: [], round, createdAt: new Date().toISOString() });
        if (!fallbackPassed) {
            try { getMetrics(projectId).recordAgentPassRate('fast-review', false, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
            chapter.updatedAt = new Date().toISOString();
            store.setItem('chapters', chapterId, chapter);
            return { step: 'fast-review', result, passed: false, feedback: fallbackFeedback };
        }
    }
    try { getMetrics(projectId).recordAgentPassRate('fast-review', true, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    let fastPassFeedback = { passed: true, summary: '快审通过', issues: [], suggestions: [] };
    try {
        const parsed = extractJSON(result.response);
        if (parsed) {
            fastPassFeedback = { passed: true, summary: parsed.summary || '快审通过', issues: parsed.issues || [], suggestions: parsed.suggestions || [] };
        }
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    return { step: 'fast-review', result, passed: true, feedback: fastPassFeedback };
}

async function handleSecondReview(params) {
    const { projectId, chapter, agentContext, runAgent, saveAgentOutput, round, chapterId } = params;
    let secondReviewStyleCheck = '';
    const proj2 = store.getItem('projects', projectId);
    if (proj2?.styleTemplateId) {
        const st2 = store.getItem('style-templates', proj2.styleTemplateId);
        if (st2) {
            const rulesStr = Object.entries(st2.rules || {}).filter(([k, v]) => k !== 'forbidden' && v).map(([k, v]) => `${k}:${v}`).join('|');
            const forbiddenStr = (st2.rules?.forbidden || []).length ? `禁止:${st2.rules.forbidden.join('/')}` : '';
            if (rulesStr || forbiddenStr) { secondReviewStyleCheck = `\n【风格审核${st2.name}】${rulesStr}${forbiddenStr ? '|' + forbiddenStr : ''} styleScore(1-10)`; }
            else if (st2.example) { secondReviewStyleCheck = `\n【风格参考审核${st2.name}】正文风格是否与参考文本一致？styleScore(1-10) 参考风格：${st2.example.substring(0, 1000)}`; }
        }
    }
    const _srReviewRules = getGenreReviewRules(detectGenre(proj2?.styleProfile));
    const _srPerspectiveRule = _srReviewRules?.secondReview?.perspectiveRule || '';
    const _srTerminologyRule = _srReviewRules?.secondReview?.terminologyRule || '';
    const _srCorrectionRule = _srReviewRules?.secondReview?.correctionRule || '';
    const _srGenre = detectGenre(proj2?.styleProfile);
    const _srPerspectiveSchema = getGenrePerspectiveSchema(_srGenre);
    const _srPerspectiveField = _srPerspectiveSchema.fields;
    agentContext.content = `【任务】你是复审员，请复审，绝不输出小说正文。\n\n【正文（仅供审核）】\n系统实际字数：${chapter.wordCount || (chapter.content || '').length}字\n${(chapter.content || '').substring(0, 8000)}\n\n【初审结果】\n${(chapter.firstReviewOutput || '').substring(0, 2000)}${secondReviewStyleCheck}${reviewRemediation.getReviewPromptInjection(projectId)}${_srPerspectiveRule ? '\n' + _srPerspectiveRule + '\n' : ''}${_srTerminologyRule ? '\n' + _srTerminologyRule + '\n' : ''}${_srCorrectionRule ? '\n' + _srCorrectionRule + '\n' : ''}\n【输出格式】先输出可读Markdown报告，末尾附JSON数据块：\n${'```'}json\n{"passed":true/false,"issues":[{"title":"问题类型","location":"位置","originalText":"原文",${_srPerspectiveField},"violationReason":"违规原因","howToFix":"修改方法","targetText":"改写后","severity":"critical/high/medium"}],"suggestions":[],"summary":"概述","styleScore":1-10}\n${'```'}`;
    const result = await runAgent('second-review', agentContext);
    chapter.secondReviewOutput = result.response;
    chapter.status = 'second-reviewing';
    saveAgentOutput(projectId, chapter, 'second-review', result.response);

    if (!result.response || result.response.trim().length === 0) {
        console.warn('[PIPELINE] second-review returned empty response - defaulting to NOT passed (safe strategy)');
        const revId2Empty = uuidv4();
        store.setItem('reviews', revId2Empty, { id: revId2Empty, chapterId, projectId, step: 'second-review', type: 'second-review', reviewer: 'second-review-agent', result: { passed: false, summary: '复审员返回空响应，默认未通过（安全策略）' }, passed: false, content: '复审员返回空响应，默认未通过（安全策略）', issues: [{ desc: '复审Agent返回空响应，无法确认内容质量', severity: 'critical' }], suggestions: ['请检查LLM API配置是否正常'], round, createdAt: new Date().toISOString() });
        try { getMetrics(projectId).recordAgentPassRate('second-review', false, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        return { step: 'second-review', result, passed: false, roundFailed: true, feedbackPart: '【复审空响应】审核Agent未返回有效结果，内容质量无法确认，需要重新审核。' };
    }

    try {
        const parsed = extractJSON(result.response);
        if (!parsed) throw new Error('JSON extraction failed');
        if (!parsed.passed && parsed.summary) {
            const positiveSignals = /符合核心规范|视角锁定|降维处理得当|悬念钩子有效|字数达标|整体质量|符合要求|通过|达标|合格|良好|优秀|无严重|无重大|无明显/;
            const negativeSignals = /严重问题|重大缺陷|设定冲突|逻辑断裂|角色崩坏|OOC|视角违规|术语违规|未降维|泄露|超标|不足/;
            const hasPositive = positiveSignals.test(parsed.summary);
            const hasNegative = negativeSignals.test(parsed.summary);
            const hasCriticalIssues = (parsed.issues || []).some(i => i.severity === 'critical' || i.severity === 'blocker');
            if (hasPositive && !hasNegative && !hasCriticalIssues) { console.log(`[PIPELINE] second-review contradiction detected: passed=false but summary is positive. Auto-correcting to passed=true. Summary: "${parsed.summary?.substring(0, 80)}"`); parsed.passed = true; parsed._autoCorrected = true; }
        }
        const revId2 = uuidv4();
        store.setItem('reviews', revId2, { id: revId2, chapterId, projectId, step: 'second-review', type: 'second-review', reviewer: 'second-review-agent', result: parsed, passed: !!parsed.passed, content: parsed.summary, issues: parsed.issues || [], suggestions: parsed.suggestions || [], round, createdAt: new Date().toISOString() });
        if (!parsed.passed) {
            try { getMetrics(projectId).recordAgentPassRate('second-review', false, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
            return { step: 'second-review', result, passed: false, feedback: parsed };
        }
    } catch (e) {
        console.warn('[PIPELINE] second-review JSON parse failed, fallback to markdown analysis');
        const text = result.response || '';
        const criticalSection = text.match(/严重问题|重大缺陷|设定矛盾[\s\S]{0,200}/)?.[0] || '';
        const criticalIsEmpty = /(?:严重问题|重大缺陷)\s*\n\s*(?:\*\*无\*\*|无[。，.]|没有|不存在)/.test(criticalSection);
        const hasCriticalIssues = !criticalIsEmpty && /(?:设定矛盾|逻辑错误|重大缺陷|❌|⚠️|矛盾|不一致|冲突|断裂)/.test(text);
        const fallbackPassed = !hasCriticalIssues;
        const fallbackFeedback = { passed: fallbackPassed, summary: hasCriticalIssues ? '复审发现严重问题（Markdown格式）' : '复审通过（Markdown格式）', issues: hasCriticalIssues ? [{ description: '复审返回Markdown格式，检测到严重问题', severity: 'high' }] : [], suggestions: [] };
        const revId2b = uuidv4();
        store.setItem('reviews', revId2b, { id: revId2b, chapterId, projectId, step: 'second-review', type: 'second-review', reviewer: 'second-review-agent', result: fallbackFeedback, passed: fallbackPassed, content: fallbackFeedback.summary, issues: fallbackFeedback.issues, suggestions: [], round, createdAt: new Date().toISOString() });
        if (!fallbackPassed) {
            try { getMetrics(projectId).recordAgentPassRate('second-review', false, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
            return { step: 'second-review', result, passed: false, feedback: fallbackFeedback };
        }
    }
    try { getMetrics(projectId).recordAgentPassRate('second-review', true, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

    try {
        const _srContent = chapter.content || '';
        const _srProj = store.getItem('projects', projectId);
        const _srStyleProfile = _srProj?.styleProfile;
        const genreSecondIntercept = runGenreSecondReviewIntercept(_srContent, _srStyleProfile, { scene: chapter.scene, outline: chapter.outline });
        if (genreSecondIntercept.hardBlockIssues?.length > 0) {
            const _srIssue = genreSecondIntercept.hardBlockIssues[0];
            console.warn(`[PIPELINE] second-review passed but genre HARD BLOCK: ${_srIssue.title}`);
            return { step: 'second-review', result, passed: false, feedback: { passed: false, summary: _srIssue.description, issues: [{ title: _srIssue.title + '(系统HARD BLOCK)', description: _srIssue.description, severity: 'critical' }], suggestions: [{ title: _srIssue.title, description: _srIssue.description }] } };
        }
        const _srWc = _srContent.replace(/\s/g, '').length;
        const _srMaxWords = (_srProj?.wordConfig || {}).maxWords || getModeConfig(_srProj?.mode || 'novel').MAX_CHAPTER_WORDS || 3500;
        if (_srWc > _srMaxWords) {
            console.warn(`[PIPELINE] second-review passed but word count HARD BLOCK: ${_srWc} > ${_srMaxWords}`);
            return { step: 'second-review', result, passed: false, feedback: { passed: false, summary: `字数超标：${_srWc}字超出上限${_srMaxWords}字，必须精简`, issues: [{ title: '字数超标(系统HARD BLOCK)', description: `当前${_srWc}字 > 上限${_srMaxWords}字`, severity: 'critical' }], suggestions: [{ title: '精简内容', description: '删除冗余描写、合并重复段落、精简过渡句' }] } };
        }
    } catch (_srErr) { console.warn('[PIPELINE] second-review HARD BLOCK check failed:', _srErr.message); }

    let secondPassFeedback = { passed: true, summary: '复审通过', issues: [], suggestions: [] };
    try {
        const parsed = extractJSON(result.response);
        if (parsed) {
            secondPassFeedback = { passed: true, summary: parsed.summary || '复审通过', issues: parsed.issues || [], suggestions: parsed.suggestions || [] };
        }
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    return { step: 'second-review', result, passed: true, feedback: secondPassFeedback };
}

module.exports = { handleFirstReview, handleFastReview, handleSecondReview };
