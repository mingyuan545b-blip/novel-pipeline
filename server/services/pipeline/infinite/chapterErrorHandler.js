const store = require("../../../store");
const { v4: uuidv4 } = require('uuid');
const { isLLMOverloaded, isLLMTimeout, isCodeBug, isNetworkError } = require("../../../shared/errors");
const { LLM_DEFAULTS } = require("../../../config/systemConfig");
const { MAX_CHAPTER_RETRIES, COOLDOWN_STEPS } = require("./chapterScheduler");
const pipelineRegistry = require("../../pipelineRegistry");
const logger = require("../../../shared/logger");
const { STATUS_VALUES } = require("../../chapterStatus");
const { isGateError } = require("../materialGate");

function getRunPipelineStep() {
    try { return pipelineRegistry.getStepFn(); } catch (e) { return null; }
}

function getCooldownMs(retryCount) {
    const idx = Math.min(retryCount - 1, COOLDOWN_STEPS.length - 1);
    return COOLDOWN_STEPS[Math.max(0, idx)];
}

async function forceMaterialUpdate(projectId, ch, uc) {
    try {
        const content = uc.content || uc.normalContent || '';
        if (content.length < 100) {
            logger.warn('infinitePipeline', 'Chapter content too short for material update', { chNum: ch.chapterNumber, len: content.length });
            return;
        }
        const savedStatus = uc.status;
        uc.status = STATUS_VALUES.APPROVED;
        await store.setItem('chapters', ch.id, uc);
        const runStep = getRunPipelineStep();
        if (runStep) {
            await runStep(projectId, ch.id, 'material-manager', 1, { materialGuidance: '强制素材更新：章节未通过审核但需更新素材以保证连续性' });
        }
        uc.status = savedStatus;
        await store.setItem('chapters', ch.id, uc);
        logger.info('infinitePipeline', 'Forced material update completed', { chNum: ch.chapterNumber });
    } catch (err) {
        logger.warn('infinitePipeline', 'Forced material update failed', { chNum: ch.chapterNumber, errMsg: err.message });
    }
}

