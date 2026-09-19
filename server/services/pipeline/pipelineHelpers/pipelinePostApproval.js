const logger = require('../../../shared/logger');
const { STATUS_VALUES } = require('../../chapterStatus');
const store = require('../../../store');
const { cleanChapterContent, truncateChapter } = require('../../contentUtils');
const { resolveGenreFromProject } = require('../../genreConfig');
const { resolveConfig } = require('../../../config');
const { LLM_DEFAULTS } = require('../../../config/systemConfig');
const { getMetrics } = require('../../metricsCollector');
const { createVersionTag } = require('../../versionControl');
const { getHookBudgetForProject } = require('../../hookBudget');
const { ContextBudget } = require('../../contextBudget');
const memory = require('../../memory');
const { getRuleStackForProject } = require('../../ruleStack');
const { getContextTraceForProject } = require('../../contextTrace');
const { extractJSON } = require('../../jsonUtils');
const stateSnapshot = require('../../stateSnapshot');
const consistency = require('../../consistency');
const pipelineRegistry = require('../../pipelineRegistry');
const { handleMaterialRegistrar } = require('../steps/materialRegistrar');
const { runMaterialOrganizer, runKnowledgeExtraction } = require('./pipelineKnowledgeExtraction');
const { runDepthDriftCheck } = require('./pipelineDepthDriftCheck');
const { getVisibleMaterials } = require('../volumeHelpers');
const { getDataContext } = require('../../dataContext');
const { runReaderCheck } = require('./pipelineReaderCheck');

function _getStepFn() { return pipelineRegistry.getStepFn(); }

async function runPostApproval(projectId, chapterId, chapterNumber, round, pipelineLog, onStep, ctx) {
    const { mode, materialGuidance, chapterIntent, circuitBreaker, genre } = ctx;
    const _postCtx = await getDataContext(projectId);
    const project = await _postCtx.getProject();
    const _postGenre = resolveGenreFromProject(project);
    const config = resolveConfig(_postGenre, project);

    await _runPolisher(projectId, chapterId, round, config, pipelineLog, onStep, mode);
    const matManagerSucceeded = await _runMaterialManager(projectId, chapterId, chapterNumber, round, materialGuidance, pipelineLog, onStep);

    if (matManagerSucceeded) {
        // 修复陷阱#69：执行顺序缺陷——materialRegistrar此前先于material-organizer执行，
        // 只能用mmOutput转换的plan（缺roleLevel/knowledgeChanges），导致主角被标npc、知识库0增量。
        // 调整为：material-organizer先（生成含roleLevel的organizerPlan），materialRegistrar后（用organizerPlan创建实体）。
        // material-organizer只读已有materials不写，顺序调换无死锁风险。
        const organizerPlan = await runMaterialOrganizer(projectId, chapterId, chapterNumber, round, pipelineLog, onStep, ctx);
        await _runMaterialRegistrar(projectId, chapterId, chapterNumber, round, pipelineLog, onStep, organizerPlan);
        await runKnowledgeExtraction(projectId, chapterId, chapterNumber, pipelineLog, organizerPlan, _convertMmOutputToOrganizingPlan);
        // 角色深度巡检（Q2）：每章免费校验，只有跌破"要求×比例"才触发LLM补全 ——
        // 防止长篇跑到几百章时人设被反复覆盖而缓慢退化
        await runDepthDriftCheck(projectId, chapterId, chapterNumber, pipelineLog, onStep, _postGenre);
        // 陷阱#75修复：status=material-updated 此前在 material-manager 成功后立即设置，
        // 但后续 material-organizer/registrar/knowledge-extraction 未完成时若进程崩溃（如OOM），
        // 会导致 status=material-updated 但 materialOrganizerOutput 为空的误判完成状态。
        // 移到 postApproval 素材链路全部完成后设置，确保 materialOrganizerOutput 已持久化。
        // 注意：runMaterialOrganizer/_runMaterialRegistrar/runKnowledgeExtraction 内部已 try-catch，
        // 不会向上抛异常阻断 status 更新；OOM 进程级崩溃时 status 保持原状（approved），material-depth 校验不会误判。
        const matChapter = await store.getItem('chapters', chapterId);
        if (matChapter && matChapter.status !== STATUS_VALUES.MATERIAL_UPDATED) {
            matChapter.status = STATUS_VALUES.MATERIAL_UPDATED;
            matChapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, matChapter);
        }
    }

    await runReaderCheck(projectId, chapterId, chapterNumber, round, pipelineLog, onStep, mode, config, project?.subGenre, genre);
    await _runPostApprovalCleanup(projectId, chapterId, chapterNumber, round, pipelineLog, onStep, chapterIntent, circuitBreaker);
    await _updateProjectCurrentChapter(projectId, chapterNumber);
}

