/**
 * 步骤循环的"轮次结果"工具（从 orchestratorStepLoop 拆出，保证单文件≤200行）。
 * 注意：刻意不放入 orchestratorRoundHelpers —— 该模块在单测里被 jest.mock。
 */
const logger = require('../../shared/logger');
const store = require('../../store');
const { LAST_ROUND_GRACE_RATIO: _GRACE_RATIO } = require('../../services/pipeline/pipelineHelpers');
const { clearDownstreamOutputs } = require('./orchestratorHelpers');
const { countWords } = require('../../services/pipeline/steps/expansionInstructionBuilder');

// 兜底：测试/裁剪场景下常量可能缺失，避免退化成 NaN 比较导致宽限静默失效
const LAST_ROUND_GRACE_RATIO = typeof _GRACE_RATIO === 'number' ? _GRACE_RATIO : 0.8;

/** 更新反馈列表：同标题已存在则覆盖，否则追加。 */
function upsertFeedbackPart(allFeedbackParts, header, feedback) {
    const idx = allFeedbackParts.findIndex(p => p.startsWith(header));
    if (idx >= 0) allFeedbackParts[idx] = header + '\n' + feedback;
    else allFeedbackParts.push(header + '\n' + feedback);
}

/**
 * writer 执笔失败后的处置：
 * 末轮且只是轻微不足（≥ rejectMin×宽限比）时宽限放行（继续走审核链，避免整章作废，
 * 20章E2E实测 ch6 三轮均 2413/2500=96% 仍被 writer 自身门禁掐断）；否则清理下游输出、判本轮失败。
 */
async function handleWriterGateFailure(projectId, chapterId, config, isLastRound) {
    const wcNow = countWords(((await store.getItem('chapters', chapterId)) || {}).content || '');
    const rejectMin = (config && config.word && config.word.rejectMin) || 0;
    if (isLastRound && rejectMin > 0 && wcNow >= Math.round(rejectMin * LAST_ROUND_GRACE_RATIO)) {
        logger.warn('pipeline', `末轮宽限：执笔${wcNow}字 < 最低${rejectMin}字（≥${Math.round(LAST_ROUND_GRACE_RATIO * 100)}%），继续走审核链`);
        return { roundFailed: false };
    }
    await clearDownstreamOutputs(chapterId, 'writer');
    return { roundFailed: true };
}

module.exports = { upsertFeedbackPart, handleWriterGateFailure };
