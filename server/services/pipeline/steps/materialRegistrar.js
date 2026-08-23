const logger = require('../../../shared/logger');
const stateKVIndex = require('../../stateKVIndex');
const characterStateCache = require('../../characterStateCache');
const { getCharacterStateSchema } = require('../../../config/characterStateSchemas');
const { resolveGenreFromProject } = require('../../genreConfig');
const { getDataContext } = require('../../dataContext');
const { processCharacterUpdates } = require('./materialCharacterProcessor');
const {
    processNewMaterials,
    processArchiveCandidates,
    processForeshadowProgress,
    processWorldviewChanges
} = require('./materialItemProcessor');
const { processChapterDepth } = require('../../characterDepthExtractor');
const { syncKnowledgeBase } = require('../knowledgeSyncService');

async function handleMaterialRegistrar(params) {
    const { projectId, chapter, materials, organizingPlan } = params;
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    const genre = resolveGenreFromProject(project);
    const genreId = genre?.id || null;
    const schema = getCharacterStateSchema(genreId);
    const chapterNum = chapter.chapterNumber;

    if (!organizingPlan) {
        return {
            step: 'material-registrar',
            passed: true,
            operations: [],
            errors: ['无整理计划（organizer 未输出有效JSON）'],
            stateSummary: ''
        };
    }

    const validation = validateOrganizingPlan(organizingPlan);
    if (!validation.passed) {
        return {
            step: 'material-registrar',
            passed: false,
            operations: [],
            errors: validation.errors,
            stateSummary: ''
        };
    }

    const operations = [];
    const errors = [];

    try {
        await processCharacterUpdates(organizingPlan, chapter, projectId, materials, schema, operations, errors);
        await processNewMaterials(organizingPlan, chapter, projectId, materials, schema, operations, errors);
        await processArchiveCandidates(organizingPlan, chapter, projectId, materials, operations, errors);
        await processForeshadowProgress(organizingPlan, chapter, projectId, materials, operations, errors);
        await processWorldviewChanges(organizingPlan, chapter, projectId, operations, errors);

        // 补齐配角深度指标写入链路（修复characterArcGuard数据断链）
        // 从章节正文提取内心描写/自主决策/反预期行为，累加写入entityCenter.genreState
        try {
            const charMats = (materials || []).filter(m => m.type === 'character' && !m.archived && m.name);
            const charNames = charMats.map(m => m.name);
            if (charNames.length > 0 && chapter.content) {
                await processChapterDepth(projectId, chapterNum, chapter.content, charNames);
            }
        } catch (depthErr) { logger.warn('materialRegistrar', `depth extract: ${depthErr.message}`); }

        await stateKVIndex.updateAfterOperations(projectId, chapterNum, operations);
        await stateKVIndex.clearHotFlags(projectId, chapterNum);
        // Bug-2修复：标记当前章节的KV记录已被处理（初始化chapterUpdated=0→chapterNum）
        await stateKVIndex.markChapterProcessed(projectId, chapterNum);
        // Bug-3修复：pipeline后自动同步知识库（facts + timeline）
        await syncKnowledgeBase(projectId, chapterNum, chapter, materials);

        const stateSummary = await stateKVIndex.generateBriefSummary(projectId, chapterNum, genre);

        const charOps = operations.filter(o => o.type === 'character');
        if (charOps.length > 0) {
            try {
                await characterStateCache.invalidateForProject(projectId);
                logger.info('materialRegistrar', `CharacterStateCache invalidated after ${charOps.length} character operations in ch${chapterNum}`);
            } catch (_) { logger.warn('materialRegistrar', '[material-registrar]', _.message || _); }
        }

        return {
            step: 'material-registrar',
            passed: errors.length === 0,
            operations,
            errors,
            stateSummary
        };
    } catch (e) {
        return {
            step: 'material-registrar',
            passed: false,
            operations,
            errors: [...errors, `Registrar execution error: ${e.message}`],
            stateSummary: ''
        };
    }
}

function validateOrganizingPlan(plan) {
    const errors = [];
    if (!plan || typeof plan !== 'object') {
        errors.push('organizingPlan is not an object');
        return { passed: false, errors };
    }
    if (plan.characters && !Array.isArray(plan.characters)) {
        errors.push('characters must be an array');
    }
    if (plan.newMaterials && !Array.isArray(plan.newMaterials)) {
        errors.push('newMaterials must be an array');
    }
    if (plan.archiveCandidates && !Array.isArray(plan.archiveCandidates)) {
        errors.push('archiveCandidates must be an array');
    }
    if (plan.characters) {
        for (const char of plan.characters) {
            if (!char.name) errors.push('character missing name');
            if (char.stateChanges && typeof char.stateChanges !== 'object') {
                errors.push(`character ${char.name}: stateChanges must be an object`);
            }
            if (char.relationshipChanges && !Array.isArray(char.relationshipChanges)) {
                errors.push(`character ${char.name}: relationshipChanges must be an array`);
            }
        }
    }
    return { passed: errors.length === 0, errors };
}

module.exports = { handleMaterialRegistrar, validateOrganizingPlan };