async function _runPolisher(projectId, chapterId, round, config, pipelineLog, onStep, mode) {
    try {
        const polishResult = await _getStepFn()(projectId, chapterId, 'polisher', round, { mode });
        pipelineLog.push(polishResult);
        if (onStep) onStep({ step: 'polisher', round, passed: true, roleName: '润色师' });
        if (polishResult.result?.response) {
            const chapter = await store.getItem('chapters', chapterId);
            const polishedContent = polishResult.result.response;
            const originalLength = (chapter?.normalContent || '').length;
            const polishedLength = polishedContent.length;
            const ratio = originalLength > 0 ? polishedLength / originalLength : 1;
            if (ratio >= 0.8 && ratio <= 1.2 && polishedLength > 500) {
                let finalPolished = cleanChapterContent(polishedContent);
                const polishedWc = finalPolished.replace(/\s/g, '').length;
                const polishMaxWords = config.word.maxChapter;
                if (polishedWc > polishMaxWords) {
                    logger.warn('postApproval', `Polisher字数超限: ${polishedWc}> 上限${polishMaxWords}字，截断到上限`);
                    finalPolished = truncateChapter(finalPolished, polishMaxWords).content;
                }
                chapter.polishedContent = finalPolished; chapter.polisherOutput = finalPolished;
                chapter.content = finalPolished; chapter.wordCount = finalPolished.replace(/\s/g, '').length;
                chapter.updatedAt = new Date().toISOString();
                await store.setItem('chapters', chapterId, chapter);
            } else { logger.warn('postApproval', `Polish rejected: ratio=${ratio.toFixed(2)}, length=${polishedLength}.`); }
        }
    } catch (polishErr) {
        logger.warn('postApproval', 'Polish failed, keeping original:', polishErr.message);
        pipelineLog.push({ step: 'polisher', status: 'error', error: polishErr.message, timestamp: new Date().toISOString() });
        if (onStep) onStep({ step: 'polisher', round, passed: false, roleName: '润色师', feedback: { summary: `润色失败，保留原文: ${polishErr.message}` } });
    }
}

async function _runMaterialManager(projectId, chapterId, chapterNumber, round, materialGuidance, pipelineLog, onStep) {
    let matRetries = 0; const maxMatRetries = 3; let matManagerSucceeded = false;
    while (matRetries < maxMatRetries) {
        try {
            const mmStepResult = await _getStepFn()(projectId, chapterId, 'material-manager', round, { materialGuidance });
            pipelineLog.push({ step: 'material-manager', status: 'completed', passed: mmStepResult.passed !== false, feedback: mmStepResult.feedback || { summary: '素材管理完成' }, materialUpdates: mmStepResult.feedback?.updates || mmStepResult.updates || [], timestamp: new Date().toISOString() });
            if (onStep) onStep({ step: 'material-manager', round, passed: true, roleName: '素材管理', feedback: mmStepResult.feedback || { summary: '素材管理完成' } });
            matManagerSucceeded = true; break;
        } catch (matErr) {
            matRetries++;
            if (matRetries >= maxMatRetries) {
                pipelineLog.push({ step: 'material-manager', status: 'error', error: matErr.message, timestamp: new Date().toISOString() });
                if (onStep) onStep({ step: 'material-manager', round, passed: false, roleName: '素材管理', feedback: { summary: `素材管理失败(重试${maxMatRetries}): ${matErr.message}` } });
                const failedChapter = await store.getItem('chapters', chapterId);
                if (failedChapter) { failedChapter.materialManagerFailed = true; failedChapter.materialManagerError = matErr.message; failedChapter.updatedAt = new Date().toISOString(); await store.setItem('chapters', chapterId, failedChapter); }
            } else { await new Promise(r => setTimeout(r, LLM_DEFAULTS.materialManagerRetryDelayMs)); }
        }
    }
    return matManagerSucceeded;
}

