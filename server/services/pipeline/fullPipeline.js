const store = require('../../store');
const { v4: uuidv4 } = require('uuid');
const { getModeConfig, cleanChapterContent, truncateChapter } = require('../contentUtils');
const { getModePipelineConfig } = require('../pipelineConfig');
const { getInfinitePipelineStatus } = require('./infinitePipeline');
const { getMetrics } = require('../metricsCollector');
const { getCircuitBreaker } = require('../reviewCircuitBreaker');
const { createVersionTag } = require('../versionControl');
const { detectGenre } = require('../genreConfig');
const { getStyleProfileForProject } = require('../agentPrompts');
const { checkAlertLoop, runBranchingWrite } = require('./pipelineUtils');
const { buildVolumeRhythmGuidance, getVisibleMaterials, enforceVolumeSubplaneLocks } = require('./volumeHelpers');
const { buildGenreOutlineInjection } = require('./outlineHelpers');
const { getHookBudgetForProject } = require('../hookBudget');
const { ContextBudget } = require('../contextBudget');
const memory = require('../memory');
const { PIPELINE_CONFIG } = require('../pipelineConfig');
const { AGENT_PROMPTS, SHUANGWEN_AGENT_PROMPTS, TOMATO_SHORT_AGENT_PROMPTS } = require('../agentPrompts');
const { getChapterIntentPlanner } = require('../chapterIntent');
const { saveAgentOutput, AGENT_ROLE_NAMES } = require('../fileOutput');
const { getRuleStackForProject } = require('../ruleStack');
const { getContextTraceForProject } = require('../contextTrace');
const { extractJSON } = require('../jsonUtils');
const stateSnapshot = require('../stateSnapshot');
const consistency = require('../consistency');
const imageGen = require('../imageGen');
const { shouldOverrideReviewRejection } = require('./reviewOverride');
const speechStyleRegistry = require('../speechStyleRegistry');
const pipelineRegistry = require('../pipelineRegistry');
const { formatFeedbackText, checkWordCountHardLimit, runPostApproval } = require('./pipelineHelpers');

let _runPipelineStepFn = null;
function setRunPipelineStepFn(fn) { _runPipelineStepFn = fn; pipelineRegistry.registerStepFn(fn); }
function getRunPipelineStep() {
    if (typeof _runPipelineStepFn === 'function') return _runPipelineStepFn;
    try {
        _runPipelineStepFn = pipelineRegistry.getStepFn();
        return _runPipelineStepFn;
    } catch(e) {
        throw new Error('runPipelineStep is not available - circular dependency may have prevented module loading');
    }
}

async function clearDownstreamOutputs(chapterId, failedStep) {
    const downstreamMap = {
        'writer': ['firstReviewOutput', 'secondReviewOutput', 'finalEditorOutput', 'reviserOutput', 'materialManagerOutput', 'polisherOutput'],
        'first-review': ['secondReviewOutput', 'finalEditorOutput', 'materialManagerOutput', 'polisherOutput'],
        'fast-review': ['finalEditorOutput', 'materialManagerOutput', 'polisherOutput'],
        'second-review': ['finalEditorOutput', 'materialManagerOutput', 'polisherOutput'],
        'final-editor': ['materialManagerOutput', 'polisherOutput']
    };
    const fields = downstreamMap[failedStep] || [];
    if (fields.length === 0) return;
    const ch = store.getItem('chapters', chapterId);
    if (!ch) return;
    let cleared = false;
    for (const f of fields) {
        if (ch[f]) {
            delete ch[f];
            cleared = true;
        }
    }
    if (cleared) {
        ch.updatedAt = new Date().toISOString();
        await store.setItem('chapters', chapterId, ch);
        console.log(`[PIPELINE] ${failedStep}失败，已清除后续步骤输出: ${fields.filter(f => !ch[f]).join(', ') || '(已清除)'}`);
    }
}

function generateOverrideOutput(overrideReason, stepName, originalFeedback) {
    const origSummary = originalFeedback?.summary || '（无原审核摘要）';
    const origIssues = (originalFeedback?.issues || []).slice(0, 3).map((i, idx) => {
        const desc = typeof i === 'string' ? i : (i.desc || i.description || JSON.stringify(i));
        return `${idx + 1}. ${desc}`;
    }).join('\n');

    return `## ${stepName}结果：✅ 系统覆盖通过

### 覆盖原因
${overrideReason}

### 原审核意见
**摘要**：${origSummary}
${origIssues ? '**主要问题**：\n' + origIssues : ''}

### 覆盖判定依据
系统判定原审核意见不适用本项目审核标准，自动覆盖为通过。
覆盖不是忽略问题，而是系统已确认这些问题属于误判或非关键问题。

\`\`\`json
${JSON.stringify({
    passed: true,
    approved: true,
    _overridden: true,
    _overrideReason: overrideReason,
    summary: `系统覆盖通过：${overrideReason}`,
    issues: [],
    suggestions: [],
    _originalSummary: origSummary
}, null, 2)}
\`\`\``;
}

