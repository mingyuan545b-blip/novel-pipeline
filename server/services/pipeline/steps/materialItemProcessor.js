const logger = require('../../../shared/logger');
const store = require('../../../store');
const entityCenter = require('../../entityCenter');
const entityRegistry = require('../../entityRegistry');
const { validateMaterial } = require('../../materialValidator');
const { validateMaterialDepth } = require('../../materialDepthValidator');
const stateKVIndex = require('../../stateKVIndex');
const { extractCharacterStateFromContent } = require('../outlineResponseParser');
const { v4: uuidv4 } = require('uuid');
const { findMaterialByName: _findMat, findForeshadowByName: _findForeshadow } = require('./materialFinder');
const { VALID_MATERIAL_TYPES } = require('../../../config/materialTypes');

function findMaterialByName(projectId, materials, name, type) {
    const exact = materials.find(m =>
        m.projectId === projectId && !m.archived && m.name === name && (type ? m.type === type : true)
    );
    if (exact) return exact;
    if (name && type === 'character') {
        const normalizedName = name.toLowerCase().replace(/[\s\-_··]/g, '');
        return materials.find(m => {
            if (m.projectId !== projectId || m.archived || (type && m.type !== type)) return false;
            const mName = (m.name || '').toLowerCase().replace(/[\s\-_··]/g, '');
            return mName === normalizedName || mName.includes(normalizedName) || normalizedName.includes(mName);
        });
    }
    return null;
}

function findForeshadowByName(projectId, materials, name) {
    return materials.find(m =>
        m.projectId === projectId && m.type === 'foreshadowing' && !m.archived && m.name === name
    );
}

async function processNewMaterials(organizingPlan, chapter, projectId, materials, schema, operations, errors) {
    if (!organizingPlan.newMaterials) return;
    for (const newMat of organizingPlan.newMaterials) {
        if (!newMat.name || !newMat.type) continue;
        const existing = findMaterialByName(projectId, materials, newMat.name, newMat.type);
        if (existing) { operations.push({ type: 'skipNewMaterial', scope: 'material', entityKey: existing.id, data: { reason: 'already exists' }, status: 'skipped' }); continue; }
        if (newMat.type === 'character') {
            const storeExisting = await store.queryItems('materials', { projectId, type: 'character' });
            const storeMatch = storeExisting.find(m => !m.archived && m.name === newMat.name);
            if (storeMatch) { operations.push({ type: 'skipNewMaterial', scope: 'material', entityKey: storeMatch.id, data: { reason: 'already exists in store' }, status: 'skipped' }); continue; }
        }
        const matId = `mat-${uuidv4()}`;
        // 未知素材类型兜底：组织者偶发产出白名单外的类型（20章E2E实测 type="case"），
        // 原逻辑直接丢弃 → 正文里已经写到的设定（如"顺通号沉船案"）在素材库里凭空消失。
        // 这里降级为 'other' 保留内容，而不是让素材人间蒸发。
        let resolvedType = newMat.type;
        if (!VALID_MATERIAL_TYPES.includes(resolvedType)) {
            const { inferTypeFromContent } = require('../../../config/materialTypes');
            const inferred = inferTypeFromContent(newMat.name || '', newMat.description || newMat.detail || '');
            const fallback = inferred || 'other';
            errors.push(`素材类型未知，已降级保留：${newMat.name} "${newMat.type}" -> "${fallback}"`);
            resolvedType = fallback;
        }
        const material = { id: matId, projectId, type: resolvedType, name: newMat.name, currentContent: newMat.description || newMat.detail || '', initialContent: newMat.description || newMat.detail || '', sourceChapter: chapter.chapterNumber, createdAt: new Date().toISOString(), archived: false };
        if (newMat.archetype) material.archetype = newMat.archetype;
        if (newMat.parentPlane) material.parentPlane = newMat.parentPlane;
        if (newMat.parentFaction) material.parentFaction = newMat.parentFaction;
        if (newMat.roleLevel) material.roleLevel = newMat.roleLevel;
        if (newMat.depthLevel) material.depthLevel = newMat.depthLevel;
        const validation = await validateMaterial(material);
        if (!validation.valid) {
            errors.push(`New material ${newMat.name} validation failed: ${validation.message || (validation.missing || []).join(', ')}`);
            // 一致性告警：实体/关系可能已在上游步骤建好（material-manager 先于 registrar），
            // 这里丢掉素材会造成"实体中心有角色、素材库没有"的不一致，必须显式暴露
            try {
                const existingEntity = await entityCenter.findEntityByName(projectId, 'character', newMat.name);
                if (existingEntity) {
                    logger.error('materialRegistrar', `[一致性风险] 素材"${newMat.name}"被拒但实体已存在(id=${existingEntity.id})：实体中心与素材库将不一致，请补齐归属字段或调整素材内容`, {
                        projectId, materialName: newMat.name, entityId: existingEntity.id, errorCode: 'MATERIAL_ENTITY_MISMATCH'
                    });
                }
            } catch (_) { /* 一致性检查失败不影响主流程 */ }
            continue;
        }

        // 陷阱#22修复：深度校验（字段齐全+字数+质量），告警不阻断
        const depthResult = validateMaterialDepth(material);
        if (depthResult.issues.length > 0) {
            logger.warn('materialItem', `[深度校验告警] ${newMat.name} (${newMat.type}/${depthResult.depthLevel}): ${depthResult.message}`);
            material.depthValidation = {
                level: depthResult.depthLevel,
                valid: depthResult.valid,
                issues: depthResult.issues,
                checkedAt: new Date().toISOString()
            };
            if (!depthResult.valid) {
                errors.push(`Material ${newMat.name} depth validation failed: missing ${depthResult.missing.join(', ')}`);
            }
        }

        try {
            await store.setItem('materials', matId, material);
            if (newMat.type === 'character') {
                try {
                    const content = newMat.description || newMat.detail || '';
                    const parsed = extractCharacterStateFromContent(content, {});
                    await entityCenter.getOrCreateEntity(projectId, 'character', newMat.name, {
                        roleLevel: newMat.roleLevel || 'npc', sourceChapter: chapter.chapterNumber || 0,
                        position: newMat.position || parsed.position || '', personality: newMat.personality || parsed.personality || '',
                        speakingTone: newMat.speakingTone || parsed.speakingTone || '', signatureDetail: newMat.signatureDetail || parsed.signatureDetail || '',
                        sourceContent: content.substring(0, 2000)
                    });
                } catch (regErr) { logger.warn('materialItem', 'EntityCenter create failed for', newMat.name, ':', regErr.message); }
            }
            operations.push({ type: 'createMaterial', scope: 'material', entityKey: matId, data: { type: newMat.type, name: newMat.name, depthLevel: depthResult.depthLevel, depthValid: depthResult.valid }, status: 'success' });
        } catch (e) { errors.push(`Failed to create material ${newMat.name}: ${e.message}`); }
    }
}

