const logger = require('../../../shared/logger');
const store = require('../../../store');
const {
    getMaterialLifecycle,
    getCurrentVolumeSubplaneId,
    cleanChapterMaterials,
    getActiveMaterials,
    getMaterialSummary,
    getArchiveHints,
    getLockedEntities,
    getDynamicMaxMaterials
} = require('./materialLifecycle');
const { autoArchiveStaleMaterials, autoArchiveForExpansion } = require('./materialArchive');
const { buildMaterialManagerPrompt } = require('./materialPromptBuilder');
const { FIELD_TRANSLATIONS } = require('./materialUpdateProcessor');
const { applyUpdatesWithFallback, buildUnparsableError } = require('./materialUpdateApplier');
const { repairInvalidUpdates } = require('./materialUpdateRepair');
const { precheckChangeSignals, buildChangeDigest } = require('./materialChangePrecheck');
const { syncCharacterSideEffects, finishSkippedMaterialManager } = require('./materialManagerSideEffects');
const { syncForeshadowHooks, updateChapterStatus, saveChapter, extractTimelineAndForeshadow, rebuildIndexes } = require('./materialPostProcessor');
const characterStateCache = require('../../characterStateCache');
const { broadcastToProject } = require('../../websocket');
const { resetDataContext, getDataContext } = require('../../dataContext');
const stateKVIndex = require('../../stateKVIndex');
const { syncKnowledgeBase } = require('../knowledgeSyncService');

/** 素材生命周期预处理：清理 / 取活跃集 / 自动归档 / 汇总（从主流程抽出，保持主函数 ≤100 行） */
async function prepareMaterialContext(projectId, chapter, materials) {
    const chapterNum = chapter.chapterNumber;
    const allProjectMaterials = materials.filter(m => m.projectId === projectId);
    const { lockedSubplaneIds, lockedFactionIds } = getLockedEntities(allProjectMaterials, projectId);
    await cleanChapterMaterials(allProjectMaterials, projectId, chapterNum);

    const activeMaterials = getActiveMaterials(allProjectMaterials, projectId, chapterNum, lockedSubplaneIds, lockedFactionIds);
    const currentVolumeSubplaneId = await getCurrentVolumeSubplaneId(projectId, chapterNum);

    const staleArchived = await autoArchiveStaleMaterials(activeMaterials, chapterNum, currentVolumeSubplaneId);
    if (staleArchived.length > 0) logger.info('materialManager', `Auto-archived ${staleArchived.length} stale materials`);

    const expansionArchived = await autoArchiveForExpansion(activeMaterials, getDynamicMaxMaterials(chapterNum));
    if (expansionArchived.length > 0) logger.info('materialManager', `Auto-archived ${expansionArchived.length} materials due to expansion control`);

    return { allProjectMaterials, lockedSubplaneIds, lockedFactionIds, currentVolumeSubplaneId, activeMaterials };
}

const INTENSITY_MAP = { '轻度': 'light', '中度': 'medium', '重度': 'heavy', 'light': 'light', 'medium': 'medium', 'heavy': 'heavy' };

function parseFlavorTag(content, tagPattern) {
    const match = content.match(tagPattern);
    if (!match) return null;
    return { value: match[1].trim(), intensity: INTENSITY_MAP[match[2]] || 'medium' };
}

