const store = require('../../store');
const { getChapterIntentPlanner } = require('../../services/chapterIntent');
const { getHookBudgetForProject } = require('../../services/hookBudget');
const { getRuleStackForProject } = require('../../services/ruleStack');
const logger = require('../../shared/logger');
const { STATUS_VALUES } = require('../../services/chapterStatus');

// 与 materialManagerCatchup 默认 maxRetries 对齐：超过即视为"补跑连续失败"（保持缺口 + 告警）
const MAX_CATCHUP_RETRIES = 3;

async function runPreflightChecks(projectId, chapterId, pipelineLog, onStep, runPipelineStepFn) {
    const chapter = await store.getItem('chapters', chapterId);
    if (!chapter || chapter.chapterNumber <= 1) return;

    const allPrevChapters = (await store.queryItems('chapters', { projectId }))
        .filter(c => c.chapterNumber < chapter.chapterNumber)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);

    for (const prevChapter of allPrevChapters) {
        if (prevChapter.status === STATUS_VALUES.APPROVED && (!prevChapter.materialManagerOutput || prevChapter.materialManagerFailed)) {
            logger.warn('pipeline', `Chapter ${prevChapter.chapterNumber} material manager not run, catching up`);
            try {
                const result = await runPipelineStepFn(projectId, prevChapter.id, 'material-manager', 1, { materialGuidance: '' });
                prevChapter.materialManagerOutput = result?.feedback?.summary || '[补跑完成]';
                prevChapter.materialManagerFailed = false;
                delete prevChapter.materialManagerError;
                prevChapter.status = STATUS_VALUES.MATERIAL_UPDATED;
                prevChapter.updatedAt = new Date().toISOString();
                await store.setItem('chapters', prevChapter.id, prevChapter);
                pipelineLog.push({ step: 'material-manager-catchup', chapterNumber: prevChapter.chapterNumber, status: 'completed', timestamp: new Date().toISOString() });
                if (onStep) onStep({ step: 'material-manager-catchup', round: 0, passed: true, roleName: '素材管理(补跑)', feedback: result?.feedback || { summary: '补跑完成' } });
            } catch (err) {
                logger.error('pipeline', `Material manager catchup failed for ch${prevChapter.chapterNumber}`, { error: err.message });
                prevChapter._matManagerRetries = (prevChapter._matManagerRetries || 0) + 1;
                // P1-4a：不再伪造 material-updated（缺口会静默消失）。保持缺口 + 告警，
                // 由 materialGate 持续拦截下一章，超阈值后走显式 materialDebt 放行。
                prevChapter.materialManagerFailed = true;
                prevChapter.materialManagerOutput = `[素材管理补跑失败${prevChapter._matManagerRetries}次，未归档]`;
                if (prevChapter._matManagerRetries >= MAX_CATCHUP_RETRIES) {
                    logger.error('pipeline', `第${prevChapter.chapterNumber}章素材补跑连续失败，保持缺口（不伪造 material-updated）`, { retries: prevChapter._matManagerRetries });
                }
                await store.setItem('chapters', prevChapter.id, prevChapter);
            }
        }
    }

    const allMaterials = await store.queryItems('materials', { projectId });
    const emptyMaterials = allMaterials.filter(m =>
        !m.archived && (!m.currentContent || m.currentContent.trim().length < 5) &&
        m.initialContent && m.initialContent.trim().length > 10
    );
    for (const em of emptyMaterials) {
        logger.warn('pipeline', `Material "${em.name}" content empty, restoring initialContent`);
        em.currentContent = em.initialContent;
        em.updatedAt = new Date().toISOString();
        await store.setItem('materials', em.id, em);
    }
}

async function handleChapterIntent(projectId, chapterId, chapterNumber, chapterOutline, options, pipelineLog, onStep) {
    try {
        const intentPlanner = getChapterIntentPlanner(projectId);
        let chapterIntent = await intentPlanner.getIntent(chapterNumber);

        if (chapterIntent) {
            if (!(await store.getItem('chapters', chapterId))?.intentPlannerOutput) {
                const intentText = await intentPlanner.formatIntentForPrompt(chapterNumber);
                const ch = await store.getItem('chapters', chapterId);
                ch.intentPlannerOutput = typeof intentText === 'string' ? intentText : JSON.stringify(intentText);
                await store.setItem('chapters', chapterId, ch);
            }
            if (onStep) onStep({ step: 'intent-planner', round: 0, passed: true, roleName: '意图规划', feedback: chapterIntent });
            return chapterIntent;
        }

        logger.info('pipeline', `Generating chapter intent for chapter ${chapterNumber}`);
        chapterIntent = await intentPlanner.generateIntent(chapterNumber, chapterOutline, { apiConfig: options.apiConfig, scene: (await store.getItem('chapters', chapterId))?.scene });
        const intentText = await intentPlanner.formatIntentForPrompt(chapterNumber);
        const ch = await store.getItem('chapters', chapterId);
        ch.intentPlannerOutput = typeof intentText === 'string' ? intentText : JSON.stringify(intentText);
        await store.setItem('chapters', chapterId, ch);

        if (onStep) onStep({ step: 'intent-planner', round: 0, passed: true, roleName: '意图规划', feedback: chapterIntent });
        return chapterIntent;
    } catch (err) {
        logger.warn('pipeline', 'Chapter intent generation failed', { error: err.message });
        pipelineLog.push({ step: 'intent-planner', status: 'error', error: err.message, timestamp: new Date().toISOString() });
        if (onStep) onStep({ step: 'intent-planner', round: 0, passed: false, roleName: '意图规划', feedback: { summary: `意图规划失败: ${err.message}` } });
        return null;
    }
}

async function syncHooksAndRules(projectId) {
    try {
        const hookBudget = getHookBudgetForProject(projectId);
        await hookBudget.syncFromForeshadowingMaterials();
        const ruleStack = getRuleStackForProject(projectId);
        await ruleStack.extractRulesFromMaterials();
    } catch (err) {
        logger.warn('pipeline', 'Hook/Rule sync failed', { error: err.message });
    }
}

module.exports = { runPreflightChecks, handleChapterIntent, syncHooksAndRules };