async function processArchiveCandidates(organizingPlan, chapter, projectId, materials, operations, errors) {
    if (!organizingPlan.archiveCandidates) return;
    for (const candidate of organizingPlan.archiveCandidates) {
        if (!candidate.name) continue;
        const existing = findMaterialByName(projectId, materials, candidate.name);
        if (!existing) continue;
        try {
            existing.archived = true; existing.deprecatedReason = candidate.reason || '归档';
            existing.archivedAt = new Date().toISOString(); existing.archivedChapter = chapter.chapterNumber;
            await store.setItem('materials', existing.id, existing);
            try { await entityRegistry.deactivateEntity(existing.id); } catch (deactErr) { logger.warn('materialItem', 'Entity deactivation failed for', candidate.name, ':', deactErr.message); }
            operations.push({ type: 'archiveMaterial', scope: 'material', entityKey: existing.id, data: { reason: candidate.reason }, status: 'success' });
        } catch (e) { errors.push(`Failed to archive ${candidate.name}: ${e.message}`); }
    }
}

async function processForeshadowProgress(organizingPlan, chapter, projectId, materials, operations, errors) {
    if (!organizingPlan.foreshadowProgress) return;
    for (const fp of organizingPlan.foreshadowProgress) {
        if (!fp.name) continue;
        const existing = findForeshadowByName(projectId, materials, fp.name);
        if (!existing) continue;
        try {
            existing.progress = fp.status; existing.progressNote = fp.detail; existing.lastProgressChapter = chapter.chapterNumber;
            await store.setItem('materials', existing.id, existing);
            operations.push({ type: 'updateForeshadow', scope: 'foreshadowing', entityKey: existing.id, data: { status: fp.status, detail: fp.detail }, status: 'success' });
        } catch (e) { errors.push(`Failed to update foreshadow ${fp.name}: ${e.message}`); }
    }
}

async function processWorldviewChanges(organizingPlan, chapter, projectId, operations, errors) {
    if (!organizingPlan.worldviewChanges) return;
    for (const wc of organizingPlan.worldviewChanges) {
        if (!wc.name) continue;
        try {
            await stateKVIndex.set(projectId, 'worldview', wc.name, 'evolution', { type: wc.type, detail: wc.detail, chapter: chapter.chapterNumber }, chapter.chapterNumber);
            operations.push({ type: 'updateWorldview', scope: 'worldview', entityKey: wc.name, data: { type: wc.type, detail: wc.detail }, status: 'success' });
        } catch (e) { errors.push(`Failed to update worldview ${wc.name}: ${e.message}`); }
    }
}

module.exports = { processNewMaterials, processArchiveCandidates, processForeshadowProgress, processWorldviewChanges, findMaterialByName, findForeshadowByName };
