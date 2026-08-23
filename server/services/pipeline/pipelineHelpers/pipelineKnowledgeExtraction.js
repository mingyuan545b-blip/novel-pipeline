/**
 * pipelineKnowledgeExtraction.js — 知识库提取模块
 *
 * 从pipelinePostApproval.js拆出，遵循200行单文件硬限制
 * 包含：material-organizer调用 + knowledgeExtraction
 *
 * 修复陷阱#67：material-organizer此前是僵尸功能（定义了但pipelinePostApproval未调用），
 * 导致knowledgeChanges永远为空，knowledgeExtractor永远不执行，章节级知识库事实0增量。
 */
const logger = require('../../../shared/logger');
const store = require('../../../store');
const { extractJSON } = require('../../jsonUtils');
const { handleMaterialOrganizer } = require('../steps/materialOrganizer');
const { processKnowledgeChanges } = require('../steps/knowledgeExtractor');
const { runAgent } = require('../agentRunner');
const { getVisibleMaterials } = require('../volumeHelpers');

/**
 * 调用material-organizer获取含knowledgeChanges的organizingPlan
 * @returns {Promise<object|null>} organizingPlan，失败时返回null
 */
async function runMaterialOrganizer(projectId, chapterId, chapterNumber, round, pipelineLog, onStep, ctx) {
    try {
        const chapter = await store.getItem('chapters', chapterId);
        if (!chapter) {
            logger.warn('postApproval', `Material-organizer skipped: chapter ${chapterId} not found`);
            return null;
        }
        const materialsResult = await getVisibleMaterials(projectId, chapterNumber, { purpose: 'organizer' });
        const materials = materialsResult.materials || [];
        const agentContext = {
            projectId,
            chapter,
            chapterNumber,
            round,
            mode: ctx?.mode || 'novel',
            _startTime: Date.now()
        };
        const result = await handleMaterialOrganizer({
            projectId,
            chapter,
            materials,
            agentContext,
            context: { round },
            runAgent
        });
        const organizingPlan = result?.organizingPlan || null;
        const organizerResponse = result?.response || '';

        // 修复陷阱#68：material-organizer的response此前从未被持久化，
        // 导致事后无法审计LLM是否真生成了knowledgeChanges，也无法回溯roleLevel等字段。
        // materialOrganizerOutput字段在fullPipeline.clearDownstreamOutputs已预留为清理目标，此处补齐写入。
        if (organizerResponse) {
            try {
                const chForSave = await store.getItem('chapters', chapterId);
                if (chForSave) {
                    chForSave.materialOrganizerOutput = organizerResponse;
                    chForSave.updatedAt = new Date().toISOString();
                    await store.setItem('chapters', chapterId, chForSave);
                }
            } catch (saveErr) {
                logger.warn('postApproval', `Material-organizer output persist failed for ch${chapterNumber}: ${saveErr.message}`);
            }
        }

        pipelineLog.push({
            step: 'material-organizer',
            status: 'completed',
            passed: true,
            hasKnowledgeChanges: !!(organizingPlan?.knowledgeChanges?.length),
            knowledgeChangesCount: organizingPlan?.knowledgeChanges?.length || 0,
            responseLength: organizerResponse.length,
            timestamp: new Date().toISOString()
        });
        if (onStep) onStep({
            step: 'material-organizer',
            round,
            passed: true,
            roleName: '素材整理',
            feedback: { summary: `整理完成: ${organizingPlan?.knowledgeChanges?.length || 0} 项认知变化` }
        });
        return organizingPlan;
    } catch (orgErr) {
        logger.warn('postApproval', `Material-organizer failed for chapter ${chapterNumber}:`, orgErr.message);
        pipelineLog.push({ step: 'material-organizer', status: 'error', error: orgErr.message, timestamp: new Date().toISOString() });
        return null;
    }
}

/**
 * 执行知识库提取——将knowledgeChanges写入knowledge_access表
 * 优先使用material-organizer输出的organizingPlan，回退到material-manager输出转换
 */
async function runKnowledgeExtraction(projectId, chapterId, chapterNumber, pipelineLog, organizerPlan, convertMmOutputFn) {
    try {
        let organizingPlan = organizerPlan;
        if (!organizingPlan) {
            const chapter = await store.getItem('chapters', chapterId);
            const mmOutput = chapter?.materialManagerOutput ? extractJSON(chapter.materialManagerOutput) : null;
            organizingPlan = convertMmOutputFn(mmOutput);
        }
        if (organizingPlan?.knowledgeChanges) {
            const result = await processKnowledgeChanges(projectId, chapterNumber, organizingPlan);
            pipelineLog.push({
                step: 'knowledge-extraction',
                status: 'completed',
                created: result.created,
                errors: result.errors,
                timestamp: new Date().toISOString()
            });
        } else {
            pipelineLog.push({
                step: 'knowledge-extraction',
                status: 'skipped',
                reason: 'no knowledgeChanges in organizingPlan',
                timestamp: new Date().toISOString()
            });
        }
    } catch (err) {
        logger.warn('postApproval', 'Knowledge extraction failed:', err.message);
        pipelineLog.push({ step: 'knowledge-extraction', status: 'error', error: err.message, timestamp: new Date().toISOString() });
    }
}

module.exports = { runMaterialOrganizer, runKnowledgeExtraction };
