/**
 * orchestratorFinalEditorHandler.js — 定稿人结果处理
 *
 * 从orchestratorStepHandlers.js拆分，含定稿人审批/拒绝/字数覆盖/多轮覆盖逻辑
 * 保持re-export完整（陷阱#1）
 */
const store = require('../../store');
const { formatFeedbackText, runPostApproval } = require('../../services/pipeline/pipelineHelpers');
const { STATUS_VALUES } = require('../../services/chapterStatus');
const characterStateCache = require('../../services/characterStateCache');
const { getCircuitBreaker } = require('../../services/reviewCircuitBreaker');
const { clearDownstreamOutputs, generateOverrideOutput, persistPipelineLog } = require('./orchestratorHelpers');
const { onPostApproval } = require('../../services/pipelineModuleRegistry');
const logger = require('../../shared/logger');

async function handleFinalEditorResult(stepResult, chapterId, projectId, chapter, round, pipelineLog, onStep, runPipelineStepFn, materialGuidance, options, chapterIntent, genre, mode, abortController) {
    const feApproved = stepResult.passed === true || stepResult.feedback?.approved === true || chapter.status === STATUS_VALUES.APPROVED;

    if (feApproved) {
        chapter = await store.getItem('chapters', chapterId);
        if (chapter) {
            chapter.normalContent = chapter.content;
            chapter.status = STATUS_VALUES.APPROVED;
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
        }
        const circuitBreaker = getCircuitBreaker(projectId);
        await runPostApproval(projectId, chapterId, chapter.chapterNumber, round, pipelineLog, onStep, {
            mode, materialGuidance, chapterIntent, circuitBreaker, genre
        });
        try { await characterStateCache.invalidateForProject(projectId); await characterStateCache.getCacheForChapter(projectId, chapter.chapterNumber + 1); } catch (_) { logger.warn('orchestratorFE', '[final-editor]', _.message || _); }
        await characterStateCache.commitSession(projectId, chapter.chapterNumber);
        try { await onPostApproval(projectId, chapter.chapterNumber, chapter.content || ''); } catch (_) { logger.warn('orchestratorFE', '[final-editor]', _.message || _); }
        await persistPipelineLog(chapterId, projectId, pipelineLog);
        return { success: true, rounds: round, log: pipelineLog, message: `Chapter approved after ${round} round(s)` };
    }

    logger.info('pipeline', `Final editor rejected in round ${round}`);
    const feSummary = (stepResult.feedback?.summary || '') + (stepResult.feedback?.scheduleNote || '');
    const feIssues = stepResult.feedback?.issues || [];
    const isWordCountRejection = /字数超限|字数过多|字数超标|超过.*字|超过上限|字数.*硬拦截/.test(feSummary) ||
        feIssues.some(i => /字数超|字数过多|超过/.test(i.description || i.desc || ''));

    if (isWordCountRejection) {
        return await _handleWordCountOverride(stepResult, chapterId, projectId, chapter, round, pipelineLog, onStep, runPipelineStepFn, materialGuidance, chapterIntent, genre, mode);
    }

    const maxRounds = options?.maxRounds || 3;
    // 轮次是跨运行累计的（startRound=chapter.round+1），覆盖判定必须用"本次运行内的相对轮次"，
    // 否则续跑章节（round≥5起步）首轮失败就被系统覆盖通过 → 用户看到"定稿莫名通过"
    const startRound = options?.startRound || 1;
    const relativeRound = Math.max(1, round - startRound + 1);
    const hasHardBlock = stepResult.feedback?._hardBlock === true ||
        (stepResult.feedback?.issues || []).some(i => i._hardBlock === true);
    if (relativeRound >= maxRounds && !hasHardBlock) {
        return await _handleMultiRoundOverride(stepResult, chapterId, projectId, chapter, round, pipelineLog, onStep, materialGuidance, chapterIntent, genre, mode, options);
    }

    const feedbackText = formatFeedbackText(stepResult.feedback);
    await clearDownstreamOutputs(chapterId, 'final-editor');
    return { roundFailed: true, lastFeedback: feedbackText, feedbackHeader: '【定稿人意见】' };
}

