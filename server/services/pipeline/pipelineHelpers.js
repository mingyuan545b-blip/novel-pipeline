const store = require('../../store');
const { getModeConfig, cleanChapterContent, truncateChapter } = require('../contentUtils');
const { getMetrics } = require('../metricsCollector');
const { createVersionTag } = require('../versionControl');
const { getHookBudgetForProject } = require('../hookBudget');
const { ContextBudget } = require('../contextBudget');
const memory = require('../memory');
const { getRuleStackForProject } = require('../ruleStack');
const { getContextTraceForProject } = require('../contextTrace');
const { extractJSON } = require('../jsonUtils');
const stateSnapshot = require('../stateSnapshot');
const consistency = require('../consistency');
const imageGen = require('../imageGen');
const pipelineRegistry = require('../pipelineRegistry');

function _getStepFn() {
    return pipelineRegistry.getStepFn();
}

function formatFeedbackText(feedback) {
    const fb = feedback || {};
    const issueLines = (fb.issues || []).map((i, idx) => {
        const desc = typeof i === 'string' ? i : i.description || JSON.stringify(i);
        const sev = i.severity ? `[${i.severity}]` : '';
        return `${idx + 1}. ${sev} ${desc}`;
    });
    const suggestionLines = (fb.suggestions || []).map((s, idx) => {
        const desc = typeof s === 'string' ? s : s.description || JSON.stringify(s);
        return `${idx + 1}. ${desc}`;
    });
    return [
        fb.summary ? '【总结】' + fb.summary : '',
        issueLines.length > 0 ? '【必须修改的问题】\n' + issueLines.join('\n') : '',
        suggestionLines.length > 0 ? '【修改建议】\n' + suggestionLines.join('\n') : ''
    ].filter(Boolean).join('\n\n');
}

function checkWordCountHardLimit(step, chapterId, project, mode) {
    if (!['first-review', 'fast-review', 'second-review'].includes(step)) {
        return { blocked: false };
    }
    const currentChapterData = store.getItem('chapters', chapterId);
    const currentWordCount = (currentChapterData?.content || '').replace(/\s/g, '').length;
    const currentRejectMin = (project?.wordConfig || {}).rejectMin || getModeConfig(mode).REJECT_MIN_WORDS || 1800;
    const currentMaxWords = (project?.wordConfig || {}).maxChapter || getModeConfig(mode).MAX_CHAPTER_WORDS || 3500;

    if (currentWordCount < currentRejectMin) {
        const wcGap = currentRejectMin - currentWordCount;
        console.warn(`[PIPELINE] 字数硬拦截 ${currentWordCount}< 最低${currentRejectMin}字，直接拒绝`);
        return {
            blocked: true,
            stepResult: {
                step,
                passed: false,
                feedback: {
                    approved: false,
                    summary: `【字数严重不足】当前${currentWordCount}字，距离最低${currentRejectMin}字还差${wcGap}字。必须大幅扩展内容。`,
                    issues: [{ desc: `字数${currentWordCount}字低于最低要求${currentRejectMin}字，差${wcGap}字`, severity: 'critical' }],
                    suggestions: [
                        `在场景转换处插入至少150字的环境描写和角色感受`,
                        '为每段对话补充至50字的微动作和表情描写',
                        '在开头和结尾各增加至300字的铺垫和收束',
                        '将简略叙述改为详细描写，每个动作拆解为3-5个感官细节',
                        `绝对不要删减现有内容，只做加法，至少新增${wcGap + 200}字`
                    ],
                    edits: []
                },
                result: { response: '' }
            }
        };
    }

    if (currentWordCount > currentMaxWords) {
        const wcOver = currentWordCount - currentMaxWords;
        console.warn(`[PIPELINE] 字数超限硬拦截 ${currentWordCount}> 上限${currentMaxWords}字，超${wcOver}字`);
        return {
            blocked: true,
            stepResult: {
                step,
                passed: false,
                feedback: {
                    approved: false,
                    summary: `【字数超限】当前${currentWordCount}字，超过上限${currentMaxWords}字超${wcOver}字。必须精简内容，删减冗余描写和重复段落，保留核心情节与关键细节。`,
                    issues: [{ desc: `字数${currentWordCount}字超过上限${currentMaxWords}字，超${wcOver}字`, severity: 'major' }],
                    suggestions: [
                        `删除重复的感官描写和场景描写，至少精简${wcOver + 200}字`,
                        '合并功能重叠的段落，保留最精彩的版本',
                        '精简过渡段和环境描写，每个场景保留1-2个核心感官细节即可',
                        '删除与主线无关的支线描写',
                        `绝对不要新增内容，只做减法，至少删减${wcOver + 200}字`
                    ],
                    edits: []
                },
                result: { response: '' }
            }
        };
    }

    return { blocked: false };
}