async function handleException(projectId, ch, err, state, addLog, waitWithStop) {
    if (err.message === 'PIPELINE_STOPPED') {
        addLog(`第${ch.chapterNumber}章因停止信号中断，重置为outlined`);
        const uc = await store.getItem('chapters', ch.id);
        if (uc) {
            uc.status = STATUS_VALUES.OUTLINED;
            delete uc.skipUntil;
            uc.updatedAt = new Date().toISOString();
            await store.setItem('chapters', ch.id, uc);
        }
        return { success: false, stopped: true };
    }

    // P1-4a 章节因果门槛：前序章节素材未归档 → 本章不开工。
    // 不记本章重试、不进冷却（缺素材是前章的问题，不该罚本章），回到 outlined 等待缺口消解。
    if (isGateError(err)) {
        const gateUc = await store.getItem('chapters', ch.id);
        if (gateUc) {
            gateUc.status = STATUS_VALUES.OUTLINED;
            delete gateUc.skipUntil;
            gateUc.updatedAt = new Date().toISOString();
            await store.setItem('chapters', ch.id, gateUc);
        }
        addLog(`🚧 第${ch.chapterNumber}章暂不开工 — ${err.message}`, { gateBlocked: true, chapterNumber: ch.chapterNumber, step: 'material-gate' });
        return { success: false, stopped: false, gateBlocked: true };
    }

    const chNum = ch.chapterNumber;
    const uc = await store.getItem('chapters', ch.id);
    const isOverloaded = isLLMOverloaded(err);
    const isTimeout = isLLMTimeout(err);
    const isCodeBugErr = isCodeBug(err);
    const isRetryable = isNetworkError(err);

    if (uc) {
        if (isOverloaded) {
            uc.status = STATUS_VALUES.OUTLINED;
            uc.skipUntil = Date.now() + LLM_DEFAULTS.overloadedWaitMs;
        } else if (isTimeout) {
            uc.status = STATUS_VALUES.OUTLINED;
            uc.skipUntil = Date.now() + LLM_DEFAULTS.timeoutWaitMs;
        } else if (isCodeBugErr) {
            logger.error('infinitePipeline', 'Code bug detected, NOT counting as pipeline retry', { errMessage: err.message });
            uc.status = STATUS_VALUES.OUTLINED;
            delete uc.skipUntil;
        } else if (isRetryable) {
            uc.status = STATUS_VALUES.OUTLINED;
            delete uc.skipUntil;
        } else {
            uc._pipelineRetries = (uc._pipelineRetries || 0) + 1;
            if ((uc._pipelineRetries || 0) >= MAX_CHAPTER_RETRIES) {
                await forceMaterialUpdate(projectId, ch, uc);
                const cooldownMs = getCooldownMs(uc._pipelineRetries);
                uc.status = 'cooldown-waiting';
                uc.skipUntil = Date.now() + cooldownMs;
                uc._skipReason = 'exception-cooldown';
                addLog(`━━━ 第${chNum}章 异常重试${uc._pipelineRetries}次，进入梯度冷却${cooldownMs/1000}秒（永不放弃） ━━━`);
            } else {
                uc.status = 'failed-skipped';
                uc.skipUntil = Date.now() + LLM_DEFAULTS.overloadedWaitMs;
            }
        }
        uc.updatedAt = new Date().toISOString();
        await store.setItem('chapters', ch.id, uc);
    }

    addLog(`━━━ 第${chNum}章 异常 ❌ ${err.message} ━━━`);

    if (isOverloaded) {
        addLog(`API服务繁忙/限流，等待${LLM_DEFAULTS.overloadedWaitMs/1000}秒后继续...`);
        await waitWithStop(LLM_DEFAULTS.overloadedWaitMs);
        return { success: false, stopped: false, overloaded: true };
    } else if (isTimeout) {
        addLog(`超时，等待${LLM_DEFAULTS.timeoutWaitMs/1000}秒后重试...`);
        await waitWithStop(LLM_DEFAULTS.timeoutWaitMs);
    } else if (!isCodeBugErr && !isRetryable) {
        addLog('未知异常，等待15秒后继续...');
        await waitWithStop(15000);
    }

    return { success: false, stopped: false, overloaded: isOverloaded };
}

async function createNarrativeBridge(projectId, chNum, uc, ch) {
    try {
        const chContent = uc.content || '';
        const chOutline = uc.outline || ch.outline || '';
        const chTitle = uc.title || ch.title || '';
        const bridgeData = {
            skippedChapter: chNum, title: chTitle, reason: 'cooldown',
            outline: chOutline.substring(0, 500),
            contentSummary: chContent.length > 200 ? chContent.substring(0, 500) : '（无有效内容）',
            narrativeBridge: `第${chNum}章进入冷却等待。大纲概要：${chOutline.substring(0, 200)}`
        };
        const smId = uuidv4();
        await store.setItem('materials', smId, {
            id: smId, projectId, type: 'narrative-bridge',
            name: `第${chNum}章叙事桥接`, description: bridgeData.narrativeBridge,
            initialContent: JSON.stringify(bridgeData, null, 2),
            currentContent: JSON.stringify(bridgeData, null, 2),
            sourceChapter: chNum,
            tags: ['auto-generated', 'narrative-bridge', 'cooldown-chapter'],
            version: 1,
            changeLog: [{ action: 'auto-bridge', reason: `第${chNum}章冷却等待`, at: new Date().toISOString() }],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
    } catch (_) { logger.warn('infinitePipeline', 'Narrative bridge creation failed', { errMsg: _.message || _ }); }  // DEGRADE: 影响=章节失败标记 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
}

module.exports = { handleException, createNarrativeBridge, forceMaterialUpdate };