async function _handleWordCountOverride(stepResult, chapterId, projectId, chapter, round, pipelineLog, onStep, runPipelineStepFn, materialGuidance, chapterIntent, genre, mode) {
    logger.warn('pipeline', 'Final-editor word-count rejection auto-overridden');
    stepResult.passed = true;
    stepResult.feedback.approved = true;
    stepResult.feedback.summary = '系统覆盖通过：字数控制由流水线自动管理';
    pipelineLog.push(stepResult);

    chapter = await store.getItem('chapters', chapterId) || chapter;
    chapter.finalEditorOutput = generateOverrideOutput('字数控制由流水线自动管理', '定稿人', stepResult.feedback);
    chapter.status = STATUS_VALUES.APPROVED;
    chapter.approvedAt = new Date().toISOString();
    chapter.round = round;
    await store.setItem('chapters', chapterId, chapter);

    // 陷阱#91修复：此前字数覆盖分支直接调用material-manager后设status=material-updated，
    // 跳过了runPostApproval，导致polisher/material-organizer/material-registrar/knowledge-extraction
    // 全部不执行。连锁后果：character_states表0条/knowledgeChanges为空/角色素材无深度字段。
    // 修复：与feApproved和_handleMultiRoundOverride分支对齐，统一调用runPostApproval。
    const circuitBreaker = getCircuitBreaker(projectId);
    await runPostApproval(projectId, chapterId, chapter.chapterNumber, round, pipelineLog, onStep, {
        mode, materialGuidance, chapterIntent, circuitBreaker, genre
    });
    try { await characterStateCache.invalidateForProject(projectId); await characterStateCache.getCacheForChapter(projectId, chapter.chapterNumber + 1); } catch (_) { logger.warn('orchestratorFE', '[final-editor]', _.message || _); }
    await characterStateCache.commitSession(projectId, chapter.chapterNumber);
    try { await onPostApproval(projectId, chapter.chapterNumber, chapter.content || ''); } catch (_) { logger.warn('orchestratorFE', '[final-editor]', _.message || _); }
    await persistPipelineLog(chapterId, projectId, pipelineLog);
    return { success: true, rounds: round, log: pipelineLog, message: 'Chapter approved (word-count override)' };
}

async function _handleMultiRoundOverride(stepResult, chapterId, projectId, chapter, round, pipelineLog, onStep, materialGuidance, chapterIntent, genre, mode, options) {
    const overrideReason = `本次运行已返修${Math.max(1, round - (options?.startRound || 1) + 1)}轮仍未通过，且无hardBlock硬性违规，系统覆盖通过（剩余问题降级为suggestion）`;
    logger.info('pipeline', `Multi-round override for final-editor: ${overrideReason}`);
    stepResult.passed = true;
    stepResult.feedback = stepResult.feedback || {};
    stepResult.feedback.approved = true;
    stepResult.feedback.summary = `系统覆盖通过：${overrideReason}`;
    stepResult.feedback._overridden = true;
    stepResult.feedback._overrideReason = overrideReason;
    chapter = await store.getItem('chapters', chapterId);
    if (chapter) {
        chapter.finalEditorOutput = generateOverrideOutput(overrideReason, '定稿人', stepResult.feedback);
        chapter.normalContent = chapter.content;
        chapter.status = STATUS_VALUES.APPROVED;
        chapter.updatedAt = new Date().toISOString();
        await store.setItem('chapters', chapterId, chapter);
    }
    const circuitBreaker = getCircuitBreaker(projectId);
    await runPostApproval(projectId, chapterId, chapter.chapterNumber, round, pipelineLog, onStep, {
        mode, materialGuidance, chapterIntent, circuitBreaker, genre
    });
    try { await characterStateCache.invalidateForProject(projectId); await characterStateCache.getCacheForChapter(projectId, chapter.chapterNumber + 1); } catch (_) { logger.warn('orchestratorFE', '[final-editor]', _.message || _); }
    await characterStateCache.commitSession(projectId, chapter.chapterNumber);
    try { await onPostApproval(projectId, chapter.chapterNumber, chapter.content || ''); } catch (_) { logger.warn('orchestratorFE', '[final-editor]', _.message || _); }
    await persistPipelineLog(chapterId, projectId, pipelineLog);
    return { success: true, rounds: round, log: pipelineLog, message: `Chapter approved after ${round} round(s) (multi-round override)` };
}

module.exports = { handleFinalEditorResult };
