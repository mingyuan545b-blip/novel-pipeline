const store = require("../../store");
const { v4: uuidv4 } = require('uuid');
const { getModeConfig } = require("../contentUtils");
const { getModePipelineConfig } = require("../pipelineConfig");
const { supplementChapterOutlines, generateChapterOutlines } = require("./outlineGenerator");
const { getVisibleMaterials, enforceVolumeSubplaneLocks, getVolumeOrder } = require("./volumeHelpers");
const { getMetrics } = require("../metricsCollector");
const { STUCK_STATUSES } = require("../chapterStatus");
const { getHookBudgetForProject } = require("../hookBudget");
const materialIndex = require("../materialIndex");
const pipelineRegistry = require("../pipelineRegistry");

let _runPipelineStepRef = null;

function setRunPipelineStepRef(fn) {
    _runPipelineStepRef = fn;
    pipelineRegistry.registerStepFn(fn);
}

function getRunPipelineStep() {
    if (typeof _runPipelineStepRef === 'function') return _runPipelineStepRef;
    try {
        _runPipelineStepRef = pipelineRegistry.getStepFn();
        return _runPipelineStepRef;
    } catch (e) {
        throw new Error('runPipelineStep is not available');
    }
}

let _runFullPipelineRef = null;

function setRunFullPipelineRef(fn) {
    _runFullPipelineRef = fn;
    pipelineRegistry.registerPipelineFn(fn);
}

function getRunFullPipelineFn() {
    if (typeof _runFullPipelineRef === 'function') return _runFullPipelineRef;
    try {
        _runFullPipelineRef = pipelineRegistry.getPipelineFn();
        return _runFullPipelineRef;
    } catch (e) {
        throw new Error('runFullPipeline is not available');
    }
}

const INFINITE_PIPELINE_STATE = {};
const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_STALE_THRESHOLD_MS = 60000;
const MAX_IN_MEMORY_LOGS = 200;
const STATE_CLEANUP_DELAY_MS = 10000;