async function runReaderCheck(projectId, chapterId, chapterNumber, round, pipelineLog, onStep, mode, modeConfig) {
    const readerTriggers = mode === 'tomato-short'
        ? (modeConfig.READER_TRIGGERS || [7, 14])
        : null;
    const shouldRunReader = readerTriggers
        ? readerTriggers.includes(chapterNumber)
        : (chapterNumber >= 15 && chapterNumber % 15 === 0);

    if (!shouldRunReader) return;

    try {
        console.log(`[PIPELINE] Chapter ${chapterNumber} is a 15-chapter checkpoint, running reader...`);
        const readerResult = await _getStepFn()(projectId, chapterId, 'reader', round, {});
        pipelineLog.push(readerResult);
        if (onStep) onStep({ step: 'reader', round, passed: true, roleName: '阅读者' });
        console.log(`[PIPELINE] Reader completed for chapter ${chapterNumber}`);
    } catch (readerErr) {
        console.warn('[PIPELINE] Reader failed:', readerErr.message);
        pipelineLog.push({ step: 'reader', status: 'error', error: readerErr.message, timestamp: new Date().toISOString() });
        if (onStep) onStep({ step: 'reader', round, passed: false, roleName: '阅读者', feedback: { summary: `阅读者失败: ${readerErr.message}` } });
    }

    try {
        const chapter = store.getItem('chapters', chapterId);
        const readerOutput = chapter?.readerOutput || '';
        if (!readerOutput) return;
        const parsed = extractJSON(readerOutput);
        const hardIssues = parsed?.hardIssues || [];
        if (hardIssues.length === 0) return;

        console.log(`[PIPELINE] Reader found ${hardIssues.length} hard issues, running reviser for affected chapters...`);
        const affectedChapters = [...new Set(hardIssues.map(i => i.chapter))].filter(Boolean);
        const allChaptersInRange = store.queryItems('chapters', { projectId })
            .filter(c => !c.archived && affectedChapters.includes(c.chapterNumber));

        for (const affectedCh of allChaptersInRange) {
            try {
                const hardIssuesForChapter = hardIssues.filter(i => i.chapter === affectedCh.chapterNumber);
                const fixGuidance = hardIssuesForChapter.map(i =>
                    `【硬伤${i.type}: ${i.description}\n证据: ${i.evidence}\n修改建议: ${i.fixSuggestion}`
                ).join('\n\n');
                console.log(`[PIPELINE] Revising chapter ${affectedCh.chapterNumber} for ${hardIssuesForChapter.length} hard issues`);
                const reviseResult = await _getStepFn()(projectId, affectedCh.id, 'reviser', round, {
                    reviewFeedback: `【阅读者发现的硬伤——必须修复】\n${fixGuidance}`
                });
                pipelineLog.push({ ...reviseResult, affectedChapter: affectedCh.chapterNumber });
                if (onStep) onStep({ step: 'reviser', round, passed: true, roleName: '返修员', chapterNumber: affectedCh.chapterNumber });
                try {
                    const reviserReviewId = `${affectedCh.id}_reviser_reader_r${round}`;
                    await store.setItem('reviews', reviserReviewId, {
                        id: reviserReviewId, chapterId: affectedCh.id, projectId,
                        step: 'reviser', type: 'reviser', round, passed: true,
                        content: `阅读者触发返修：修复${hardIssuesForChapter.length}处硬伤`,
                        issues: hardIssuesForChapter.map(i => ({ desc: `${i.type}: ${i.description}`, severity: 'high' })),
                        createdAt: new Date().toISOString()
                    });
                } catch (revReviewErr) {
                    console.warn('[PIPELINE] Failed to save reader-triggered reviser review:', revReviewErr.message);
                }
                const revisedCh = store.getItem('chapters', affectedCh.id);
                if (revisedCh?.content) {
                    try {
                        console.log(`[PIPELINE] Re-running final-editor for revised chapter ${affectedCh.chapterNumber}`);
                        const reFinalResult = await _getStepFn()(projectId, affectedCh.id, 'final-editor', round, {});
                        pipelineLog.push({ ...reFinalResult, affectedChapter: affectedCh.chapterNumber });
                        if (onStep) onStep({ step: 'final-editor', round, passed: reFinalResult.passed, roleName: '定稿人', chapterNumber: affectedCh.chapterNumber });
                        try {
                            const reFinalReviewId = `${affectedCh.id}_refinal_reader_r${round}`;
                            await store.setItem('reviews', reFinalReviewId, {
                                id: reFinalReviewId, chapterId: affectedCh.id, projectId,
                                step: 'final-editor', type: 'final-editor', round,
                                passed: reFinalResult.passed, content: `阅读者触发返修后重新定稿`,
                                createdAt: new Date().toISOString()
                            });
                        } catch (reFinalReviewErr) {
                            console.warn('[PIPELINE] Failed to save reader-triggered re-final review:', reFinalReviewErr.message);
                        }
                        if (reFinalResult.passed) {
                            try {
                                console.log(`[PIPELINE] Re-running material-manager for revised chapter ${affectedCh.chapterNumber}`);
                                await _getStepFn()(projectId, affectedCh.id, 'material-manager', round, {});
                                if (onStep) onStep({ step: 'material-manager', round, passed: true, roleName: '素材管理', chapterNumber: affectedCh.chapterNumber });
                            } catch (reMatErr) {
                                console.warn(`[PIPELINE] Re-material-manager failed for chapter ${affectedCh.chapterNumber}:`, reMatErr.message);
                            }
                        }
                    } catch (reFinalErr) {
                        console.warn(`[PIPELINE] Re-final-editor failed for chapter ${affectedCh.chapterNumber}:`, reFinalErr.message);
                    }
                }
            } catch (reviseErr) {
                console.warn(`[PIPELINE] Reviser failed for chapter ${affectedCh.chapterNumber}:`, reviseErr.message);
            }
        }
        console.log(`[PIPELINE] Reader review complete, skipping adjuster (removed - rules managed by consolidated/correction only)`);
    } catch (readerPostErr) {
        console.warn('[PIPELINE] Reader post-processing failed:', readerPostErr.message);
    }
}