async function _runMaterialRegistrar(projectId, chapterId, chapterNumber, round, pipelineLog, onStep, organizerPlan) {
    try {
        const registrarChapter = await store.getItem('chapters', chapterId);
        const materials = await getVisibleMaterials(projectId, chapterNumber, { purpose: 'registrar' });
        // 修复陷阱#69：优先使用material-organizer的organizerPlan（含roleLevel/knowledgeChanges），
        // fallback到mmOutput转换的plan（仅当organizer失败时）。
        // organizerPlan由runMaterialOrganizer传入，已保存到chapter.materialOrganizerOutput。
        let organizingPlan = organizerPlan;
        if (!organizingPlan) {
            const mmOutput = registrarChapter?.materialManagerOutput ? extractJSON(registrarChapter.materialManagerOutput) : null;
            organizingPlan = _convertMmOutputToOrganizingPlan(mmOutput);
        }
        const registrarResult = await handleMaterialRegistrar({ projectId, chapter: registrarChapter, materials: materials.materials || [], organizingPlan });
        pipelineLog.push({ step: 'material-registrar', status: 'completed', passed: registrarResult.passed !== false, operations: registrarResult.operations || [], errors: registrarResult.errors || [], stateSummary: registrarResult.stateSummary || '', timestamp: new Date().toISOString() });
        if (onStep) onStep({ step: 'material-registrar', round, passed: registrarResult.passed !== false, roleName: '素材登记', feedback: { summary: `登记完成: ${registrarResult.operations?.length || 0} 项操作` } });
    } catch (regErr) {
        logger.warn('postApproval', `Material-registrar failed for chapter ${chapterNumber}:`, regErr.message);
        pipelineLog.push({ step: 'material-registrar', status: 'error', error: regErr.message, timestamp: new Date().toISOString() });
    }
}

function _convertMmOutputToOrganizingPlan(mmOutput) {
    if (!mmOutput) return null;
    if (mmOutput.organizingPlan) return mmOutput.organizingPlan;
    if (!mmOutput.updates) return null;
    const characters = [], newMaterials = [], archiveCandidates = [];
    for (const update of mmOutput.updates) {
        if (update.type === 'character') {
            if (update.action === 'create' || update.action === 'update') {
                const charEntry = { name: update.name, stateChanges: {} };
                if (update.content) {
                    for (const line of update.content.split('\n')) {
                        const match = line.match(/【(.+?)】(.+)/);
                        if (match && ['核心欲望','内在矛盾','行为模式','身体状态','战斗战术','当前目标','当前状态'].includes(match[1].trim())) {
                            charEntry.stateChanges[match[1].trim()] = { to: match[2].trim() };
                        }
                    }
                }
                if (update.action === 'create') newMaterials.push({ type: 'character', name: update.name, description: update.content || update.reason || '', parentPlane: update.parentPlane, parentFaction: update.parentFaction });
                if (Object.keys(charEntry.stateChanges).length > 0) characters.push(charEntry);
            } else if (['retire','deprecate','recycle'].includes(update.action)) { archiveCandidates.push({ name: update.name, reason: update.reason || update.action }); }
        } else if (update.action === 'create') { newMaterials.push({ type: update.type, name: update.name, description: update.content || update.reason || '', parentPlane: update.parentPlane, parentFaction: update.parentFaction }); }
    }
    return { characters: characters.length > 0 ? characters : undefined, newMaterials: newMaterials.length > 0 ? newMaterials : undefined, archiveCandidates: archiveCandidates.length > 0 ? archiveCandidates : undefined };
}