async function handleMaterialManager(params) {
    const { projectId, chapter, materials, agentContext, context, runAgent, saveAgentOutput } = params;
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    const styleProfile = project?.styleProfile || {};
    const chapterNum = chapter.chapterNumber;

    const { allProjectMaterials, lockedSubplaneIds, lockedFactionIds, currentVolumeSubplaneId, activeMaterials } =
        await prepareMaterialContext(projectId, chapter, materials);
    const freshActiveMaterials = getActiveMaterials(allProjectMaterials, projectId, chapterNum, lockedSubplaneIds, lockedFactionIds);
    const { summary: finalMaterialSummary } = getMaterialSummary(freshActiveMaterials);
    const finalArchiveHints = getArchiveHints(freshActiveMaterials, chapterNum, currentVolumeSubplaneId);

    const unresolvedForeshadowings = freshActiveMaterials.filter(m => m.type === 'foreshadowing' && !m.archived);

    // T5：零成本预判（开关默认关；开启后无变化章不调 LLM + 正文压缩投喂）
    let digestText = null;
    if (project?.features?.enableMaterialPrecheck) {
        const pre = precheckChangeSignals(chapter.content, allProjectMaterials);
        if (!pre.needsLLM) {
            return finishSkippedMaterialManager({ projectId, chapter, saveAgentOutput, reason: '无任何素材变化信号' });
        }
        const digest = buildChangeDigest(chapter.content, allProjectMaterials);
        if (digest) {
            digestText = digest.text;
            chapter.materialManagerDigest = { kept: digest.kept, total: digest.total, chars: digest.text.length };
            logger.info('materialManager', `ch${chapter.chapterNumber} 正文压缩 ${chapter.content.length}→${digest.text.length} 字（保留含信号句 ${digest.kept}/${digest.total}）`);
        }
    }

    // T5：开启预判时用压缩稿（只留含信号的句子），否则全文
    agentContext.chapterContent = digestText || chapter.content || '';
    agentContext.materialSummary = `【当前素材库摘要】（${freshActiveMaterials.length}个活跃素材）\n${finalMaterialSummary || '空'}\n${finalArchiveHints}`;

    agentContext.content = await buildMaterialManagerPrompt({
        chapter,
        materialSummary: finalMaterialSummary,
        archiveHints: finalArchiveHints,
        styleProfile,
        context: { ...context, unresolvedForeshadowings }
    });

    const result = await runAgent('material-manager', agentContext);

    // T1：把"到底成没成功"变成可判定事实；失败绝不静默吞
    const applied = await applyUpdatesWithFallback({
        response: result.response,
        chapter, projectId,
        materials: freshActiveMaterials,
        styleProfile,
        // T3：违规条目定向修复（只回喂不合规的那几条，不重跑整章）
        repairFn: (invalid, errors) => repairInvalidUpdates({ invalid, errors, runAgent, agentContext, chapter }),
    });
    const appliedUpdates = applied.updates;

    if (!applied.ok) {
        // 不写 material-updated、不 markChapterProcessed、不伪装成功：
        //   → pipelinePostApproval._runMaterialManager 重试（异常路径）
        //   → 仍失败则 materialManagerFailed=true，章节留在 approved
        //   → materialGate 看到缺口拦截下一章，catchup 可补跑
        chapter.materialManagerFailed = true;
        chapter.materialManagerError = applied.error;
        chapter.materialManagerStrategy = applied.strategy;
        await saveChapter(chapter);
        logger.error('materialManager',
            `素材管理失败(不可解析) ch${chapter.chapterNumber}，strategy=${applied.strategy}: ${applied.error}`);
        throw buildUnparsableError(applied.error);
    }

    // T3：不合规被丢弃的条目数必须留痕（可见可查，不静默）
    if (applied.stats && applied.stats.dropped > 0) {
        chapter.materialManagerDroppedUpdates = applied.stats.dropped;
        chapter.materialManagerInvalidCodes = applied.stats.errors;
        logger.warn('materialManager', `ch${chapter.chapterNumber} 丢弃不合规素材指令 ${applied.stats.dropped}/${applied.stats.total} 条: ${applied.stats.errors.join(',')}`);
    }

    if (applied.strategy === 'json') {
        broadcastToProject(projectId, 'pipeline:material-update', { chapterNumber: chapter.chapterNumber });
        resetDataContext(projectId);
    } else {
        logger.warn('materialManager', `ch${chapter.chapterNumber} 走 markdown 兜底落地（JSON 解析失败但已恢复）`);
    }

    await syncForeshadowHooks(result.response, chapter, projectId);

    await syncCharacterSideEffects(projectId, appliedUpdates, chapter);

    updateChapterStatus(chapter, result.response, saveAgentOutput);
    await saveChapter(chapter);
    saveAgentOutput(projectId, chapter, 'material-manager', result.response);

    // 提取时间线事件和伏笔状态（从正文+大纲+意图规划）
    const outlineText = chapter.outline || agentContext.outline || '';
    const intentResult = context?.intentResult || null;
    await extractTimelineAndForeshadow(projectId, chapter, outlineText, intentResult);

    rebuildIndexes(projectId);

    // 源头修复（陷阱#87）：material-manager内部自然更新chapterUpdated和知识库
    // 此前非拆分模式不调用markChapterProcessed/syncKnowledgeBase，由pipelineStepRunner外部补标记（堵漏）
    // 现在统一在material-manager内部完成，删除外部补标记
    await stateKVIndex.markChapterProcessed(projectId, chapterNum);
    await syncKnowledgeBase(projectId, chapterNum, chapter, materials);

    const updateSummary = appliedUpdates.length > 0
        ? appliedUpdates.map(u => `[${u.action}] ${u.type}: ${u.name}`).join('; ')
        : '无素材变更';

    return {
        step: 'material-manager',
        passed: true,
        response: result.response,
        feedback: {
            summary: `素材管理完成: ${updateSummary}`,
            updates: appliedUpdates
        },
        updates: appliedUpdates
    };
}

module.exports = { handleMaterialManager, FIELD_TRANSLATIONS, getMaterialLifecycle, parseFlavorTag };
