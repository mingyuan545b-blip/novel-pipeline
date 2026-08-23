const { LLM_DEFAULTS } = require('../../config/systemConfig');
const store = require('../../store');
const { getInfinitePipelineStatus } = require('../../services/pipeline/infinitePipeline');
const logger = require('../../shared/logger');

const MAX_PIPELINE_LOG_ENTRIES = 200;

function checkStopped(projectId, chapterNumber, abortController) {
    try {
        const state = getInfinitePipelineStatus(projectId);
        if (state && state.running && state.stopped) {
            logger.info('pipeline', `Stop signal detected for ch${chapterNumber}`);
            if (abortController && !abortController.signal.aborted) abortController.abort();
            return true;
        }
    } catch (err) {
        logger.warn('pipeline', 'Check stopped error', { error: err.message });
    }
    return false;
}

function getSteps(config) {
    if (config?.flow?.skipSecondReview) return ['writer', 'fast-review', 'final-editor'];
    return ['writer', 'first-review', 'second-review', 'final-editor'];
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
    const ch = await store.getItem('chapters', chapterId);
    if (!ch) return;
    let cleared = false;
    const clearedFields = [];
    for (const f of fields) { if (ch[f]) { clearedFields.push(`${f}=${ch[f].substring(0, 30)}...`); delete ch[f]; cleared = true; } }
    if (cleared) { ch.updatedAt = new Date().toISOString(); await store.setItem('chapters', chapterId, ch); logger.debug('pipeline', `clearDownstreamOutputs: failedStep=${failedStep}, chapterId=${chapterId}, cleared: ${clearedFields.join(', ')}`); }
}

function generateOverrideOutput(overrideReason, stepName, originalFeedback) {
    const origSummary = originalFeedback?.summary || '（无原审核摘要）';
    const origIssues = (originalFeedback?.issues || []).slice(0, 3).map((i, idx) => {
        const desc = typeof i === 'string' ? i : (i.desc || i.description || JSON.stringify(i));
        return `${idx + 1}. ${desc}`;
    }).join('\n');
    return `## ${stepName}结果：✅ 系统覆盖通过\n\n### 覆盖原因\n${overrideReason}\n\n### 原审核意见\n**摘要**：${origSummary}\n${origIssues ? '**主要问题**：\n' + origIssues : ''}\n\n### 覆盖判定依据\n系统判定原审核意见不适用本项目审核标准，自动覆盖为通过。\n\n\`\`\`json\n${JSON.stringify({ passed: true, approved: true, _overridden: true, _overrideReason: overrideReason, summary: `系统覆盖通过：${overrideReason}`, issues: [], suggestions: [], _originalSummary: origSummary }, null, 2)}\n\`\`\``;
}

async function persistPipelineLog(chapterId, projectId, pipelineLog) {
    try {
        const logId = `${chapterId}_pipeline`;
        const entries = pipelineLog.map(e => ({ ...e, timestamp: e.timestamp || new Date().toISOString() }));
        const trimmed = entries.length > MAX_PIPELINE_LOG_ENTRIES ? entries.slice(-150) : entries;
        await store.setItem('pipeline-logs', logId, { id: logId, chapterId, projectId, entries: trimmed, updatedAt: new Date().toISOString() });
    } catch (err) { logger.warn('pipeline', 'Failed to persist pipeline log', { error: err.message }); }
}

module.exports = { MAX_PIPELINE_LOG_ENTRIES, checkStopped, getSteps, clearDownstreamOutputs, generateOverrideOutput, persistPipelineLog };
