const store = require("../../../store");
const { getHookBudgetForProject } = require("../../hookBudget");
const logger = require("../../../shared/logger");
const { STATUS_VALUES } = require("../../chapterStatus");

async function checkStopConditions(projectId, chapters, state, addLog, options) {
    const { effectiveStopChapter, targetWordCount, maxChapters } = options;

    if (effectiveStopChapter && state.completedChapters >= effectiveStopChapter) {
        const hookResult = await checkForeshadowing(projectId, chapters, state, addLog, effectiveStopChapter);
        if (hookResult.shouldStop) return { shouldStop: true };
    }

    if (targetWordCount) {
        const completedChapters = chapters.filter(c => (c.status === STATUS_VALUES.MATERIAL_UPDATED || c.status === STATUS_VALUES.APPROVED) && c.content);
        const totalWords = completedChapters.reduce((sum, c) => sum + (c.content || '').length, 0);
        if (totalWords >= targetWordCount) {
            addLog(`已达到项目目标字数 ${targetWordCount}（当前${totalWords}字），停止`);
            return { shouldStop: true };
        }
    }

    const anyContentChapter = chapters.some(ch => ch.content && ch.content.length > 100);
    const outlinedOrDraft = chapters.filter(ch => ch.status === STATUS_VALUES.OUTLINED || ch.status === 'draft').length;
    if (!anyContentChapter && chapters.length > 0 && outlinedOrDraft === 0) {
        const completedCount = chapters.filter(c => c.status === STATUS_VALUES.MATERIAL_UPDATED || c.status === STATUS_VALUES.APPROVED).length;
        if (completedCount === 0) {
            addLog('没有待处理章节且无已完成内容，停止');
            return { shouldStop: true };
        }
    }

    const consecutiveSupplementFails = state._consecutiveSupplementFails || 0;
    if (consecutiveSupplementFails >= 3) {
        addLog('连续3次补充大纲后无可用章节，停止');
        return { shouldStop: true };
    }

    return { shouldStop: false };
}

async function checkForeshadowing(projectId, chapters, state, addLog, effectiveStopChapter) {
    let unresolvedHooks = [];
    try {
        const hookBudget = getHookBudgetForProject(projectId);
        const activeHooks = await hookBudget.getActiveHooks();
        const foreshadowingMats = (await store.queryItems('materials', { projectId })).filter(m => m.type === 'foreshadowing' && !m.archived);
        if (activeHooks.length > 0 || foreshadowingMats.length > 0) {
            unresolvedHooks = foreshadowingMats.map(f => f.name);
            const hookNames = activeHooks.map(h => h.notes || h.type);
            for (const hn of hookNames) {
                if (!unresolvedHooks.includes(hn)) unresolvedHooks.push(hn);
            }
        }
    } catch (e) { logger.warn('infinitePipeline', 'Foreshadowing check error', { eMessage: e.message }); }

    if (unresolvedHooks.length > 0 && (state._foreshadowingRetryCount || 0) < 2) {
        state._foreshadowingRetryCount = (state._foreshadowingRetryCount || 0) + 1;
        const extraChapters = Math.min(unresolvedHooks.length, 3);
        const newStop = effectiveStopChapter + extraChapters;
        state.stopAfterChapter = newStop;
        addLog(`⚠️ 达到${effectiveStopChapter}章但有${unresolvedHooks.length}个伏笔未回收：${unresolvedHooks.join('、')}，追加${extraChapters}章强制回收（新目标：${newStop}章）`);
        try {
            const { getDataContext } = require("../../dataContext");
            const ctx = await getDataContext(projectId);
            const project = await ctx.getProject();
            if (project) {
                // Schema-First：写入时统一用标准字段名targetChapters
                project.targetChapters = newStop;
                await store.setItem('projects', projectId, project);
            }
        } catch (_) { /* silent */ }
        return { shouldStop: false };
    }

    if (unresolvedHooks.length > 0) {
        addLog(`⚠️ 已达到目标章数 ${effectiveStopChapter}，仍有${unresolvedHooks.length}个伏笔未回收：${unresolvedHooks.join('、')}（已追加2轮仍无法回收，强制停止）`);
    } else {
        addLog(`已达到项目目标章数 ${effectiveStopChapter}，所有伏笔已回收，停止`);
    }
    return { shouldStop: true };
}

module.exports = { checkStopConditions, checkForeshadowing };