async function runInfinitePipeline(projectId, options = {}) {
    const project = store.getItem('projects', projectId);
    const mode = project?.mode || 'novel';
    const modeMaxRounds = getModePipelineConfig(mode).MAX_ROUNDS;
    const { chaptersPerBatch = 30, maxSupplements = 999, stopAfterChapter = null, maxRounds = modeMaxRounds } = options;

    const targetChapterCount = project?.targetChapterCount || null;
    const targetWordCount = project?.targetWordCount || null;

    const effectiveStopChapter = stopAfterChapter || targetChapterCount || null;

    if (INFINITE_PIPELINE_STATE[projectId]?.running) {
        return { success: false, error: 'Pipeline already running for this project' };
    }
    delete INFINITE_PIPELINE_STATE[projectId];

    const existingPersisted = store.getItem('infinite-pipeline-state', projectId);
    const actualCompletedCount = store.queryItems('chapters', { projectId }).filter(c => c.status === 'material-updated').length;
    INFINITE_PIPELINE_STATE[projectId] = { running: true, stopped: false, currentChapter: null, completedChapters: actualCompletedCount, supplementCount: existingPersisted?.supplementCount || 0, logs: [], lastError: null, phase: 'init', batchProgress: '' };

    const state = INFINITE_PIPELINE_STATE[projectId];

    const _heartbeatTimer = setInterval(() => {
        try {
            state.lastHeartbeat = Date.now();
            const persisted = store.getItem('infinite-pipeline-state', projectId);
            if (persisted) {
                persisted.lastHeartbeat = state.lastHeartbeat;
                persisted.running = true;
                persisted.stopped = state.stopped;
                persisted.currentChapter = state.currentChapter;
                persisted.phase = state.phase;
                persisted.batchProgress = state.batchProgress;
                persisted.completedChapters = state.completedChapters;
                persisted.supplementCount = state.supplementCount;
                store.setItem('infinite-pipeline-state', projectId, persisted);
            }
        } catch (hbErr) { console.warn('[INFINITE] Heartbeat persist failed:', hbErr.message); }
    }, HEARTBEAT_INTERVAL_MS);
    state.lastHeartbeat = Date.now();

    try {
        const allChapters = store.queryItems('chapters', { projectId }).sort((a, b) => a.chapterNumber - b.chapterNumber);
        const approvedWithoutMaterials = allChapters.filter(c => c.status === 'approved' && !c.materialManagerOutput);
        if (approvedWithoutMaterials.length > 0) {
            console.warn(`[PIPELINE] ⚠️ 发现${approvedWithoutMaterials.length}个approved但缺素材管理的章节，补跑中...`);
            for (const ch of approvedWithoutMaterials) {
                try {
                    console.log(`[PIPELINE] 补跑第${ch.chapterNumber}章素材管理器...`);
                    await getRunPipelineStep()(projectId, ch.id, 'material-manager', 1, { materialGuidance: '' });
                    ch.materialManagerOutput = '[补跑完成]';
                    ch.status = 'material-updated';
                    ch.updatedAt = new Date().toISOString();
                    await store.setItem('chapters', ch.id, ch);
                    state.completedChapters++;
                    console.log(`[PIPELINE] ✅ 第${ch.chapterNumber}章素材管理器补跑完成`);
                } catch (matErr) {
                    console.error(`[PIPELINE] 第${ch.chapterNumber}章素材管理器补跑失败:`, matErr.message);
                }
            }
        }
    } catch (startupErr) {
        console.error(`[PIPELINE] 启动时素材补跑失败:`, startupErr.message);
    }
    const MAX_CHAPTER_RETRIES = 5;
    const yieldLoop = () => new Promise(r => setImmediate(r));

    const waitWithStop = (ms) => {
        if (state.stopped) return Promise.resolve();
        let stopResolve;
        const stopPromise = new Promise(r => { stopResolve = r; });
        const timerPromise = new Promise(r => { setTimeout(r, ms); });
        const checker = setInterval(() => {
            if (state.stopped) { clearInterval(checker); stopResolve(); }
        }, 2000);
        return Promise.race([timerPromise, stopPromise]).finally(() => { clearInterval(checker); });
    };

    let _logPersistCounter = 0;
    const addLog = async (msg, structuredData) => {
        let auto = {};
        if (!structuredData) {
            const chMatch = msg.match(/第(\d+)章/);
            const chapterNumber = chMatch ? parseInt(chMatch[1]) : undefined;
            if (msg.includes('开始完整流水线')) {
                auto = { step: 'pipeline-start', passed: true, chapterNumber };
            } else if (msg.includes('完成 ✅')) {
                auto = { step: 'pipeline-done', passed: true, chapterNumber };
            } else if (msg.includes('异常 ❌')) {
                auto = { step: 'pipeline-error', passed: false, chapterNumber };
            } else if (msg.includes('字数不达标') || msg.includes('字数连续')) {
                auto = { step: 'word-count-fail', passed: false, chapterNumber };
            } else if (msg.includes('审核未通过')) {
                auto = { step: 'review-fail', passed: false, chapterNumber };
            } else if (msg.includes('永久跳过')) {
                auto = { step: 'chapter-skip', passed: false, chapterNumber };
            } else if (msg.includes('素材更新')) {
                auto = { step: 'material-update', chapterNumber };
            } else if (msg.includes('补充') && msg.includes('大纲')) {
                auto = { step: 'outline-supplement' };
            } else if (msg.includes('冷却')) {
                auto = { step: 'cooldown', chapterNumber };
            } else if (msg.includes('停止')) {
                auto = { step: 'pipeline-stop' };
            } else if (chapterNumber) {
                auto = { step: 'chapter-status', chapterNumber };
            }
        }
        const entry = {
            time: new Date().toISOString(),
            msg,
            ...auto,
            ...(structuredData || {})
        };
        state.logs.push(entry);
        if (state.logs.length > MAX_IN_MEMORY_LOGS) state.logs = state.logs.slice(-Math.floor(MAX_IN_MEMORY_LOGS * 0.6));
        console.log(`[INFINITE] ${msg}`);
        _logPersistCounter++;
        if (_logPersistCounter % 5 === 0) {
            try {
                await store.setItem('infinite-pipeline-state', projectId, {
                    id: projectId,
                    projectId,
                    running: state.running,
                    stopped: state.stopped,
                    currentChapter: state.currentChapter,
                    completedChapters: state.completedChapters,
                    supplementCount: state.supplementCount,
                    phase: state.phase,
                    batchProgress: state.batchProgress,
                    lastHeartbeat: state.lastHeartbeat,
                    logs: state.logs.slice(-200),
                    updatedAt: new Date().toISOString()
                });
            } catch (persistErr) {
                console.warn('[INFINITE] Failed to persist state:', persistErr.message);
            }
        }
    };

    try {
        let chapters = store.queryItems('chapters', { projectId }).sort((a, b) => a.chapterNumber - b.chapterNumber);

        try {
            const hookBudget = getHookBudgetForProject(projectId);
            const cleanupResult = hookBudget.cleanupInvalidHooks();
            if (cleanupResult.removed > 0) {
                addLog(`清理了${cleanupResult.removed}条无效伏笔记录，剩余${cleanupResult.remaining}条`);
            }
        } catch (hookCleanErr) {
            console.warn('[PIPELINE] Hook cleanup failed:', hookCleanErr.message);
        }

        if (chapters.length === 0) {
            addLog('没有章节，生成初始大纲...');
            let outlineAttempts = 0;
            const maxOutlineAttempts = 3;
            let lastOutlineError = '';
            while (outlineAttempts < maxOutlineAttempts) {
                outlineAttempts++;
                try {
                    const retryHint = outlineAttempts > 1 ? `（第${outlineAttempts}次尝试，上次失败原因：${lastOutlineError}。请严格遵守：1.只使用指定解锁的次位面 2.次位面章节不少于15章 3.主世界回响不少于3章 4.不要提及任何锁定次位面）` : '';
                    const initResult = await generateChapterOutlines(projectId, `请根据素材库规划前30章的章节大纲，确保开篇即冲突、每章有钩子、主角主动行为${retryHint}`, 30);
                    if (initResult.created?.length > 0) {
                        addLog(`生成了${initResult.count} 章初始大纲`);
                        chapters = store.queryItems('chapters', { projectId }).sort((a, b) => a.chapterNumber - b.chapterNumber);
                        break;
                    } else {
                        lastOutlineError = initResult.error || initResult.rhythmIssues?.join('；') || 'unknown';
                        addLog(`生成初始大纲失败(第${outlineAttempts}次): ${lastOutlineError}`);
                        if (outlineAttempts >= maxOutlineAttempts) {
                            addLog(`生成初始大纲失败，已重试${maxOutlineAttempts}次，停止`);
                            state.running = false;
                            return { success: false, completedChapters: 0, logs: state.logs, lastError: `Failed to generate initial outlines after ${maxOutlineAttempts} attempts: ${lastOutlineError}` };
                        }
                        addLog(`将在5秒后重试...`);
                        await new Promise(r => setTimeout(r, 5000));
                    }
                } catch (initErr) {
                    lastOutlineError = initErr.message;
                    addLog(`生成初始大纲异常(第${outlineAttempts}次): ${initErr.message}`);
                    if (outlineAttempts >= maxOutlineAttempts) {
                        state.running = false;
                        return { success: false, completedChapters: 0, logs: state.logs, lastError: initErr.message };
                    }
                    addLog(`将在5秒后重试...`);
                    await new Promise(r => setTimeout(r, 5000));
                }
            }
        }

        while (!state.stopped) {
            await yieldLoop();

            chapters = store.queryItems('chapters', { projectId }).sort((a, b) => a.chapterNumber - b.chapterNumber);

            const approvedWithoutMaterials = chapters.filter(c => c.status === 'approved' && !c.materialManagerOutput);
            for (const ch of approvedWithoutMaterials) {
                console.warn(`[PIPELINE] ⚠️ 第${ch.chapterNumber}章approved但缺素材管理，补跑中...`);
                try {
                    await getRunPipelineStep()(projectId, ch.id, 'material-manager', 1, { materialGuidance: '' });
                    ch.materialManagerOutput = '[补跑完成]';
                    ch.status = 'material-updated';
                    ch.updatedAt = new Date().toISOString();
                    await store.setItem('chapters', ch.id, ch);
                    state.completedChapters++;
                    console.log(`[PIPELINE] ✅ 第${ch.chapterNumber}章素材管理补跑完成`);
                } catch (matErr) {
                    console.error(`[PIPELINE] 第${ch.chapterNumber}章素材管理补跑失败:`, matErr.message);
                    ch._matManagerRetries = (ch._matManagerRetries || 0) + 1;
                    if (ch._matManagerRetries >= 3) {
                        ch.status = 'material-updated';
                        ch.materialManagerOutput = `[素材管理补跑失败${ch._matManagerRetries}次，跳过]`;
                        state.completedChapters++;
                        console.warn(`[PIPELINE] 第${ch.chapterNumber}章素材管理补跑${ch._matManagerRetries}次均失败，标记为material-updated跳过`);
                    } else {
                        console.warn(`[PIPELINE] 第${ch.chapterNumber}章素材管理补跑失败(${ch._matManagerRetries}/3)，保持approved状态等待下次补跑`);
                    }
                    ch.updatedAt = new Date().toISOString();
                    await store.setItem('chapters', ch.id, ch);
                }
            }

            if (effectiveStopChapter && state.completedChapters >= effectiveStopChapter) {
                addLog(`已达到项目目标章数 ${effectiveStopChapter}，停止`);
                break;
            }

            if (targetWordCount) {
                const allChapters = store.queryItems('chapters', { projectId }).filter(c => (c.status === 'material-updated' || c.status === 'approved') && c.content);
                const totalWords = allChapters.reduce((sum, c) => sum + (c.content || '').length, 0);
                if (totalWords >= targetWordCount) {
                    addLog(`已达到项目目标字数 ${targetWordCount}（当前${totalWords}字），停止`);
                    break;
                }
            }

            chapters = store.queryItems('chapters', { projectId }).sort((a, b) => a.chapterNumber - b.chapterNumber);

            for (const ch of chapters) {
                if ((ch.status === 'failed-skipped' || ch.status === 'timeout-skipped' || ch.status === 'context-error') && ch.skipUntil && ch.skipUntil <= Date.now()) {
                    const retries = ch._pipelineRetries || 0;
                    if (retries >= MAX_CHAPTER_RETRIES) {
                        ch.status = 'permanently-skipped';
                        delete ch.skipUntil;
                        ch.updatedAt = new Date().toISOString();
                        await store.setItem('chapters', ch.id, ch);
                        addLog(`第${ch.chapterNumber}章 冷却完成但已达最大重试次数(${MAX_CHAPTER_RETRIES})，永久跳过`);
                    } else {
                        ch.status = 'outlined';
                        delete ch.skipUntil;
                        ch._wordCountRetry = 0;
                        ch.updatedAt = new Date().toISOString();
                        await store.setItem('chapters', ch.id, ch);
                        addLog(`第${ch.chapterNumber}章 冷却完成，重新加入待处理队列(重试${retries}/${MAX_CHAPTER_RETRIES})`);
                    }
                }
            }

            for (const ch of chapters) {
                if (STUCK_STATUSES.includes(ch.status)) {
                    addLog(`第${ch.chapterNumber}章 状态异常(${ch.status})，重置为outlined`);
                    ch.status = 'outlined';
                    delete ch.skipUntil;
                    ch.updatedAt = new Date().toISOString();
                    await store.setItem('chapters', ch.id, ch);
                }
            }

            for (const ch of chapters) {
                if (ch.status === 'pipeline-failed') {
                    ch.status = 'outlined';
                    delete ch.skipUntil;
                    ch.updatedAt = new Date().toISOString();
                    await store.setItem('chapters', ch.id, ch);
                    addLog(`第${ch.chapterNumber}章 pipeline-failed状态重置为outlined`);
                }
            }

            const outlinedChapters = chapters.filter(ch => {
                if (ch.status !== 'outlined' && ch.status !== 'draft') return false;
                if (ch.skipUntil && ch.skipUntil > Date.now()) return false;
                return true;
            });
            const permanentlySkippedChapters = chapters.filter(ch => ch.status === 'permanently-skipped');
            const failedSkippedChapters = chapters.filter(ch => (ch.status === 'failed-skipped' || ch.status === 'timeout-skipped' || ch.status === 'context-error') && ch.skipUntil && ch.skipUntil > Date.now());

            if (permanentlySkippedChapters.length > 0) {
                for (const pch of permanentlySkippedChapters) {
                    if (pch.status !== 'permanently-skipped') {
                        pch.status = 'permanently-skipped';
                        pch.updatedAt = new Date().toISOString();
                        await store.setItem('chapters', pch.id, pch);
                        addLog(`第${pch.chapterNumber}章 已达最大重试次数(${MAX_CHAPTER_RETRIES})，永久跳过`);
                    }
                }
            }

            if (failedSkippedChapters.length > 0) {
                const earliestFailed = chapters.find(ch =>
                    (ch.status === 'failed-skipped' || ch.status === 'timeout-skipped' || ch.status === 'context-error') &&
                    ch.skipUntil && ch.skipUntil > Date.now() &&
                    (ch._pipelineRetries || 0) < MAX_CHAPTER_RETRIES
                );
                const earliestPermanent = chapters.find(ch =>
                    ch.status === 'permanently-skipped' &&
                    (ch._pipelineRetries || 0) >= MAX_CHAPTER_RETRIES
                );
                if (earliestFailed && outlinedChapters.length > 0) {
                    const failedNum = earliestFailed.chapterNumber;
                    const nextNum = outlinedChapters[0].chapterNumber;
                    if (nextNum > failedNum) {
                        const waitMs = Math.min(earliestFailed.skipUntil - Date.now(), 60000);
                        addLog(`第${failedNum}章冷却中，等待${Math.ceil(waitMs / 1000)}秒后重试，不跳到第${nextNum}章`);
                        await new Promise(r => setTimeout(r, waitMs));
                        continue;
                    }
                }
                if (earliestPermanent && outlinedChapters.length > 0) {
                    const permNum = earliestPermanent.chapterNumber;
                    const nextNum = outlinedChapters[0].chapterNumber;
                    if (nextNum > permNum) {
                        addLog(`第${permNum}章已永久跳过，允许继续第${nextNum}章`);
                    }
                }
            }

            if (outlinedChapters.length > 0) {
                const ch = outlinedChapters[0];
                state.phase = 'full-pipeline';
                state.currentChapter = ch.chapterNumber;
                state.batchProgress = `第${ch.chapterNumber}章 ${ch.title}`;
                addLog(`━━━ 第${ch.chapterNumber}章 ${ch.title} 开始完整流水线 ━━━`);

                try {
                    const result = await getRunFullPipelineFn()(projectId, ch.id, maxRounds, {
                        generateImages: false,
                        onStep: ({ step, round, passed, roleName, feedback, chapterNumber }) => {
                            if (state.stopped) {
                                addLog(`停止信号已接收，中断第${ch.chapterNumber}章处理`);
                                throw new Error('PIPELINE_STOPPED');
                            }
                            const structuredData = { step, round, passed, roleName, chapterNumber: chapterNumber || ch.chapterNumber };
                            if (step === 'intent-planner') {
                                const detailParts = [];
                                if (feedback?.mustKeep?.length) detailParts.push(`✅保持: ${feedback.mustKeep.join(' | ')}`);
                                if (feedback?.mustAvoid?.length) detailParts.push(`🚫避免: ${feedback.mustAvoid.join(' | ')}`);
                                if (feedback?.conflictDesign) detailParts.push(`⚔️冲突: ${feedback.conflictDesign}`);
                                if (feedback?.chapterEndHook) detailParts.push(`🪝钩子: ${feedback.chapterEndHook}`);
                                if (feedback?.hookAdvance?.length) detailParts.push(`📌推进: ${feedback.hookAdvance.join(' | ')}`);
                                if (feedback?.hookResolve?.length) detailParts.push(`🔓回收: ${feedback.hookResolve.join(' | ')}`);
                                const detailStr = detailParts.length > 0 ? ` | ${detailParts.join(' → ')}` : '';
                                addLog(`  [意图规划] 🎯 ${feedback?.summary || ''}${detailStr}`, { ...structuredData, feedback: { summary: feedback?.summary } });
                                return;
                            }
                            const status = passed ? '✅通过' : '❌未通过';
                            let msg = `  [R${round} ${roleName}] ${status}`;
                            if (feedback) {
                                const summary = feedback.summary || '';
                                if (summary) msg += ` → ${summary.substring(0, 80)}`;
                                if (feedback._autoCorrected) msg += ' [自动修正]';
                            }
                            addLog(msg, { ...structuredData, feedback: feedback ? { summary: feedback.summary?.substring(0, 200) } : undefined });
                        }
                    });

                    if (result.success) {
                        state.completedChapters++;
                        state._consecutiveSupplementFails = 0;
                        const uc = store.getItem('chapters', ch.id);
                        if (uc) {
                            uc._pipelineRetries = 0;
                            await store.setItem('chapters', ch.id, uc);
                        }

                        try {
                            const totalCompleted = state.completedChapters;
                            let volumeOrderConfig = null;
                            try { volumeOrderConfig = getVolumeOrder(projectId); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
                            if (!volumeOrderConfig?.volumeOrder) {
                                const lockedPlanes = store.queryItems('materials', { projectId }).filter(m => m.type === 'sub-plane' && m.isLocked);
                                if (lockedPlanes.length > 0 && totalCompleted > 0 && totalCompleted % 30 === 0) {
                                    const idx = Math.floor(Math.random() * lockedPlanes.length);
                                    const planeToUnlock = lockedPlanes[idx];
                                    planeToUnlock.isLocked = false;
                                    planeToUnlock.unlockChapter = totalCompleted;
                                    planeToUnlock.updatedAt = new Date().toISOString();
                                    await store.setItem('materials', planeToUnlock.id, planeToUnlock);
                                    addLog(`🔓 次位面解封：${planeToUnlock.name}（第${totalCompleted}章完成触发）`);
                                }
                            }
                        } catch (unlockErr) {
                            console.warn('[PIPELINE] Sub-plane unlock check failed:', unlockErr.message);
                        }
                        const normalLen = (uc?.normalContent || uc?.content || '').length;
                        const polishedLen = (uc?.polishedContent || '').length;

                        let hookInfo = '';
                        try {
                            const hookBudget = getHookBudgetForProject(projectId);
                            const budgetStatus = hookBudget.getBudgetStatus(ch.chapterNumber);
                            hookInfo = ` | 伏笔${budgetStatus.activeCount}/${budgetStatus.maxCapacity}`;
                            if (budgetStatus.overCapacity) hookInfo += ' 🚨超限';
                            else if (budgetStatus.nearCapacity) hookInfo += ' ⚠近满';
                        } catch (e) {}

                        addLog(`━━━ 第${ch.chapterNumber}章 完成 ✅(${result.rounds}轮| 正常版${normalLen}字| 润色版${polishedLen}字${hookInfo}) ━━━`);

                        if (ch._needsReReview) {
                            ch._needsReReview = false;
                            ch.needsReReview = true;
                            await store.setItem('chapters', ch.id, ch);
                            addLog(`🔄 第${ch.chapterNumber}章已标记需要重新审核（返修后）`);
                        }

                        try { materialIndex.rebuildIndex(projectId); materialIndex.invalidateCache(projectId); } catch (e) {}

                        try {
                            const { PromptOptimizer } = require('./promptOptimizer');
                            const opt = new PromptOptimizer(projectId);
                            const detection = opt.detectProblemPatterns(5);
                            if (detection.patterns.length > 0) {
                                const criticalPatterns = detection.patterns.filter(p => p.severity === 'critical' || p.severity === 'high');
                                if (criticalPatterns.length > 0) {
                                    addLog(`🔍 提示词优化器检测到${criticalPatterns.length}个高频问题：${criticalPatterns.map(p => p.category + '(' + p.chapterCount + '章)').join('、')}`, { optimizerDetection: criticalPatterns });
                                }
                            }
                        } catch (e) { console.warn('[PIPELINE] Optimizer detection error:', e.message); }

                    } else {
                        const chNum = ch.chapterNumber;
                        const uc = store.getItem('chapters', ch.id);
                        const isWordCountFailure = result.failureType === 'word-count';
                        const isCircuitBreaker = result.message && result.message.includes('熔断');

                        if (uc) {
                            if (isWordCountFailure) {
                                uc._wordCountRetry = (uc._wordCountRetry || 0) + 1;
                                if (uc._wordCountRetry >= 5) {
                                    uc._pipelineRetries = (uc._pipelineRetries || 0) + 1;
                                    uc._wordCountRetry = 0;
                                    uc.status = 'outlined';
                                    delete uc.skipUntil;
                                    addLog(`━━━ 第${chNum}章 字数连续5次不达标 ❌(重试${uc._pipelineRetries}/${MAX_CHAPTER_RETRIES})，重置重试 ━━━`);
                                } else {
                                    uc.status = 'outlined';
                                    delete uc.skipUntil;
                                    addLog(`━━━ 第${chNum}章 字数不达标 ❌(第${uc._wordCountRetry}次)，直接重试 ━━━`);
                                }
                            } else {
                                uc._pipelineRetries = (uc._pipelineRetries || 0) + 1;
                                if (uc._pipelineRetries <= 3) {
                                    uc.status = 'outlined';
                                    delete uc.skipUntil;
                                    addLog(`━━━ 第${chNum}章 审核未通过 ❌(${result.rounds}轮| 重试${uc._pipelineRetries}/${MAX_CHAPTER_RETRIES})，立即重试 ━━━`);
                                } else {
                                    uc.status = 'failed-skipped';
                                    uc.skipUntil = Date.now() + 30000;
                                    addLog(`━━━ 第${chNum}章 审核未通过 ❌(${result.rounds}轮| 重试${uc._pipelineRetries}/${MAX_CHAPTER_RETRIES})，冷却30秒 ━━━`);
                                }
                            }
                            uc.updatedAt = new Date().toISOString();
                            await store.setItem('chapters', ch.id, uc);

                            if ((uc._pipelineRetries || 0) >= MAX_CHAPTER_RETRIES) {
                                uc.status = 'skipped';
                                uc.skipReason = 'max_retries_exceeded';
                                delete uc.skipUntil;
                                uc.updatedAt = new Date().toISOString();
                                await store.setItem('chapters', ch.id, uc);
                                addLog(`━━━ 第${chNum}章 已达重试上限(${MAX_CHAPTER_RETRIES})，永久跳过并继续下一章 ━━━`);
                                continue;
                            }
                        }
                    }
                } catch (err) {
                    if (err.message === 'PIPELINE_STOPPED') {
                        addLog(`第${ch.chapterNumber}章因停止信号中断，重置为outlined`);
                        const uc = store.getItem('chapters', ch.id);
                        if (uc) {
                            uc.status = 'outlined';
                            delete uc.skipUntil;
                            uc.updatedAt = new Date().toISOString();
                            await store.setItem('chapters', ch.id, uc);
                        }
                        break;
                    }
                    const chNum = ch.chapterNumber;
                    const uc = store.getItem('chapters', ch.id);
                    const isOverloaded = err.message && (err.message.includes('529') || err.message.includes('overloaded') || err.message.includes('rate limit'));
                    const isTimeout = err.message && (err.message.includes('超时') || err.message.includes('timeout'));

                    if (uc) {
                        if (isOverloaded || isTimeout) {
                            uc.status = 'outlined';
                            delete uc.skipUntil;
                        } else {
                            const isCodeBug = err.message && (err.message.includes('is not defined') || err.message.includes('ReferenceError') || err.message.includes('TypeError') || err.message.includes('Cannot read'));
                            const isRetryable = err.message && (err.message.includes('ETIMEDOUT') || err.message.includes('ECONNRESET') || err.message.includes('fetch failed') || err.message.includes('network'));
                            if (isCodeBug) {
                                console.error(`[PIPELINE] Code bug detected: ${err.message}. NOT counting as pipeline retry.`);
                                uc.status = 'outlined';
                                delete uc.skipUntil;
                            } else if (isRetryable) {
                                uc.status = 'outlined';
                                delete uc.skipUntil;
                            } else {
                                uc._pipelineRetries = (uc._pipelineRetries || 0) + 1;
                                if ((uc._pipelineRetries || 0) >= MAX_CHAPTER_RETRIES) {
                                    uc.status = 'permanently-skipped';
                                    delete uc.skipUntil;
                                    uc._skipReason = 'exception';
                                    try {
                                        const chContent = uc.content || '';
                                        const chOutline = uc.outline || ch.outline || '';
                                        const chTitle = uc.title || ch.title || '';
                                        if (chContent.length > 200) {
                                            try {
                                                uc.status = 'approved';
                                                await store.setItem('chapters', ch.id, uc);
                                                await getRunPipelineStep()(projectId, ch.id, 'material-manager', 1, { materialGuidance: '' });
                                            } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
                                            uc.status = 'permanently-skipped';
                                        }
                                        const bridgeData = {
                                            skippedChapter: chNum, title: chTitle, reason: 'exception',
                                            outline: chOutline.substring(0, 500),
                                            contentSummary: chContent.length > 200 ? chContent.substring(0, 500) : '（无有效内容）',
                                            narrativeBridge: `第${chNum}章因异常被跳过。大纲概要：${chOutline.substring(0, 200)}`
                                        };
                                        const smId = uuidv4();
                                        await store.setItem('materials', smId, {
                                            id: smId, projectId, type: 'narrative-bridge',
                                            name: `第${chNum}章叙事桥接`, description: bridgeData.narrativeBridge,
                                            initialContent: JSON.stringify(bridgeData, null, 2),
                                            currentContent: JSON.stringify(bridgeData, null, 2),
                                            sourceChapter: chNum,
                                            tags: ['auto-generated', 'narrative-bridge', 'skipped-chapter'],
                                            version: 1,
                                            changeLog: [{ action: 'auto-bridge', reason: `第${chNum}章异常跳过`, at: new Date().toISOString() }],
                                            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                                        });
                                    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
                                } else {
                                    uc.status = 'failed-skipped';
                                    uc.skipUntil = Date.now() + 60000;
                                }
                            }
                        }
                        uc.updatedAt = new Date().toISOString();
                        await store.setItem('chapters', ch.id, uc);
                    }

                    addLog(`━━━ 第${chNum}章 异常 ❌ ${err.message} ━━━`);
                    if (isOverloaded) {
                        addLog('API服务繁忙，等待60秒后继续...');
                        await waitWithStop(60000);
                    } else if (isTimeout) {
                        addLog('超时，等待30秒后重试...');
                        await waitWithStop(30000);
                    } else {
                        addLog('未知异常，等待15秒后继续...');
                        await waitWithStop(15000);
                    }
                }

                continue;
            }

            if (failedSkippedChapters.length > 0) {
                const minSkipUntil = Math.min(...failedSkippedChapters.map(ch => ch.skipUntil));
                const waitSec = Math.ceil((minSkipUntil - Date.now()) / 1000);
                addLog(`所有章节冷却中，等待${waitSec}秒后重试...`);
                await waitWithStop(Math.min(waitSec * 1000, 120000));
                continue;
            }

            const anyContentChapter = chapters.some(ch => ch.content && ch.content.length > 100);
            if (!anyContentChapter && chapters.length > 0) {
                const completedCount = chapters.filter(c => c.status === 'material-updated' || c.status === 'approved').length;
                if (completedCount === 0) {
                    addLog('没有待处理章节且无已完成内容，停止');
                    break;
                }
            }

            const consecutiveSupplementFails = state._consecutiveSupplementFails || 0;
            if (consecutiveSupplementFails >= 3) {
                addLog('连续3次补充大纲后无可用章节，停止');
                break;
            }

            if (state.supplementCount >= maxSupplements) {
                addLog(`已达到最大补充次数(${maxSupplements})，停止`);
                break;
            }

            const completedChapterCount = chapters.filter(c => c.status === 'material-updated' || c.status === 'approved').length;
            if (stopAfterChapter && completedChapterCount >= stopAfterChapter) {
                addLog(`已完成 ${completedChapterCount} 章，达到目标 ${stopAfterChapter} 章，停止（不补充新大纲）`);
                break;
            }
            const currentVol = Math.floor(completedChapterCount / 30) + 1;
            const chapterInVol = completedChapterCount % 30;
            const isVolComplete = chapterInVol === 0 && completedChapterCount > 0;
            const previousVol = currentVol - 1;
            let smartBatchSize = chaptersPerBatch;
            if (isVolComplete) {
                smartBatchSize = 30;
            } else if (chapterInVol > 0) {
                const remainingInVol = 30 - chapterInVol;
                smartBatchSize = Math.min(chaptersPerBatch, remainingInVol);
            }

            state.supplementCount++;
            state.phase = 'supplement';
            state.batchProgress = `补充大纲 #${state.supplementCount}`;
            if (isVolComplete) {
                addLog(`第${previousVol}卷已完成 ✅ 自动开始第${currentVol}卷，补充${smartBatchSize}章新大纲...`);
            } else {
                addLog(`第${currentVol}卷进行中(卷内第${chapterInVol}章)，补充${smartBatchSize}章大纲...`);
            }

            let supplementResult = null;
            let supplementRetries = 0;
            let lastSupplementError = '';
            let retryHint = '';
            while (supplementRetries < 5) {
                try {
                    const maxChapterNum = chapters.length > 0 ? Math.max(...chapters.map(c => c.chapterNumber || 0)) : 0;
                    supplementResult = await supplementChapterOutlines(projectId, maxChapterNum, smartBatchSize, retryHint);
                    if (supplementResult?.created?.length > 0) break;
                    lastSupplementError = supplementResult?.error || supplementResult?.reason || '未知原因';
                    if (supplementResult?.rhythmIssues?.length) {
                        retryHint = `上次大纲被拒原因：${supplementResult.rhythmIssues.join('；')}。必须修正：1.只使用本卷指定次位面 2.scene字段必须填写"主世界"或本卷次位面名 3.不要在outline中提及任何锁定次位面`;
                    }
                    addLog(`补充大纲第${supplementRetries + 1}次失败: ${lastSupplementError}`);
                } catch (sErr) {
                    lastSupplementError = sErr.message;
                    addLog(`补充大纲异常: ${sErr.message}`);
                }
                supplementRetries++;
                if (supplementRetries < 5) await waitWithStop(10000);
            }

            if (!supplementResult?.created?.length) {
                addLog(`补充大纲5次均失败，最后错误: ${lastSupplementError}，停止`);
                break;
            }
            addLog(`补充了${supplementResult.count} 章新大纲`);

            const newChapters = store.queryItems('chapters', { projectId }).sort((a, b) => a.chapterNumber - b.chapterNumber);
            const newOutlined = newChapters.filter(ch => (ch.status === 'outlined' || ch.status === 'draft') && (!ch.skipUntil || ch.skipUntil < Date.now()));
            if (newOutlined.length === 0) {
                state._consecutiveSupplementFails = (state._consecutiveSupplementFails || 0) + 1;
                addLog(`补充大纲后仍无可用章，(${state._consecutiveSupplementFails}/3)`);
            } else {
                state._consecutiveSupplementFails = 0;
            }
        }
    } finally {
        clearInterval(_heartbeatTimer);
        state.running = false;
        state.stopped = false;
        if (state.logs.length > MAX_IN_MEMORY_LOGS) state.logs = state.logs.slice(-Math.floor(MAX_IN_MEMORY_LOGS * 0.6));
        try {
            await store.setItem('infinite-pipeline-state', projectId, {
                id: projectId,
                projectId,
                running: false,
                stopped: false,
                currentChapter: state.currentChapter,
                completedChapters: state.completedChapters,
                supplementCount: state.supplementCount,
                phase: 'stopped',
                batchProgress: state.batchProgress,
                lastHeartbeat: state.lastHeartbeat,
                logs: state.logs.slice(-200),
                updatedAt: new Date().toISOString()
            });
        } catch (persistErr) {
            console.warn('[INFINITE] Failed to persist final state:', persistErr.message);
        }
        setTimeout(() => {
            delete INFINITE_PIPELINE_STATE[projectId];
            console.log(`[INFINITE] Cleaned up in-memory state for project ${projectId}`);
        }, STATE_CLEANUP_DELAY_MS);
    }

    return {
        success: true,
        completedChapters: state.completedChapters,
        logs: state.logs
    };
}

async function stopInfinitePipeline(projectId) {
    if (INFINITE_PIPELINE_STATE[projectId]) {
        INFINITE_PIPELINE_STATE[projectId].stopped = true;
        INFINITE_PIPELINE_STATE[projectId].running = false;
        const RESET_STATUSES = ['failed-skipped', 'timeout-skipped', 'context-error', 'permanently-skipped', 'pipeline-failed'];
        try {
            const chapters = store.queryItems('chapters', { projectId });
            for (const ch of chapters) {
                const needsReset = STUCK_STATUSES.includes(ch.status) || RESET_STATUSES.includes(ch.status);
                if (needsReset) {
                    const oldStatus = ch.status;
                    ch.status = 'outlined';
                    delete ch.skipUntil;
                    ch._pipelineRetries = 0;
                    ch._wordCountRetry = 0;
                    delete ch._skipReason;
                    ch.updatedAt = new Date().toISOString();
                    await store.setItem('chapters', ch.id, ch);
                    console.log(`[PIPELINE] Stop cleanup: Ch${ch.chapterNumber} reset from ${oldStatus} to outlined`);
                    if (STUCK_STATUSES.includes(oldStatus)) {
                        const chReviews = store.listItems('reviews').filter(r => r.chapterId === ch.id);
                        chReviews.forEach(r => store.deleteItem('reviews', r.id));
                        if (chReviews.length > 0) console.log(`[PIPELINE] Stop cleanup: Ch${ch.chapterNumber} deleted ${chReviews.length} reviews`);
                        const chMaterials = store.queryItems('materials', { projectId }).filter(m => m.sourceChapter === ch.chapterNumber && !store.isFoundationMaterial(m));
                        chMaterials.forEach(m => store.deleteItem('materials', m.id));
                        if (chMaterials.length > 0) console.log(`[PIPELINE] Stop cleanup: Ch${ch.chapterNumber} deleted ${chMaterials.length} materials (foundation protected)`);
                    }
                }
            }
        } catch (e) {
            console.warn('[PIPELINE] Stop cleanup failed:', e.message);
        }
        setTimeout(() => {
            delete INFINITE_PIPELINE_STATE[projectId];
            console.log(`[INFINITE] Cleaned up in-memory state for project ${projectId} after stop`);
        }, STATE_CLEANUP_DELAY_MS);
        return { success: true, message: 'Stop signal sent. Pipeline will stop immediately. Stuck chapters, reviews and materials cleaned up.' };
    }
    return { success: true, message: 'No running pipeline (already stopped)' };
}

async function forceResetPipeline(projectId) {
    if (INFINITE_PIPELINE_STATE[projectId]) {
        INFINITE_PIPELINE_STATE[projectId].stopped = true;
        INFINITE_PIPELINE_STATE[projectId].running = false;
    }
    delete INFINITE_PIPELINE_STATE[projectId];
    try {
        const persisted = store.getItem('infinite-pipeline-state', projectId);
        if (persisted) {
            persisted.running = false;
            persisted.stopped = false;
            persisted.updatedAt = new Date().toISOString();
            await store.setItem('infinite-pipeline-state', projectId, persisted);
        } else {
            store.deleteItem('infinite-pipeline-state', projectId);
        }
    } catch (resetErr) {
        console.warn('[INFINITE] Force reset persist failed:', resetErr.message);
        try { store.deleteItem('infinite-pipeline-state', projectId); } catch (delErr) { console.warn('[INFINITE] Force delete failed:', delErr.message); }
    }
    const allLogs = store.listItems('pipeline-logs');
    (allLogs || []).forEach(l => {
        if (l.projectId === projectId) {
            try { store.deleteItem('pipeline-logs', l.id); } catch (delErr) { console.warn('[INFINITE] Pipeline log delete failed:', delErr.message); }
        }
    });
    return { success: true, message: 'Pipeline state and logs reset' };
}

function getInfinitePipelineStatus(projectId) {
    const state = INFINITE_PIPELINE_STATE[projectId];
    if (!state) {
        const persisted = store.getItem('infinite-pipeline-state', projectId);
        if (persisted) {
            return {
                running: persisted.running || false,
                stopped: persisted.stopped || false,
                currentChapter: persisted.currentChapter || null,
                completedChapters: persisted.completedChapters || 0,
                supplementCount: persisted.supplementCount || 0,
                lastError: null,
                phase: persisted.phase || (persisted.running ? 'running' : 'stopped'),
                batchProgress: persisted.batchProgress || '',
                lastHeartbeat: persisted.lastHeartbeat || null,
                logs: (persisted.logs || []).slice(-30)
            };
        }
        return { running: false };
    }
    return {
        running: state.running,
        stopped: state.stopped,
        currentChapter: state.currentChapter,
        completedChapters: state.completedChapters,
        supplementCount: state.supplementCount || 0,
        lastError: state.lastError || null,
        phase: state.phase || '',
        batchProgress: state.batchProgress || '',
        logs: state.logs.slice(-30)
    };
}

function cleanupStalePipelineStates() {
    let cleaned = 0;
    try {
        const allStates = store.listItems('infinite-pipeline-state');
        for (const state of allStates) {
            if (!state.running) continue;
            const lastHb = state.lastHeartbeat || 0;
            const updatedAt = new Date(state.updatedAt || 0).getTime();
            const lastSignal = Math.max(lastHb, updatedAt);
            const staleMs = Date.now() - lastSignal;
            if (staleMs > HEARTBEAT_STALE_THRESHOLD_MS) {
                console.warn(`[INFINITE] 🧟 Zombie pipeline detected for project ${state.projectId}, last heartbeat ${Math.round(staleMs / 1000)}s ago. Auto-resetting.`);
                forceResetPipeline(state.projectId);
                const chapters = store.queryItems('chapters', { projectId: state.projectId });
                for (const ch of chapters) {
                    if (STUCK_STATUSES.includes(ch.status) || ch.status === 'pipeline-failed') {
                        ch.status = 'outlined';
                        delete ch.skipUntil;
                        ch._pipelineRetries = 0;
                        ch._wordCountRetry = 0;
                        ch.updatedAt = new Date().toISOString();
                        store.setItem('chapters', ch.id, ch);
                    }
                }
                cleaned++;
            }
        }
    } catch (e) {
        console.warn('[INFINITE] Stale state cleanup failed:', e.message);
    }
    return cleaned;
}

module.exports = {
    runInfinitePipeline,
    stopInfinitePipeline,
    forceResetPipeline,
    getInfinitePipelineStatus,
    setRunFullPipelineRef,
    setRunPipelineStepRef,
    cleanupStalePipelineStates
};