async function runPostApproval(projectId, chapterId, chapterNumber, round, pipelineLog, onStep, ctx) {
    const { mode, materialGuidance, generateImages, imageAspectRatio, chapterIntent, circuitBreaker } = ctx;
    const project = store.getItem('projects', projectId);
    const modeConfig = getModeConfig(mode);

    try {
        console.log(`[PIPELINE] Running polisher (MiniMax) for chapter...`);
        const polishResult = await _getStepFn()(projectId, chapterId, 'polisher', round, { mode });
        pipelineLog.push(polishResult);
        if (onStep) onStep({ step: 'polisher', round, passed: true, roleName: '润色师' });
        if (polishResult.result?.response) {
            const chapter = store.getItem('chapters', chapterId);
            const polishedContent = polishResult.result.response;
            const originalLength = (chapter?.normalContent || '').length;
            const polishedLength = polishedContent.length;
            const ratio = originalLength > 0 ? polishedLength / originalLength : 1;
            if (ratio >= 0.8 && ratio <= 1.2 && polishedLength > 500) {
                let finalPolished = cleanChapterContent(polishedContent);
                const polishedWc = finalPolished.replace(/\s/g, '').length;
                const polishMaxWords = (project?.wordConfig || {}).maxWords || getModeConfig(mode).MAX_CHAPTER_WORDS || 3500;
                if (polishedWc > polishMaxWords) {
                    console.warn(`[PIPELINE] Polisher字数超限: ${polishedWc}> 上限${polishMaxWords}字，截断到上限`);
                    finalPolished = truncateChapter(finalPolished, polishMaxWords).content;
                }
                chapter.polishedContent = finalPolished;
                chapter.polisherOutput = finalPolished;
                chapter.content = finalPolished;
                chapter.wordCount = finalPolished.replace(/\s/g, '').length;
                chapter.updatedAt = new Date().toISOString();
                await store.setItem('chapters', chapterId, chapter);
                console.log(`[PIPELINE] Polish saved: normal=${originalLength}, polished=${chapter.wordCount} chars (ratio: ${ratio.toFixed(2)})`);
            } else {
                console.warn(`[PIPELINE] Polish rejected: ratio=${ratio.toFixed(2)}, length=${polishedLength}. Keeping original only.`);
            }
        }
    } catch (polishErr) {
        console.warn('[PIPELINE] Polish failed, keeping original:', polishErr.message);
        pipelineLog.push({ step: 'polisher', status: 'error', error: polishErr.message, timestamp: new Date().toISOString() });
        if (onStep) onStep({ step: 'polisher', round, passed: false, roleName: '润色师', feedback: { summary: `润色失败，保留原文: ${polishErr.message}` } });
    }

    let matRetries = 0;
    const maxMatRetries = 3;
    let matManagerSucceeded = false;
    while (matRetries < maxMatRetries) {
        try {
            console.log(`[PIPELINE] Running material-manager for chapter ${chapterNumber}...${matRetries > 0 ? `(retry ${matRetries})` : ''}`);
            const mmStepResult = await _getStepFn()(projectId, chapterId, 'material-manager', round, { materialGuidance });
            pipelineLog.push({
                step: 'material-manager', status: 'completed',
                passed: mmStepResult.passed !== false,
                feedback: mmStepResult.feedback || { summary: '素材管理完成' },
                materialUpdates: mmStepResult.updates || mmStepResult.materialUpdates || [],
                timestamp: new Date().toISOString()
            });
            if (onStep) onStep({ step: 'material-manager', round, passed: true, roleName: '素材管理', feedback: mmStepResult.feedback || { summary: '素材管理完成' } });
            console.log(`[PIPELINE] Material-manager completed for chapter ${chapterNumber}`);
            matManagerSucceeded = true;
            break;
        } catch (matErr) {
            matRetries++;
            console.error(`[PIPELINE] Material-manager failed for chapter ${chapterNumber} (attempt ${matRetries}/${maxMatRetries}):`, matErr.message);
            if (matRetries >= maxMatRetries) {
                pipelineLog.push({ step: 'material-manager', status: 'error', error: matErr.message, timestamp: new Date().toISOString() });
                if (onStep) onStep({ step: 'material-manager', round, passed: false, roleName: '素材管理', feedback: { summary: `素材管理失败(重试${maxMatRetries}): ${matErr.message}`, issues: [{ desc: matErr.message, severity: 'critical' }] } });
                const failedChapter = store.getItem('chapters', chapterId);
                if (failedChapter) {
                    failedChapter.materialManagerFailed = true;
                    failedChapter.materialManagerError = matErr.message;
                    failedChapter.updatedAt = new Date().toISOString();
                    await store.setItem('chapters', chapterId, failedChapter);
                }
            } else {
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }

    if (matManagerSucceeded) {
        const matChapter = store.getItem('chapters', chapterId);
        if (matChapter && matChapter.status !== 'material-updated') {
            matChapter.status = 'material-updated';
            matChapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, matChapter);
        }
        console.log(`[PIPELINE] Chapter ${chapterNumber} status set to material-updated after material-manager`);
    }

    await runReaderCheck(projectId, chapterId, chapterNumber, round, pipelineLog, onStep, mode, modeConfig);

    try {
        const updatedChapter = store.getItem('chapters', chapterId);
        await stateSnapshot.createSnapshot(projectId, updatedChapter.chapterNumber, updatedChapter.content);
        console.log(`[PIPELINE] State snapshot created for chapter ${updatedChapter.chapterNumber}`);
    } catch (snapErr) {
        console.warn('[PIPELINE] State snapshot creation failed:', snapErr.message);
    }

    try {
        const updatedChapter = store.getItem('chapters', chapterId);
        const chapterContent = updatedChapter?.normalContent || updatedChapter?.content || '';
        const consistencyResult = await consistency.quickCheck(projectId, updatedChapter.chapterNumber, chapterContent);
        if (!consistencyResult.passed) {
            console.warn(`[PIPELINE] Consistency check found ${consistencyResult.criticalCount} critical issues after chapter ${updatedChapter.chapterNumber}`);
            pipelineLog.push({
                step: 'consistency-check', status: 'warning',
                criticalCount: consistencyResult.criticalCount,
                issues: consistencyResult.issues.map(i => ({ dimension: i.dimension, title: i.title, severity: i.severity })),
                timestamp: new Date().toISOString()
            });
        } else {
            pipelineLog.push({ step: 'consistency-check', status: 'passed', timestamp: new Date().toISOString() });
        }
    } catch (consErr) {
        console.warn('[PIPELINE] Consistency check failed:', consErr.message);
    }

    try {
        const ch = store.getItem('chapters', chapterId);
        if (ch) await memory.updateAfterChapter(projectId, ch.chapterNumber, ch.normalContent || ch.content || '');
    } catch (memErr) {
        console.warn('[PIPELINE] Memory update failed:', memErr.message);
    }

    try {
        const hookBudget = getHookBudgetForProject(projectId);
        const ch = store.getItem('chapters', chapterId);
        const hookResult = hookBudget.updateHooksFromContent(chapterNumber, ch?.normalContent || ch?.content || '');
        if (hookResult.advanced.length > 0 || hookResult.resolved.length > 0 || hookResult.newDetected.length > 0) {
            console.log(`[PIPELINE] Hook budget updated: advanced=${hookResult.advanced.length}, resolved=${hookResult.resolved.length}, new=${hookResult.newDetected.length}`);
            for (const h of hookResult.resolved) { try { getMetrics(projectId).recordHookResolution(h.name || h, chapterNumber, 'resolved'); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); } }
            for (const h of hookResult.advanced) { try { getMetrics(projectId).recordHookResolution(h.name || h, chapterNumber, 'advanced'); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); } }
            pipelineLog.push({
                step: 'hook-budget-update', status: 'done',
                advanced: hookResult.advanced, resolved: hookResult.resolved, newDetected: hookResult.newDetected,
                timestamp: new Date().toISOString()
            });
        }
        const hookAgenda = hookBudget.generateHookAgenda(chapterNumber);
        for (const h of hookAgenda.staleDebt) { try { getMetrics(projectId).recordHookResolution(h.id || h.notes, chapterNumber, 'stale'); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); } }
    } catch (hookErr) {
        console.warn('[PIPELINE] Hook budget update failed:', hookErr.message);
    }

    try {
        const contextTrace = getContextTraceForProject(projectId);
        const budget = new ContextBudget('default', 16384);
        contextTrace.recordChapterTrace(chapterNumber, {
            plannerInputs: ['chapter-intent', 'hook-budget', 'rule-stack', 'memory', 'materials'],
            selectedSources: chapterIntent ? ['intent-goal', 'intent-mustKeep', 'intent-mustAvoid', 'hook-agenda', 'rule-stack-L1', 'rule-stack-L2'] : [],
            composerInputs: chapterIntent ? [`chapter-${chapterNumber}-intent`] : [],
            notes: [`Chapter ${chapterNumber} completed successfully`],
            hookBudgetSnapshot: getHookBudgetForProject(projectId).getBudgetStatus(chapterNumber),
            ruleStackSnapshot: getRuleStackForProject(projectId).getStackSummary()
        });
    } catch (traceErr) {
        console.warn('[PIPELINE] Context trace recording failed:', traceErr.message);
    }

    if (generateImages) {
        try {
            const imgChapter = store.getItem('chapters', chapterId);
            if (imgChapter && imgChapter.content) {
                console.log(`[PIPELINE] Generating images for chapter ${imgChapter.chapterNumber}`);
                const imageResult = await imageGen.generateChapterImages(
                    projectId, imgChapter.chapterNumber, imgChapter.title, imgChapter.content,
                    { aspectRatio: imageAspectRatio || '16:9' }
                );
                pipelineLog.push({
                    step: 'image-generation', status: 'done',
                    imagesGenerated: imageResult.totalGenerated,
                    imageFiles: imageResult.images?.map(i => i.fileName) || [],
                    timestamp: new Date().toISOString()
                });
            }
        } catch (imgError) {
            console.error(`[PIPELINE] Image generation error: ${imgError.message}`);
            pipelineLog.push({ step: 'image-generation', status: 'error', error: imgError.message, timestamp: new Date().toISOString() });
        }
    }

    try { circuitBreaker.recordSuccess(chapterNumber); } catch (cbErr) { console.warn('[PIPELINE] Circuit breaker record failed:', cbErr.message); }
    try {
        const ch = store.getItem('chapters', chapterId);
        createVersionTag(projectId, chapterId, chapterNumber, ch?.version || 1, ch?.content || '', { branch: 'main', reason: 'auto-commit' });
    } catch (verErr) {
        console.warn(`[PIPELINE] Version tag failed: ${verErr.message}`);
    }
}

module.exports = { formatFeedbackText, checkWordCountHardLimit, runPostApproval, runReaderCheck };
