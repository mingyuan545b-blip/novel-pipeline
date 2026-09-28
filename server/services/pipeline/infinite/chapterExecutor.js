const store = require("../../../store");
const { v4: uuidv4 } = require('uuid');
const { getHookBudgetForProject } = require("../../hookBudget");
const materialIndex = require("../../materialIndex");
const { broadcastToProject } = require("../../websocket");
const { LLM_DEFAULTS } = require("../../../config/systemConfig");
const { MAX_CHAPTER_RETRIES, COOLDOWN_STEPS } = require("./chapterScheduler");
const pipelineRegistry = require("../../pipelineRegistry");
const { STATUS_VALUES } = require("../../chapterStatus");
const logger = require("../../../shared/logger");
const { wordCountDetail, reviewFailDetail, stepDetail, intentPlannerDetail } = require('./chapterLogDetails');
const { tryUnlockSubplane } = require('./subplaneUnlock');

let _runFullPipelineRef = null;
let _runPipelineStepRef = null;

function getRunFullPipelineFn() {
    if (typeof _runFullPipelineRef === 'function') return _runFullPipelineRef;
    _runFullPipelineRef = pipelineRegistry.getPipelineFn();
    return _runFullPipelineRef;
}

function getRunPipelineStep() {
    if (typeof _runPipelineStepRef === 'function') return _runPipelineStepRef;
    _runPipelineStepRef = pipelineRegistry.getStepFn();
    return _runPipelineStepRef;
}

function setRunFullPipelineRef(fn) { _runFullPipelineRef = fn; pipelineRegistry.registerPipelineFn(fn); }
function setRunPipelineStepRef(fn) { _runPipelineStepRef = fn; pipelineRegistry.registerStepFn(fn); }

async function executeChapter(projectId, ch, state, addLog, maxRounds, waitWithStop) {
    state.phase = 'full-pipeline';
    state.currentChapter = ch.chapterNumber;
    state.batchProgress = `第${ch.chapterNumber}章 ${ch.title}`;
    addLog(`━━━ 第${ch.chapterNumber}章 ${ch.title} 开始完整流水线 ━━━`);

    try {
        const result = await getRunFullPipelineFn()(projectId, ch.id, maxRounds, {
            onStep: ({ step, round, passed, roleName, feedback, chapterNumber }) => {
                if (state.stopped) {
                    addLog(`停止信号已接收，中断第${ch.chapterNumber}章处理`);
                    throw new Error('PIPELINE_STOPPED');
                }
                const structuredData = { step, round, passed, roleName, chapterNumber: chapterNumber || ch.chapterNumber };
                if (step === 'intent-planner') {
                    const detail = intentPlannerDetail(feedback);
                    addLog(`  [意图规划] 🎯 ${feedback?.summary || ''}${detail ? ' | ' + detail : ''}`,
                        { ...structuredData, detail, feedback: { summary: feedback?.summary } });
                    return;
                }
                const status = passed ? '✅通过' : '❌未通过';
                const summary = feedback?.summary || '';
                let msg = `  [R${round} ${roleName}] ${status}`;
                if (summary) msg += ` → ${summary.substring(0, 80)}`;
                if (feedback?._autoCorrected) msg += ' [自动修正]';
                addLog(msg, {
                    ...structuredData,
                    roleName,
                    // detail：给前端"执行日志"直接展示的细节（结论+前两条问题）
                    detail: stepDetail(feedback),
                    feedback: feedback ? { summary: feedback.summary?.substring(0, 200), issues: feedback.issues?.slice(0, 3) } : undefined,
                });
            }
        });

        if (result.success) {
            return await handleSuccess(projectId, ch, result, state, addLog);
        } else {
            return await handleFailure(projectId, ch, result, state, addLog);
        }
    } catch (err) {
        return await require("./chapterErrorHandler").handleException(projectId, ch, err, state, addLog, waitWithStop);
    }
}

async function handleSuccess(projectId, ch, result, state, addLog) {
    state.completedChapters++;
    state._consecutiveSupplementFails = 0;
    const uc = await store.getItem('chapters', ch.id);
    if (uc) {
        uc._pipelineRetries = 0;
        await store.setItem('chapters', ch.id, uc);
    }

    await tryUnlockSubplane(projectId, state.completedChapters, addLog);

    const normalLen = (uc?.normalContent || uc?.content || '').length;
    const polishedLen = (uc?.polishedContent || '').length;
    let hookInfo = '';
    try {
        const hookBudget = getHookBudgetForProject(projectId);
        const budgetStatus = hookBudget.getBudgetStatus(ch.chapterNumber);
        hookInfo = ` | 伏笔${budgetStatus.activeCount}/${budgetStatus.maxCapacity}`;
        if (budgetStatus.overCapacity) hookInfo += ' 🚨超限';
        else if (budgetStatus.nearCapacity) hookInfo += ' ⚠近满';
    } catch (e) { /* silent */ }

    addLog(`━━━ 第${ch.chapterNumber}章 完成 ✅(${result.rounds}轮| 正常版${normalLen}字| 润色版${polishedLen}字${hookInfo}) ━━━`);

    if (ch._needsReReview) {
        ch._needsReReview = false;
        ch.needsReReview = true;
        await store.setItem('chapters', ch.id, ch);
        addLog(`🔄 第${ch.chapterNumber}章已标记需要重新审核（返修后）`);
    }

    try { await materialIndex.rebuildIndex(projectId); materialIndex.invalidateCache(projectId); } catch (e) { /* silent */ }

    try {
        const { PromptOptimizer } = require('../../promptOptimizer');
        const opt = new PromptOptimizer(projectId);
        const detection = opt.detectProblemPatterns(5);
        if (detection.patterns.length > 0) {
            const criticalPatterns = detection.patterns.filter(p => p.severity === 'critical' || p.severity === 'high');
            if (criticalPatterns.length > 0) {
                addLog(`🔍 提示词优化器检测到${criticalPatterns.length}个高频问题：${criticalPatterns.map(p => p.category + '(' + p.chapterCount + '章)').join('、')}`, { optimizerDetection: criticalPatterns });
            }
        }
    } catch (e) { /* silent */ }

    return { success: true, stopped: false };
}

