/**
 * materialGenerator.js — 初始素材库生成（分批 + 幂等写入）
 *
 * 从 outlineGenerator 拆出（保证单文件≤200行）。修复（2026-10-05 勘定压测 P1-F）：
 *   #12 一次性要 11 角色+全设定 → JSON 截断 → created=0；改为按类型分批。
 *   #13 非角色素材同名唯一约束触发 → 整批回滚；改为按 (type,name) upsert + 单条容错。
 */
const logger = require('../../shared/logger');
const llm = require('../../services/llm');
const { getOutlineApiConfig } = require('./constants');
const { buildConstraintInjection } = require('../prompts/constraintInjector');
const { buildStyleInjection } = require('../prompts/styleInjector');
const { resolveGenreFromProject, detectGenre } = require('../../services/genreConfig');
const { getDataContext } = require('../dataContext');
const { buildMaterialTypeList, buildMaterialSystemPromptWithProject, buildMaterialUserPrompt } = require('./outlineTemplateBuilder');
const { parseJsonResponse } = require('./outlineResponseParser');
const { saveMaterial, findExistingMaterial, updateExistingMaterial, createCharacterRelations, createEquipmentBinds } = require('./outlineMaterialSaver');
const { planMaterialBatches } = require('./materialBatchPlan');
const { syncCharacterToEntityCenter, initCharacterKVState, autoSetProtagonistName } = require('./outlineEntitySync');
const { enforceMaterialDepth } = require('./materialDepthEnforcer');
const { syncFactsFromMaterials } = require('../knowledgeBase');

/** 单次素材批次 LLM 调用：返回解析出的素材数组（不含落库） */
async function _runMaterialBatch({ projectId, genre, project, typeListStr, constraintInjection, styleInjection, userRequest, usageStep }) {
    const systemContent = await buildMaterialSystemPromptWithProject(genre, typeListStr, constraintInjection + styleInjection, projectId);
    const userContent = buildMaterialUserPrompt(project, userRequest, genre);
    const messages = [{ role: 'system', content: systemContent }, { role: 'user', content: userContent }];
    const result = await llm.chat(messages, {
        maxTokens: 32768, temperature: 0.8, enableThinking: false,
        apiConfig: await getOutlineApiConfig(), projectId, usageStep,
    });
    const responseText = result.choices?.[0]?.message?.content || '';
    logger.info('outlineGen', `material batch ${usageStep} response length: ${responseText.length}`);
    return parseJsonResponse(responseText);
}

/** 落库单条素材（幂等 upsert；单条失败不拖垮整批） */
async function _saveOneMaterial(projectId, mat, created, allMaterials) {
    const existing = await findExistingMaterial(projectId, mat.type, mat.name);
    if (existing) {
        const updated = await updateExistingMaterial(existing, mat.content);
        created.push(updated); allMaterials.push(mat);
        if (mat.type === 'character') await syncCharacterToEntityCenter(projectId, mat, existing.id);
        return;
    }
    const item = await saveMaterial(projectId, mat);
    created.push(item); allMaterials.push(mat);
    if (mat.type === 'character') {
        const entityId = await syncCharacterToEntityCenter(projectId, mat, item.id);
        if (entityId) await initCharacterKVState(projectId, entityId, mat);
    }
}

async function generateInitialMaterials(projectId, userPrompt) {
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    if (!project) throw new Error('Project not found');

    const enrichedProfile = { ...(project?.styleProfile || {}), genre: project?.genre, styleTemplateId: project?.styleTemplateId, genreProfile: project?.genreProfile };
    const genre = resolveGenreFromProject(project) || detectGenre(enrichedProfile);
    const materialFocus = genre?.styleProfile?.materialFocus || project?.styleProfile?.materialFocus || {};
    const materialRules = genre?.materialRules || {};
    const primaryTypes = materialFocus.primary || ['character', 'relationship', 'famous-scene', 'catchphrase', 'worldview', 'foreshadowing'];
    const secondaryTypes = materialFocus.secondary || [];
    const skipTypes = materialFocus.skip || [];

    const constraintInjection = await buildConstraintInjection(projectId, 'outline');
    const styleInjection = await buildStyleInjection(projectId);

    const activeTypes = [...primaryTypes, ...secondaryTypes].filter(t => !skipTypes.includes(t));
    const batches = planMaterialBatches(activeTypes);
    const allMaterials = [];
    const created = [];
    const batchResults = [];

    for (const batch of batches) {
        const typeListStr = buildMaterialTypeList(batch.types, [], skipTypes, materialRules);
        const avoid = created.filter(m => m.type === 'character').map(m => m.name).join('、');
        const req = [userPrompt, batch.note.replace('{{AVOID}}', avoid || '（无）')].filter(Boolean).join('\n\n');
        let materials = [];
        try {
            materials = await _runMaterialBatch({
                projectId, genre, project, typeListStr, constraintInjection, styleInjection,
                userRequest: req, usageStep: `material-generator:${batch.batchKey}`,
            });
        } catch (e) {
            logger.warn('outlineGen', `material batch ${batch.batchKey} failed: ${e.message}`);
        }
        let saved = 0;
        for (const mat of materials) {
            if (!mat || !mat.name || !mat.type) continue;
            try { await _saveOneMaterial(projectId, mat, created, allMaterials); saved++; }
            catch (e) { logger.warn('outlineGen', `saveMaterial failed (${mat.type}/${mat.name}): ${e.message}`); }
        }
        batchResults.push({ batchKey: batch.batchKey, types: batch.types, parsed: materials.length, saved });
    }

    if (allMaterials.length === 0) {
        return { created: [], count: 0, batches: batchResults, error: 'all batches produced 0 materials' };
    }

    try {
        await autoSetProtagonistName(projectId, allMaterials);
        await createCharacterRelations(projectId, allMaterials, created);
        await createEquipmentBinds(projectId, allMaterials, created);
        const syncedFacts = await syncFactsFromMaterials(projectId, created);
        logger.info('outlineGen', `generateInitialMaterials: synced ${syncedFacts} facts to knowledge base`);
        const cp = genre?.characterProfile || {};
        const depthStats = await enforceMaterialDepth(projectId, {
            apiConfig: await getOutlineApiConfig(),
            roleWordCounts: { protagonist: cp.protagonistWordCount, supporting: cp.supportingWordCount, npc: cp.npcWordCount },
        });
        return { created, count: created.length, syncedFacts, depthStats, batches: batchResults };
    } catch (e) {
        return { created, count: created.length, batches: batchResults, error: e.message };
    }
}

module.exports = { generateInitialMaterials };