async function runFullPipeline(projectId, chapterId, maxRounds = 5, options = {}) {
    const project = store.getItem('projects', projectId);
    const mode = project?.mode || options.mode || 'novel';
    const modeConfig = getModeConfig(mode);
    const onStep = options.onStep || null;

    const _checkStopped = () => {
        try {
            const state = getInfinitePipelineStatus(projectId);
            if (state && state.running && state.stopped) {
                console.log(`[PIPELINE] Stop signal detected in runFullPipeline for ch${store.getItem('chapters', chapterId)?.chapterNumber}`);
                return true;
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        return false;
    };

    const steps = mode === 'shuangwen'
        ? ['writer', 'fast-review', 'final-editor']
        : mode === 'tomato-short'
            ? ['writer', 'fast-review', 'final-editor']
            : ['writer', 'first-review', 'second-review', 'final-editor'];

    const MIN_WORD_COUNT = getModePipelineConfig(mode).MIN_WORD_COUNT;
    const effectiveMaxRounds = Math.min(maxRounds, getModePipelineConfig(mode).MAX_ROUNDS);

    const pipelineLog = [];
    const MAX_PIPELINE_LOG_ENTRIES = 200;
    try { store.deleteItem('pipeline-logs', `${chapterId}_pipeline`); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    let materialGuidance = '';
    let lastFeedback = '';

    try {
        const chapter = store.getItem('chapters', chapterId);
        if (chapter && chapter.chapterNumber > 1) {
            const allPrevChapters = store.queryItems('chapters', { projectId })
                .filter(c => c.chapterNumber < chapter.chapterNumber)
                .sort((a, b) => a.chapterNumber - b.chapterNumber);
            for (const prevChapter of allPrevChapters) {
                if (prevChapter.status === 'approved' && (!prevChapter.materialManagerOutput || prevChapter.materialManagerFailed)) {
                    console.warn(`[PIPELINE] ⚠️ ${prevChapter.chapterNumber}章素材管理器未执行，补跑..`);
                    try {
                        const catchupResult = await getRunPipelineStep()(projectId, prevChapter.id, 'material-manager', 1, { materialGuidance: '' });
                        prevChapter.materialManagerOutput = catchupResult?.feedback?.summary || '[补跑完成]';
                        prevChapter.materialManagerFailed = false;
                        delete prevChapter.materialManagerError;
                        prevChapter.status = 'material-updated';
                        prevChapter.updatedAt = new Date().toISOString();
                        await store.setItem('chapters', prevChapter.id, prevChapter);
                        pipelineLog.push({ step: 'material-manager-catchup', chapterNumber: prevChapter.chapterNumber, status: 'completed', feedback: catchupResult?.feedback, timestamp: new Date().toISOString() });
                        if (onStep) onStep({ step: 'material-manager-catchup', round: 0, passed: true, roleName: '素材管理(补跑)', chapterNumber: prevChapter.chapterNumber, feedback: catchupResult?.feedback || { summary: '补跑完成' } });
                        console.log(`[PIPELINE] ${prevChapter.chapterNumber}章素材管理器补跑完成`);
                    } catch (matErr) {
                        console.error(`[PIPELINE] ${prevChapter.chapterNumber}章素材管理器补跑失败:`, matErr.message);
                        prevChapter._matManagerRetries = (prevChapter._matManagerRetries || 0) + 1;
                        if (prevChapter._matManagerRetries >= 3) {
                            prevChapter.status = 'material-updated';
                            prevChapter.materialManagerOutput = `[素材管理补跑失败${prevChapter._matManagerRetries}次，跳过]`;
                            console.warn(`[PIPELINE] ${prevChapter.chapterNumber}章素材管理补${prevChapter._matManagerRetries}次均失败，标记跳过`);
                        }
                        pipelineLog.push({ step: 'material-manager-catchup', chapterNumber: prevChapter.chapterNumber, status: 'error', error: matErr.message, timestamp: new Date().toISOString() });
                        if (onStep) onStep({ step: 'material-manager-catchup', round: 0, passed: false, roleName: '素材管理(补跑)', chapterNumber: prevChapter.chapterNumber, feedback: { summary: `补跑失败: ${matErr.message}`, issues: [{ desc: matErr.message, severity: 'critical' }] } });
                        prevChapter.updatedAt = new Date().toISOString();
                        await store.setItem('chapters', prevChapter.id, prevChapter);
                    }
                }
            }
            const allMaterials = store.queryItems('materials', { projectId });
            const emptyMaterials = allMaterials.filter(m => !m.archived && (!m.currentContent || m.currentContent.trim().length < 5) && m.initialContent && m.initialContent.trim().length > 10);
            for (const em of emptyMaterials) {
                console.warn(`[PIPELINE] ⚠️ 素材"${em.name}"内容为空，恢复initialContent`);
                em.currentContent = em.initialContent;
                em.updatedAt = new Date().toISOString();
                await store.setItem('materials', em.id, em);
            }
        }
    } catch (preflightErr) {
        console.error(`[PIPELINE] 素材预检失败:`, preflightErr.message);
    }
    const generateImages = options.generateImages || false;
    const imageAspectRatio = options.imageAspectRatio || '16:9';
    const rejectionTracker = {};
    steps.forEach(s => { rejectionTracker[s] = false; });
    const allFeedbackParts = [];

    const addFeedbackPart = (header, text) => {
        const existingIdx = allFeedbackParts.findIndex(p => p.startsWith(header));
        if (existingIdx >= 0) {
            const existing = allFeedbackParts[existingIdx];
            const existingCore = existing.replace(header, '').trim().substring(0, 100);
            const newCore = text.trim().substring(0, 100);
            if (existingCore === newCore) return;
            allFeedbackParts[existingIdx] = header + '\n' + text;
        } else {
            allFeedbackParts.push(header + '\n' + text);
        }
    };

    const persistPipelineLog = async () => {
        try {
            const logId = `${chapterId}_pipeline`;
            const entries = pipelineLog.map(e => ({
                ...e,
                timestamp: e.timestamp || new Date().toISOString()
            }));
            const trimmed = entries.length > 200 ? entries.slice(-150) : entries;
            await store.setItem('pipeline-logs', logId, {
                id: logId,
                chapterId,
                projectId,
                entries: trimmed,
                updatedAt: new Date().toISOString()
            });
        } catch (persistErr) {
            console.warn('[PIPELINE] Failed to persist pipeline log:', persistErr.message);
        }
    };
    const circuitBreaker = getCircuitBreaker(projectId);
    const cbConfig = circuitBreaker.getAdjustedConfig();
    if (cbConfig.message) {
        console.log(`[PIPELINE] Circuit breaker: ${cbConfig.message}`);
    }

    let chapter = store.getItem('chapters', chapterId);
    const chapterNumber = chapter?.chapterNumber || 0;
    const chapterOutline = chapter?.outline || '';

    if (chapter.content && chapter.status === 'outlined') {
        const contentWc = chapter.content.replace(/\s/g, '').length;
        if (contentWc > 500) {
            console.log(`[PIPELINE] Ch${chapterNumber} has ${contentWc} chars of content from previous attempt, preserving and resuming from written status`);
            chapter.status = 'written';
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
        } else {
            console.log(`[PIPELINE] Ch${chapterNumber} has only ${contentWc} chars of stale content, clearing before rewrite`);
            chapter.content = '';
            chapter.wordCount = 0;
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
        }
    }

    let chapterIntent = null;
    try {
        const intentPlanner = getChapterIntentPlanner(projectId);
        chapterIntent = intentPlanner.getIntent(chapterNumber);
        if (chapterIntent) {
            if (!chapter.intentPlannerOutput) {
                const intentText = intentPlanner.formatIntentForPrompt(chapterNumber);
                chapter.intentPlannerOutput = intentText;
                await store.setItem('chapters', chapterId, chapter);
                saveAgentOutput(projectId, chapter, 'intent-planner', intentText);
            }
            if (onStep) {
                onStep({ step: 'intent-planner', round: 0, passed: true, roleName: '意图规划', feedback: {
                    summary: chapterIntent.goal,
                    mustKeep: chapterIntent.mustKeep,
                    mustAvoid: chapterIntent.mustAvoid,
                    conflictDesign: chapterIntent.conflictDesign,
                    chapterEndHook: chapterIntent.chapterEndHook,
                    hookAdvance: chapterIntent.hookAdvance,
                    hookResolve: chapterIntent.hookResolve
                } });
            }
        } else {
            console.log(`[PIPELINE] Generating chapter intent for chapter ${chapterNumber}...`);
            chapterIntent = await intentPlanner.generateIntent(chapterNumber, chapterOutline, { apiConfig: options.apiConfig, scene: chapter.scene });
            console.log(`[PIPELINE] Chapter intent generated: ${chapterIntent.goal}`);
            const intentText = intentPlanner.formatIntentForPrompt(chapterNumber);
            chapter.intentPlannerOutput = intentText;
            await store.setItem('chapters', chapterId, chapter);
            saveAgentOutput(projectId, chapter, 'intent-planner', intentText);
            if (onStep) {
                onStep({ step: 'intent-planner', round: 0, passed: true, roleName: '意图规划', feedback: {
                    summary: chapterIntent.goal,
                    mustKeep: chapterIntent.mustKeep,
                    mustAvoid: chapterIntent.mustAvoid,
                    conflictDesign: chapterIntent.conflictDesign,
                    chapterEndHook: chapterIntent.chapterEndHook,
                    hookAdvance: chapterIntent.hookAdvance,
                    hookResolve: chapterIntent.hookResolve
                } });
            }
        }
    } catch (intentErr) {
        console.warn('[PIPELINE] Chapter intent generation failed:', intentErr.message);
        pipelineLog.push({ step: 'intent-planner', status: 'error', error: intentErr.message, timestamp: new Date().toISOString() });
        if (onStep) onStep({ step: 'intent-planner', round: 0, passed: false, roleName: '意图规划', feedback: { summary: `意图规划失败: ${intentErr.message}`, issues: [{ desc: intentErr.message, severity: 'high' }] } });
    }

    try {
        const hookBudget = getHookBudgetForProject(projectId);
        hookBudget.syncFromForeshadowingMaterials();
        const ruleStack = getRuleStackForProject(projectId);
        ruleStack.extractRulesFromMaterials();
    } catch (syncErr) {
        console.warn('[PIPELINE] Hook/Rule sync failed:', syncErr.message);
    }

    const startRound = (chapter.round && chapter.round > 0) ? chapter.round + 1 : 1;
    let retryCount = 0;
    for (let round = startRound; round <= effectiveMaxRounds + startRound - 1; round++) {
        await new Promise(r => setImmediate(r));

        chapter = store.getItem('chapters', chapterId) || chapter;

        if (round > 1 || startRound === 1) {
            const clearFields = ['firstReviewOutput', 'secondReviewOutput', 'finalEditorOutput', 'reviserOutput', 'materialManagerOutput', 'polisherOutput'];
            let cleared = false;
            for (const f of clearFields) {
                if (chapter[f]) {
                    delete chapter[f];
                    cleared = true;
                }
            }
            if (cleared) {
                chapter.updatedAt = new Date().toISOString();
                await store.setItem('chapters', chapterId, chapter);
                console.log(`[PIPELINE] R${round} 开始，已清除上一轮审核输出`);
            }
        }

        if (_checkStopped()) {
            console.log(`[PIPELINE] Stop signal at round ${round}, aborting runFullPipeline for ch${chapterNumber}`);
            chapter = store.getItem('chapters', chapterId);
            if (chapter) {
                chapter.status = 'outlined';
                delete chapter.skipUntil;
                chapter.updatedAt = new Date().toISOString();
                await store.setItem('chapters', chapterId, chapter);
            }
            persistPipelineLog();
            return { success: false, rounds: round, log: pipelineLog, message: '流水线已停止' };
        }

        if (round > 1) {
            const alertResult = checkAlertLoop(projectId);
            if (alertResult) {
                console.error(`[PIPELINE] 🚨 Alert loop triggered at round ${round}, pausing pipeline for diagnosis`);
                pipelineLog.push({
                    step: 'alert-loop',
                    status: 'triggered',
                    round,
                    diagnosticReport: alertResult,
                    timestamp: new Date().toISOString()
                });
                if (onStep) {
                    onStep({ step: 'alert-loop', round, passed: false, roleName: '熔断诊断', feedback: { alerts: alertResult.alerts, suggestions: alertResult.suggestions } });
                }
                const cb = getCircuitBreaker(projectId);
                if (cb.isTripped() && round >= 5) {
                    console.error(`[PIPELINE] 🚨 Circuit breaker tripped + alert loop + round>=5, forcing pipeline stop. Manual intervention required.`);
                    persistPipelineLog();
                    return {
                        success: false,
                        rounds: round,
                        log: pipelineLog,
                        message: `流水线熔断暂停：${alertResult.alerts.map(a => `${a.agentType}打回率${a.failRate}`).join(', ')}。诊断建议：${alertResult.suggestions.join(', ')}`,
                        alertLoopReport: alertResult
                    };
                }
                if (cb.isTripped()) {
                    console.warn(`[PIPELINE] ⚠️ Circuit breaker tripped but round<5, continuing with reviser. Adjusting temperature and enabling polisher.`);
                }
            }
        }

        let roundFailed = false;
        for (let step of steps) {
            if (_checkStopped()) {
                console.log(`[PIPELINE] Stop signal at step ${step}, aborting`);
                chapter = store.getItem('chapters', chapterId);
                if (chapter) {
                    chapter.status = 'outlined';
                    delete chapter.skipUntil;
                    chapter.updatedAt = new Date().toISOString();
                    await store.setItem('chapters', chapterId, chapter);
                }
                persistPipelineLog();
                return { success: false, rounds: round, log: pipelineLog, message: '流水线已停止' };
            }
            if (step === 'second-review' && pipelineLog.find(l => l.step === 'first-review' && l.result?.feedback?._criticalBlocker)) {
                console.log(`[PIPELINE] Skipping second-review due to critical_blocker from first-review`);
                continue;
            }

            const wcCheck = checkWordCountHardLimit(step, chapterId, project, mode);
            if (wcCheck.blocked) {
                pipelineLog.push(wcCheck.stepResult);
                if (onStep) onStep({ step, round, passed: false, roleName: AGENT_ROLE_NAMES[step] || step, feedback: wcCheck.stepResult.feedback });
                clearDownstreamOutputs(chapterId, step);
                roundFailed = true;
                break;
            }

            try {
                let context = {};

                if (round > 1 && step === 'writer') {
                    const multipleRejected = Object.values(rejectionTracker).filter(Boolean).length >= 2;
                    let feedbackToUse;
                    if (multipleRejected && allFeedbackParts.length > 1) {
                        feedbackToUse = '【⚠ 多位审核者意见汇总，请同时满足所有修改要求】\n\n' + allFeedbackParts.join('\n\n');
                    } else {
                        feedbackToUse = allFeedbackParts.length > 1
                            ? allFeedbackParts.join('\n\n')
                            : (lastFeedback || pipelineLog
                                .filter(l => l.step !== 'writer' && l.step !== 'reviser')
                                .map(l => l.result?.response || '')
                                .join('\n')
                                .substring(0, 4000));
                    }
                    context = { reviewFeedback: feedbackToUse.substring(0, 3000), mode };

                    const currentContent = chapter.content || '';
                    const currentWordCount = currentContent.length;
                    const rejectMinWords = (project?.wordConfig || {}).rejectMin || modeConfig.REJECT_MIN_WORDS || 1800;
                    const isWordCountBelowRejectMin = currentWordCount < rejectMinWords;

                    if (isWordCountBelowRejectMin) {
                        console.log(`[PIPELINE] Word count ${currentWordCount} < rejectMin ${rejectMinWords}, using writer for full rewrite`);
                        if (round >= 2 && project.enableBranching) {
                            console.log(`[PIPELINE] A/B branching enabled for round ${round}`);
                            try {
                                const branchResult = await runBranchingWrite(projectId, chapterId, chapter, { ...context, reviewFeedback: feedbackToUse.substring(0, 5000) }, runAgent, options);
                                chapter.content = branchResult.content;
                                chapter.version = (chapter.version || 0) + 1;
                                chapter.updatedAt = new Date().toISOString();
                                chapter.branchingMeta = { round, selectedBranch: branchResult.selectedBranch, branchA: branchResult.branchA, branchB: branchResult.branchB, reason: branchResult.reason };
                                await store.setItem('chapters', chapterId, chapter);
                                saveAgentOutput(projectId, chapter, 'writer-branching', `Selected branch ${branchResult.selectedBranch}: A=${branchResult.branchA}B=${branchResult.branchB}(${branchResult.reason})`);
                                if (onStep) onStep({ step: 'writer-branching', round, passed: true, roleName: 'A/B分支试写', feedback: { selectedBranch: branchResult.selectedBranch, branchA: branchResult.branchA, branchB: branchResult.branchB, reason: branchResult.reason } });
                                pipelineLog.push({ step: 'writer-branching', round, result: { response: branchResult.content.substring(0, 200), branchA: branchResult.branchA, branchB: branchResult.branchB, selectedBranch: branchResult.selectedBranch } });
                                continue;
                            } catch (branchErr) {
                                console.warn(`[PIPELINE] Branching failed, falling back to single writer: ${branchErr.message}`);
                            }
                        }
                    } else {
                        console.log(`[PIPELINE] Word count OK (${currentWordCount} >= rejectMin ${rejectMinWords}), using reviser for targeted fixes`);
                        step = 'reviser';
                    }
                } else {
                    context = { ...context, mode };
                }

                if (step === 'writer' && chapterIntent) {
                    const intentPlanner = getChapterIntentPlanner(projectId);
                    context.chapterIntent = intentPlanner.formatIntentForPrompt(chapterNumber);
                }

                if (step === 'writer') {
                    try {
                        const hookBudget = getHookBudgetForProject(projectId);
                        context.hookAgenda = hookBudget.formatHookAgendaForPrompt(chapterNumber);
                    } catch (e) {}
                }

                context.generateImages = generateImages;
                context.imageAspectRatio = imageAspectRatio;

                if (step === 'material-manager' && materialGuidance) {
                    context.materialGuidance = materialGuidance;
                }

                console.log(`[PIPELINE] Round ${round}, Step: ${step}`);

                const _stepStartMs = Date.now();
                const stepResult = await getRunPipelineStep()(projectId, chapterId, step, round, context);
                const _stepDurationMs = Date.now() - _stepStartMs;
                pipelineLog.push(stepResult);
                if (pipelineLog.length > MAX_PIPELINE_LOG_ENTRIES) {
                    pipelineLog.splice(0, pipelineLog.length - MAX_PIPELINE_LOG_ENTRIES);
                }

                if (_checkStopped()) {
                    console.log(`[PIPELINE] Stop signal after step ${step}, aborting`);
                    chapter = store.getItem('chapters', chapterId);
                    if (chapter) {
                        chapter.status = 'outlined';
                        delete chapter.skipUntil;
                        chapter.updatedAt = new Date().toISOString();
                        await store.setItem('chapters', chapterId, chapter);
                    }
                    persistPipelineLog();
                    return { success: false, rounds: round, log: pipelineLog, message: '流水线已停止' };
                }

                if (step === 'reviser') {
                    const _issuesFixed = (stepResult.feedback?.issues || []).length;
                    try { getMetrics(projectId).recordReviserLoop(chapter.chapterNumber, round, _stepDurationMs, _issuesFixed); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
                    const freshChapter = store.getItem('chapters', chapterId);
                    try {
                        const reviserContent = freshChapter?.reviserOutput || '';
                        const reviewFeedback = stepResult.feedback || {};
                        const reviserReview = {
                            id: `${chapterId}_reviser_r${round}`,
                            chapterId,
                            projectId,
                            step: 'reviser',
                            type: 'reviser',
                            round,
                            passed: true,
                            content: reviserContent
                                ? `返修员已执行局部修改（${reviserContent.length}字）\n\n${reviserContent.substring(0, 2000)}`
                                : '返修员返回空响应，保留原文',
                            feedback: reviewFeedback,
                            issues: reviewFeedback.issues || [],
                            suggestions: reviewFeedback.suggestions || [],
                            createdAt: new Date().toISOString()
                        };
                        await store.setItem('reviews', reviserReview.id, reviserReview);
                    } catch (reviewSaveErr) {
                        console.warn('[PIPELINE] Failed to save reviser review record:', reviewSaveErr.message);
                    }
                }

                if (onStep) {
                    const roleName = AGENT_ROLE_NAMES[step] || step;
                    onStep({ step, round, passed: stepResult.passed, roleName, feedback: stepResult.feedback });
                }

                if (step === 'writer' && !stepResult.passed) {
                    console.log(`[PIPELINE] Writer failed (likely word count) in round ${round}`);
                    if (stepResult.feedback) {
                        const fb = stepResult.feedback;
                        const feedbackText = fb.summary || '执笔人输出不达标';
                        lastFeedback = feedbackText;
                        addFeedbackPart('【执笔人反馈】', feedbackText);
                    }
                    clearDownstreamOutputs(chapterId, 'writer');
                    roundFailed = true;
                    break;
                }

                if (step === 'final-editor') {
                    materialGuidance = stepResult.materialGuidance || '';
                    const feApproved = stepResult.passed === true || stepResult.feedback?.approved === true || chapter.status === 'approved';
                    if (feApproved) {
                        chapter = store.getItem('chapters', chapterId);
                        if (chapter) {
                            chapter.normalContent = chapter.content;
                            chapter.status = 'approved';
                            chapter.updatedAt = new Date().toISOString();
                            await store.setItem('chapters', chapterId, chapter);
                        }

                        await runPostApproval(projectId, chapterId, chapter.chapterNumber, round, pipelineLog, onStep, {
                            mode, materialGuidance, generateImages, imageAspectRatio, chapterIntent, circuitBreaker
                        });
                        try { persistPipelineLog(); } catch (plErr) { console.warn('[PIPELINE] Pipeline log persist failed:', plErr.message); }
                        return {
                            success: true,
                            rounds: round,
                            log: pipelineLog,
                            message: `Chapter approved after ${round} round(s)`
                        };
                    } else {
                        console.log(`[PIPELINE] Final editor rejected in round ${round}`);
                        try { getMetrics(projectId).recordAgentPassRate('final-editor', false, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

                        const feSummary = (stepResult.feedback?.summary || '') + (stepResult.feedback?.scheduleNote || '');
                        const feIssues = stepResult.feedback?.issues || [];
                        const isWordCountRejection = /字数超限|字数过多|字数超标|超过.*字|超过上限|字数.*硬拦截/.test(feSummary) ||
                            feIssues.some(i => /字数超|字数过多|超过/.test(i.description || i.desc || ''));
                        if (isWordCountRejection) {
                            console.warn(`[PIPELINE] 定稿人以字数理由拒绝，但字数控制是流水线职责，自动覆盖为通过`);
                            stepResult.passed = true;
                            stepResult.feedback.approved = true;
                            stepResult.feedback.summary = '系统覆盖通过：字数控制由流水线自动管理';
                            pipelineLog.push(stepResult);
                            if (onStep) onStep({ step, round, passed: true, roleName: '定稿人', feedback: stepResult.feedback, chapterNumber: chapter.chapterNumber });
                            chapter = store.getItem('chapters', chapterId) || chapter;
                            chapter.finalEditorOutput = generateOverrideOutput('字数控制由流水线自动管理', '定稿人', stepResult.feedback);
                            chapter.status = 'approved';
                            chapter.approvedAt = new Date().toISOString();
                            chapter.round = round;
                            await store.setItem('chapters', chapterId, chapter);

                            try {
                                const mmResult = await getRunPipelineStep()(projectId, chapterId, 'material-manager', round, { materialGuidance });
                                pipelineLog.push({ step: 'material-manager', status: 'completed', passed: mmResult.passed !== false, feedback: mmResult.feedback || { summary: '素材管理完成' }, timestamp: new Date().toISOString() });
                                if (onStep) onStep({ step: 'material-manager', round, passed: true, roleName: '素材管理', feedback: mmResult.feedback || { summary: '素材管理完成' } });
                            } catch (mmErr) {
                                console.warn('[PIPELINE] Material-manager failed after word-count override:', mmErr.message);
                            }

                            const mmChapter = store.getItem('chapters', chapterId);
                            if (mmChapter && mmChapter.status !== 'material-updated') {
                                mmChapter.status = 'material-updated';
                                mmChapter.updatedAt = new Date().toISOString();
                                await store.setItem('chapters', chapterId, mmChapter);
                            }

                            persistPipelineLog();
                            return { success: true, rounds: round, log: pipelineLog, message: `Chapter approved (final-editor word-count rejection overridden)` };
                        }

                        rejectionTracker['final-editor'] = true;

                        const isPaceIssue = PIPELINE_CONFIG.DYNAMIC_REVIEW_ROUTING_ENABLED && (stepResult.feedback?.edits?.some(e =>
                            PIPELINE_CONFIG.PACE_ISSUE_KEYWORDS.test(typeof e === 'string' ? e : (e.description || e.suggestion || ''))
                        ) || PIPELINE_CONFIG.PACE_ISSUE_KEYWORDS.test(stepResult.feedback?.summary || ''));

                        if (isPaceIssue && round <= effectiveMaxRounds) {
                            console.log(`[PIPELINE] Final-editor detected pace issue, routing to adjuster directly`);
                            try {
                                const adjusterCtx = { readerOutput: JSON.stringify(stepResult.feedback) };
                                const adjusterResult = await getRunPipelineStep()(projectId, chapterId, 'adjuster', round, adjusterCtx);
                                pipelineLog.push(adjusterResult);
                                if (onStep) onStep({ step: 'adjuster', round, passed: true, roleName: '调整节奏)', feedback: adjusterResult.feedback });
                                console.log(`[PIPELINE] Adjuster completed for pace issue, continuing to next round`);
                            } catch (adjErr) {
                                console.warn(`[PIPELINE] Adjuster routing failed: ${adjErr.message}`);
                            }
                        }

                        if (stepResult.feedback) {
                            const feedbackParts = [];
                            if (stepResult.feedback.action) {
                                feedbackParts.push('定稿人裁' + (stepResult.feedback.action === 'reject' ? '拒绝' : '需修改'));
                            }
                            if (stepResult.feedback.edits?.length > 0) {
                                const criticalEdits = stepResult.feedback.edits.filter(e => typeof e === 'object' && e.priority === 'high');
                                if (criticalEdits.length > 0) {
                                    feedbackParts.push('必须修改: ' + criticalEdits.map(e => e.description || e.suggestion || JSON.stringify(e)).join('; '));
                                }
                                const otherEdits = stepResult.feedback.edits.filter(e => typeof e !== 'object' || e.priority !== 'high');
                                if (otherEdits.length > 0) {
                                    feedbackParts.push('建议修改: ' + otherEdits.map(e => typeof e === 'string' ? e : e.description || e.suggestion || JSON.stringify(e)).join('; '));
                                }
                            }
                            if (stepResult.feedback.summary) {
                                feedbackParts.push('总结: ' + stepResult.feedback.summary);
                            }
                            const feedbackText = feedbackParts.join('\n');
                            lastFeedback = feedbackText;
                            addFeedbackPart('【定稿人意见】', feedbackText);
                        }
                        clearDownstreamOutputs(chapterId, 'final-editor');
                        roundFailed = true;
                        break;
                    }
                }

                if (step === 'first-review' && !stepResult.passed) {
                    console.log(`[PIPELINE] First review failed in round ${round}`);
                    rejectionTracker['first-review'] = true;

                    const currentChapterContent = store.getItem('chapters', chapterId)?.content || '';
                    const currentSysWc = (currentChapterContent || '').replace(/\s/g, '').length;
                    const currentRejectMinWc = (project?.wordConfig || {}).rejectMin || getModeConfig(mode).REJECT_MIN_WORDS || 1800;
                    const currentMaterials = store.queryItems('materials', { projectId });
                    const overrideResult = shouldOverrideReviewRejection(stepResult, currentChapterContent, currentSysWc, currentRejectMinWc, currentMaterials, project);
                    if (overrideResult.override) {
                        console.log(`[PIPELINE] 🔄 初审拒绝被系统覆盖：${overrideResult.reason}`);
                        stepResult.passed = true;
                        stepResult.feedback = stepResult.feedback || {};
                        stepResult.feedback.approved = true;
                        stepResult.feedback.summary = `系统覆盖通过：${overrideResult.reason}`;
                        stepResult.feedback._overridden = true;
                        stepResult.feedback._overrideReason = overrideResult.reason;
                        if (stepResult.feedback._criticalBlocker) delete stepResult.feedback._criticalBlocker;
                        if (stepResult.result?.feedback?._criticalBlocker) delete stepResult.result.feedback._criticalBlocker;
                        pipelineLog.forEach(l => { if (l.step === 'first-review' && l.result?.feedback?._criticalBlocker) delete l.result.feedback._criticalBlocker; });
                        const ch1 = store.getItem('chapters', chapterId);
                        if (ch1) {
                            ch1.firstReviewOutput = generateOverrideOutput(overrideResult.reason, '初审', stepResult.feedback);
                            await store.setItem('chapters', chapterId, ch1);
                        }
                        pipelineLog.push({ step: 'first-review-override', round, reason: overrideResult.reason, timestamp: new Date().toISOString() });
                        if (onStep) onStep({ step: 'first-review', round, passed: true, roleName: '初审', feedback: { ...stepResult.feedback, _overridden: true, _overrideReason: overrideResult.reason }, chapterNumber: chapter.chapterNumber });
                    } else {
                        const isWordCountOnly = stepResult.feedback?.issues?.every(i => i.desc && i.desc.includes('字数') && i.desc.includes('低于最低要求'));
                        if (!isWordCountOnly) {
                            circuitBreaker.recordFailure('first-review', chapter.chapterNumber);
                        }
                    }

                    if (!stepResult.passed && stepResult.feedback) {
                        const feedbackText = formatFeedbackText(stepResult.feedback);
                        lastFeedback = feedbackText;
                        addFeedbackPart('【初审意见】', feedbackText);
                    }
                    if (!stepResult.passed) {
                        clearDownstreamOutputs(chapterId, 'first-review');
                        roundFailed = true;
                        break;
                    }
                }
                if (step === 'fast-review' && !stepResult.passed) {
                    console.log(`[PIPELINE] Fast review failed in round ${round}`);
                    rejectionTracker['fast-review'] = true;
                    if (stepResult.feedback) {
                        const feedbackText = formatFeedbackText(stepResult.feedback);
                        lastFeedback = feedbackText;
                        addFeedbackPart('【快审意见】', feedbackText);
                    }
                    clearDownstreamOutputs(chapterId, 'fast-review');
                    roundFailed = true;
                    break;
                }
                if (step === 'second-review' && !stepResult.passed) {
                    console.log(`[PIPELINE] Second review failed in round ${round}`);
                    rejectionTracker['second-review'] = true;

                    const currentChapterContent2 = store.getItem('chapters', chapterId)?.content || '';
                    const currentSysWc2 = (currentChapterContent2 || '').replace(/\s/g, '').length;
                    const currentRejectMinWc2 = (project?.wordConfig || {}).rejectMin || getModeConfig(mode).REJECT_MIN_WORDS || 1800;
                    const currentMaterials2 = store.queryItems('materials', { projectId });
                    const overrideResult2 = shouldOverrideReviewRejection(stepResult, currentChapterContent2, currentSysWc2, currentRejectMinWc2, currentMaterials2, project);
                    if (overrideResult2.override) {
                        console.log(`[PIPELINE] 🔄 复审拒绝被系统覆盖：${overrideResult2.reason}`);
                        stepResult.passed = true;
                        stepResult.feedback = stepResult.feedback || {};
                        stepResult.feedback.approved = true;
                        stepResult.feedback.summary = `系统覆盖通过：${overrideResult2.reason}`;
                        stepResult.feedback._overridden = true;
                        stepResult.feedback._overrideReason = overrideResult2.reason;
                        const ch2 = store.getItem('chapters', chapterId);
                        if (ch2) {
                            ch2.secondReviewOutput = generateOverrideOutput(overrideResult2.reason, '复审', stepResult.feedback);
                            await store.setItem('chapters', chapterId, ch2);
                        }
                        pipelineLog.push({ step: 'second-review-override', round, reason: overrideResult2.reason, timestamp: new Date().toISOString() });
                        if (onStep) onStep({ step: 'second-review', round, passed: true, roleName: '复审', feedback: { ...stepResult.feedback, _overridden: true, _overrideReason: overrideResult2.reason }, chapterNumber: chapter.chapterNumber });
                    }

                    if (!stepResult.passed && stepResult.feedback) {
                        const feedbackText = formatFeedbackText(stepResult.feedback);
                        lastFeedback = feedbackText;
                        addFeedbackPart('【复审意见】', feedbackText);
                    }
                    if (!stepResult.passed) {
                        clearDownstreamOutputs(chapterId, 'second-review');
                        roundFailed = true;
                        break;
                    }
                }
            } catch (error) {
                console.error(`[PIPELINE] Error in round ${round}, step ${step}:`, error.message, error.stack);
                const isOverloaded = error.message && (error.message.includes('529') || error.message.includes('2064') || error.message.includes('负载较高') || error.message.includes('overloaded') || error.message.includes('rate limit'));
                const isContextErr = error.isContextOverflow || (error.message && (error.message.includes('CONTEXT_OVERFLOW') || error.message.includes('context_length')));
                const isTimeout = error.message && (error.message.includes('超时') || error.message.includes('timeout') || error.message.includes('ETIMEDOUT') || error.message.includes('aborted'));
                const errorDetail = isOverloaded
                    ? `AI服务繁忙(529)，步${step}执行失败`
                    : isTimeout
                    ? `步骤${step}超时`
                    : isContextErr
                    ? `步骤${step}上下文溢出`
                    : `步骤${step}执行出错: ${error.message}`;
                pipelineLog.push({ step, error: errorDetail, passed: false, isOverloaded, isTimeout, isContextErr });
                if (pipelineLog.length > MAX_PIPELINE_LOG_ENTRIES) {
                    pipelineLog.splice(0, pipelineLog.length - MAX_PIPELINE_LOG_ENTRIES);
                }

                try {
                    const reviewStore = store.getItem('reviews', `${chapterId}_${step}_r${round}`) || {
                        id: `${chapterId}_${step}_r${round}`,
                        chapterId,
                        projectId,
                        step,
                        round,
                        passed: false,
                        feedback: { summary: errorDetail, issues: [{ desc: error.message, severity: 'critical' }], suggestions: [] },
                        result: { response: '' },
                        createdAt: new Date().toISOString()
                    };
                    reviewStore.passed = false;
                    reviewStore.feedback = { summary: errorDetail, issues: [{ desc: error.message, severity: 'critical' }], suggestions: [] };
                    reviewStore.updatedAt = new Date().toISOString();
                    await store.setItem('reviews', reviewStore.id, reviewStore);
                } catch (reviewSaveErr) {}

                try {
                    const errChapter = store.getItem('chapters', chapterId);
                    if (errChapter) {
                        if (isContextErr) {
                            errChapter.status = 'context-error';
                            errChapter.skipUntil = Date.now() + 1800000;
                        } else {
                            errChapter.status = 'pipeline-failed';
                        }
                        errChapter.updatedAt = new Date().toISOString();
                        await store.setItem('chapters', chapterId, errChapter);
                    }
                } catch (saveErr) {
                    console.warn('[PIPELINE] Failed to update chapter status after error:', saveErr.message);
                }

                if (isOverloaded || isTimeout) {
                    const waitMs = isOverloaded ? 60000 : 30000;
                    console.log(`[PIPELINE] ${isOverloaded ? 'API繁忙' : '超时'}，等${waitMs/1000}秒后重试当前步骤...`);
                    try { await new Promise(r => setTimeout(r, waitMs)); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
                    retryCount++;
                    if (retryCount > 3) {
                        console.error(`[PIPELINE] 连续${retryCount}${isOverloaded ? 'API繁忙' : '超时'}，放弃当前章节`);
                        persistPipelineLog();
                        return { success: false, rounds: round, log: pipelineLog, error: errorDetail, isOverloaded, message: `连续${retryCount}${isOverloaded ? 'API繁忙' : '超时'}，放弃当前章节` };
                    }
                    continue;
                }

                persistPipelineLog();
                return { success: false, rounds: round, log: pipelineLog, error: errorDetail, isOverloaded, message: errorDetail };
            }
        }
    }

    const isWordCountFailure = pipelineLog.some(l => l.feedback?.issues?.some(i => i.desc && i.desc.includes('字数') && i.desc.includes('低于最低要求')));
    const failedChapter = store.getItem('chapters', chapterId);
    if (failedChapter) {
        failedChapter.updatedAt = new Date().toISOString();
        await store.setItem('chapters', chapterId, failedChapter);
    }

    persistPipelineLog();
    return {
        success: false,
        rounds: effectiveMaxRounds,
        log: pipelineLog,
        message: `定稿人经${effectiveMaxRounds}轮审核仍未通过`,
        lastFeedback,
        failureType: isWordCountFailure ? 'word-count' : 'review'
    };
}




module.exports = { runFullPipeline, setRunPipelineStepFn, shouldOverrideReviewRejection };