async function handleFailure(projectId, ch, result, state, addLog) {
    const chNum = ch.chapterNumber;
    const uc = await store.getItem('chapters', ch.id);
    const isWordCountFailure = result.failureType === 'word-count';
    broadcastToProject(projectId, 'pipeline:chapter-failed', { chapterNumber: chNum, reason: result.message || (isWordCountFailure ? 'word-count' : 'review-failed') });

    if (uc) {
        if (isWordCountFailure) {
            uc._wordCountRetry = (uc._wordCountRetry || 0) + 1;
            if (uc._wordCountRetry >= 5) {
                uc._pipelineRetries = (uc._pipelineRetries || 0) + 1;
                uc._wordCountRetry = 0;
                uc.status = STATUS_VALUES.OUTLINED;
                delete uc.skipUntil;
                addLog(`━━━ 第${chNum}章 字数连续5次不达标 ❌(重试${uc._pipelineRetries}/${MAX_CHAPTER_RETRIES})，重置重试 ━━━`,
                    { chapterNumber: chNum, step: 'word-count-fail', passed: false, detail: wordCountDetail(uc, result) });
            } else {
                uc.status = STATUS_VALUES.OUTLINED;
                delete uc.skipUntil;
                addLog(`━━━ 第${chNum}章 字数不达标 ❌(第${uc._wordCountRetry}次)，直接重试 ━━━`,
                    { chapterNumber: chNum, step: 'word-count-fail', passed: false, detail: wordCountDetail(uc, result) });
            }
        } else {
            uc._pipelineRetries = (uc._pipelineRetries || 0) + 1;
            if (uc._pipelineRetries <= 3) {
                uc.status = STATUS_VALUES.OUTLINED;
                delete uc.skipUntil;
                addLog(`━━━ 第${chNum}章 审核未通过 ❌(${result.rounds}轮| 重试${uc._pipelineRetries}/${MAX_CHAPTER_RETRIES})，立即重试 ━━━`,
                    { chapterNumber: chNum, step: 'review-fail', passed: false, detail: reviewFailDetail(result) });
            } else {
                uc.status = 'failed-skipped';
                uc.skipUntil = Date.now() + LLM_DEFAULTS.overloadCooldownMs;
                addLog(`━━━ 第${chNum}章 审核未通过 ❌(${result.rounds}轮| 重试${uc._pipelineRetries}/${MAX_CHAPTER_RETRIES})，冷却${LLM_DEFAULTS.overloadCooldownMs/1000}秒 ━━━`,
                    { chapterNumber: chNum, step: 'review-fail', passed: false, detail: reviewFailDetail(result) });
            }
        }
        uc.updatedAt = new Date().toISOString();
        await store.setItem('chapters', ch.id, uc);

        if ((uc._pipelineRetries || 0) >= MAX_CHAPTER_RETRIES) {
            const { forceMaterialUpdate } = require("./chapterErrorHandler");
            await forceMaterialUpdate(projectId, ch, uc);
            const cooldownIdx = Math.min((uc._pipelineRetries || 0) - 1, COOLDOWN_STEPS.length - 1);
            const cooldownMs = COOLDOWN_STEPS[Math.max(0, cooldownIdx)];
            uc.status = 'cooldown-waiting';
            uc.skipReason = 'max_retries_cooldown';
            uc.skipUntil = Date.now() + cooldownMs;
            uc.updatedAt = new Date().toISOString();
            await store.setItem('chapters', ch.id, uc);
            addLog(`━━━ 第${chNum}章 已达重试上限(${MAX_CHAPTER_RETRIES})，强制更新素材后进入梯度冷却${cooldownMs/1000}秒（永不放弃） ━━━`);
            return { success: false, stopped: false, cooldownWaiting: true };
        }
    }
    return { success: false, stopped: false };
}

module.exports = { executeChapter, setRunFullPipelineRef, setRunPipelineStepRef, getRunPipelineStep };
