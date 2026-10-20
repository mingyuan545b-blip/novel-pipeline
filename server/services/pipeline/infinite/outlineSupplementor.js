const store = require("../../../store");
const { getVolumeOrder } = require("../volumeHelpers");
const logger = require("../../../shared/logger");
const { STATUS_VALUES } = require("../../chapterStatus");

const MAX_CONSECUTIVE_SUPPLEMENT_FAILS = 3;

function calculateSmartBatchSize(chapters, maxChapters) {
    const totalChapters = chapters.length;
    const completedChapters = chapters.filter(c => c.status === STATUS_VALUES.MATERIAL_UPDATED).length;
    const progress = totalChapters > 0 ? completedChapters / totalChapters : 0;
    if (progress < 0.3) return Math.min(5, maxChapters - totalChapters);
    if (progress < 0.6) return Math.min(3, maxChapters - totalChapters);
    return Math.min(2, maxChapters - totalChapters);
}

function checkSupplementPreconditions(chapters, maxChapters, addLog) {
    const totalChapters = chapters.length;
    const outlinedChapters = chapters.filter(c => c.status === STATUS_VALUES.OUTLINED || c.status === 'draft').length;
    const completedChapters = chapters.filter(c => c.status === STATUS_VALUES.MATERIAL_UPDATED).length;
    const cooldownChapters = chapters.filter(c => c.status === 'cooldown-waiting').length;
    const activeChapters = totalChapters - cooldownChapters;

    if (activeChapters === 0 && completedChapters === 0) {
        addLog('所有章节都在冷却等待中，等待冷却完成后继续');
        return { canProceed: false, result: { success: false, shouldStop: false } };
    }

    const availableForWork = outlinedChapters + chapters.filter(c =>
        (c.status === 'failed-skipped' || c.status === 'timeout-skipped' || c.status === 'context-error') &&
        c.skipUntil && c.skipUntil <= Date.now()
    ).length;

    if (availableForWork > 0) {
        return { canProceed: false, result: { success: true, newChapterCount: 0, shouldStop: false } };
    }

    return { canProceed: true, totalChapters, maxChapters };
}

async function handleMaxChaptersReached(chapters, maxChapters, addLog, waitWithStop) {
    const allProcessed = chapters.every(c =>
        c.status === STATUS_VALUES.MATERIAL_UPDATED || c.status === 'cooldown-waiting' ||
        c.status === 'failed-skipped' || c.status === 'timeout-skipped' || c.status === 'context-error'
    );
    if (allProcessed) {
        addLog(`已达到最大章节数(${maxChapters})且所有章节已处理完成`);
        return { handled: true, result: { success: true, newChapterCount: 0, shouldStop: true } };
    }
    const coolingChapters = chapters.filter(c =>
        (c.status === 'failed-skipped' || c.status === 'timeout-skipped' || c.status === 'context-error') &&
        c.skipUntil && c.skipUntil > Date.now()
    );
    if (coolingChapters.length > 0) {
        const earliestCoolEnd = Math.min(...coolingChapters.map(c => c.skipUntil));
        const waitMs = Math.max(earliestCoolEnd - Date.now(), 5000);
        addLog(`${coolingChapters.length}章冷却中，等待${Math.round(waitMs / 1000)}秒...`);
        await waitWithStop(waitMs);
        return { handled: true, result: { success: true, newChapterCount: 0, shouldStop: false } };
    }
    return { handled: true, result: { success: true, newChapterCount: 0, shouldStop: false } };
}

async function executeSupplementAttempt(projectId, batchSize, attemptNum, lastError) {
    let volumeGuidance = '';
    try {
        const volumeOrder = await getVolumeOrder(projectId);
        if (volumeOrder?.volumeOrder) {
            const currentVolume = volumeOrder.volumeOrder.find(v => !v.completed);
            if (currentVolume) volumeGuidance = `当前卷：${currentVolume.name}。请继续当前卷的章节。`;
        }
    } catch (_) { logger.warn('infinitePipeline', '[SILENT-CATCH]', { value1: _.message || _ }); }  // DEGRADE: 影响=getVolumeOrder 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    const supplementHint = attemptNum > 1 ? `（第${attemptNum}次尝试，上次失败：${lastError}。请确保：1.大纲与已有章节衔接 2.不重复已有情节 3.推进主线）` : '';
    const { generateChapterOutlines } = require("../outlineGenerator");
    return await generateChapterOutlines(projectId, `请根据已有章节进度，继续补充${batchSize}章大纲${volumeGuidance}${supplementHint}`, batchSize);
}

async function handleSupplementFailure(state, addLog, waitWithStop) {
    state._consecutiveSupplementFails = (state._consecutiveSupplementFails || 0) + 1;
    if (state._consecutiveSupplementFails >= MAX_CONSECUTIVE_SUPPLEMENT_FAILS) {
        addLog(`📋 补充大纲连续${MAX_CONSECUTIVE_SUPPLEMENT_FAILS}次失败，等待5分钟后重试`);
        state._consecutiveSupplementFails = 0;
        await waitWithStop(300000);
    } else {
        addLog('📋 补充大纲失败，等待60秒后继续...');
        await waitWithStop(60000);
    }
    return { success: false, newChapterCount: 0, shouldStop: false };
}

async function supplementOutlines(projectId, chapters, state, addLog, maxChapters, waitWithStop) {
    const preconditions = checkSupplementPreconditions(chapters, maxChapters, addLog);
    if (!preconditions.canProceed) return preconditions.result;

    const { totalChapters } = preconditions;
    if (maxChapters && totalChapters >= maxChapters) {
        const maxResult = await handleMaxChaptersReached(chapters, maxChapters, addLog, waitWithStop);
        if (maxResult.handled) return maxResult.result;
    }

    const smartBatchSize = calculateSmartBatchSize(chapters, maxChapters);
    if (smartBatchSize <= 0) return { success: true, newChapterCount: 0, shouldStop: false };

    addLog(`📋 补充大纲 (${smartBatchSize}章)...`);

    let supplementAttempts = 0;
    const maxSupplementAttempts = 2;
    let lastSupplementError = '';

    while (supplementAttempts < maxSupplementAttempts) {
        supplementAttempts++;
        try {
            const result = await executeSupplementAttempt(projectId, smartBatchSize, supplementAttempts, lastSupplementError);
            if (result.created?.length > 0) {
                state.supplementCount++;
                state._consecutiveSupplementFails = 0;
                addLog(`📋 补充了${result.count}章大纲（第${result.created[0]?.chapterNumber}~${result.created[result.created.length - 1]?.chapterNumber}章）`);
                return { success: true, newChapterCount: result.count, shouldStop: false };
            } else {
                lastSupplementError = result.error || result.rhythmIssues?.join('；') || 'unknown';
                addLog(`📋 补充大纲失败(第${supplementAttempts}次): ${lastSupplementError}`);
            }
        } catch (supplementErr) {
            lastSupplementError = supplementErr.message;
            addLog(`📋 补充大纲异常(第${supplementAttempts}次): ${supplementErr.message}`);
        }
        if (supplementAttempts < maxSupplementAttempts) {
            addLog('5秒后重试补充大纲...');
            await waitWithStop(5000);
        }
    }

    return await handleSupplementFailure(state, addLog, waitWithStop);
}

module.exports = { supplementOutlines, calculateSmartBatchSize, MAX_CONSECUTIVE_SUPPLEMENT_FAILS };