async function _runPostApprovalCleanup(projectId, chapterId, chapterNumber, round, pipelineLog, onStep, chapterIntent, circuitBreaker) {
    try { const ch = await store.getItem('chapters', chapterId); await stateSnapshot.createSnapshot(projectId, ch.chapterNumber, ch.content); } catch (snapErr) { logger.warn('postApproval', 'State snapshot creation failed:', snapErr.message); }
    try { const ch = await store.getItem('chapters', chapterId); const result = await consistency.quickCheck(projectId, ch.chapterNumber, ch?.normalContent || ch?.content || ''); if (!result.passed) pipelineLog.push({ step: 'consistency-check', status: 'warning', criticalCount: result.criticalCount, timestamp: new Date().toISOString() }); else pipelineLog.push({ step: 'consistency-check', status: 'passed', timestamp: new Date().toISOString() }); } catch (consErr) { logger.warn('postApproval', 'Consistency check failed:', consErr.message); }
    try { const ch = await store.getItem('chapters', chapterId); if (ch) await memory.updateAfterChapter(projectId, ch.chapterNumber, ch.normalContent || ch.content || ''); } catch (memErr) { logger.warn('postApproval', 'Memory update failed:', memErr.message); }
    try { const { memoryPyramid } = require('../../knowledgeBase'); const ch = await store.getItem('chapters', chapterId); if (ch) await memoryPyramid.runDecayCycle(projectId, ch.chapterNumber); } catch (pyramidErr) { logger.warn('postApproval', 'Memory pyramid decay failed:', pyramidErr.message); }
    try { const hookBudget = getHookBudgetForProject(projectId); const ch = await store.getItem('chapters', chapterId); const hookResult = await hookBudget.updateHooksFromContent(chapterNumber, ch?.normalContent || ch?.content || ''); if (hookResult.advanced.length > 0 || hookResult.resolved.length > 0 || hookResult.newDetected.length > 0) { for (const h of hookResult.resolved) { try { getMetrics(projectId).recordHookResolution(h.name || h, chapterNumber, 'resolved'); } catch(_) { logger.warn('postApproval', _.message || _); } } for (const h of hookResult.advanced) { try { getMetrics(projectId).recordHookResolution(h.name || h, chapterNumber, 'advanced'); } catch(_) { logger.warn('postApproval', _.message || _); } } pipelineLog.push({ step: 'hook-budget-update', status: 'done', advanced: hookResult.advanced, resolved: hookResult.resolved, newDetected: hookResult.newDetected, timestamp: new Date().toISOString() }); } const hookAgenda = await hookBudget.generateHookAgenda(chapterNumber); for (const h of hookAgenda.staleDebt) { try { getMetrics(projectId).recordHookResolution(h.id || h.notes, chapterNumber, 'stale'); } catch(_) { logger.warn('postApproval', _.message || _); } } } catch (hookErr) { logger.warn('postApproval', `Hook budget update failed: ${hookErr.message}`); }
    try { const contextTrace = getContextTraceForProject(projectId); const budget = new ContextBudget('default', 16384); contextTrace.recordChapterTrace(chapterNumber, { plannerInputs: ['chapter-intent', 'hook-budget', 'rule-stack', 'memory', 'materials'], selectedSources: chapterIntent ? ['intent-goal', 'intent-mustKeep', 'intent-mustAvoid', 'hook-agenda', 'rule-stack-L1', 'rule-stack-L2'] : [], composerInputs: chapterIntent ? [`chapter-${chapterNumber}-intent`] : [], notes: [`Chapter ${chapterNumber} completed successfully`], hookBudgetSnapshot: await getHookBudgetForProject(projectId).getBudgetStatus(chapterNumber), ruleStackSnapshot: await getRuleStackForProject(projectId).getStackSummary() }); } catch (traceErr) { logger.warn('postApproval', 'Context trace recording failed:', traceErr.message); }
    try { circuitBreaker.recordSuccess(chapterNumber); } catch (cbErr) { logger.warn('postApproval', 'Circuit breaker record failed:', cbErr.message); }
    try { const ch = await store.getItem('chapters', chapterId); createVersionTag(projectId, chapterId, chapterNumber, ch?.version || 1, ch?.content || '', { branch: 'main', reason: 'auto-commit' }); } catch (verErr) { logger.warn('postApproval', `Version tag failed: ${verErr.message}`); }
}

module.exports = { runPostApproval };

async function _updateProjectCurrentChapter(projectId, chapterNumber) {
    try {
        const project = await store.getItem('projects', projectId);
        if (project && (project.currentChapter || 0) < chapterNumber) {
            project.currentChapter = chapterNumber;
            project.updatedAt = new Date().toISOString();
            await store.setItem('projects', projectId, project);
        }
    } catch (err) {
        logger.warn('postApproval', 'Failed to update project currentChapter:', err.message);
    }
}
