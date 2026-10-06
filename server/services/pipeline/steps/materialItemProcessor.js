const logger = require('../../../shared/logger');
const store = require('../../../store');
const entityCenter = require('../../entityCenter');
const entityRegistry = require('../../entityRegistry');
const { validateMaterial } = require('../../materialValidator');
const { validateMaterialDepth } = require('../../materialDepthValidator');
const stateKVIndex = require('../../stateKVIndex');
const { resolveTopicKey } = require('../../worldviewTopics');
const { extractCharacterStateFromContent } = require('../outlineResponseParser');
const { v4: uuidv4 } = require('uuid');
const { findMaterialByName: _findMat, findForeshadowByName: _findForeshadow } = require('./materialFinder');
const { buildCharacterEntityPatch } = require('../entityProjection');
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

async function processNewMaterials(organizingPlan, chapter, projectId, materials, schema, operations, errors, warnings = []) {
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
            warnings.push(`素材类型未知，已降级保留：${newMat.name} "${newMat.type}" -> "${fallback}"`);
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
            // P1-B：章节级新建未过类型校验不再丢弃（否则"实体中心有角色、素材库没有"→数据不一致）。
            // 降级为 warning + unvalidated 标记落库，缺口在实体中心/体检面板可见。
            material.unvalidated = true;
            material.validationIssues = validation.missing || [];
            warnings.push(`New material ${newMat.name} 未过类型校验，降级落库(unvalidated)：${validation.message || (validation.missing || []).join(', ')}`);
            logger.warn('materialRegistrar', `[unvalidated] 素材"${newMat.name}"未过类型校验，已保留并标记`, { projectId, missing: material.validationIssues });
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
                warnings.push(`Material ${newMat.name} depth validation failed: missing ${depthResult.missing.join(', ')}`);
            }
        }

        try {
            await store.setItem('materials', matId, material);
            if (newMat.type === 'character') {
                try {
                    const content = newMat.description || newMat.detail || '';
                    const parsed = extractCharacterStateFromContent(content, {});
                    // 单一投影：字段清单集中在 entityProjection（占位/空值不覆盖）
                    const patch = buildCharacterEntityPatch(newMat, parsed);
                    patch.roleLevel = newMat.roleLevel || 'npc';
                    patch.sourceChapter = chapter.chapterNumber || 0;
                    patch.sourceContent = content.substring(0, 2000);
                    await entityCenter.getOrCreateEntity(projectId, 'character', newMat.name, patch);
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
    // 主题归一（P0-3）：先取已有主题（KV + 素材库世界观），把"新名字"归到既有主题，
    // 避免同一设定跨章被拆成多条碎片（实测 34 条：三账合议制 ×3、机制/模式并存）。
    let existingKeys = [];
    try {
        const kvRows = await store.queryItems('state-kv-index', { projectId, scope: 'worldview' });
        const mats = await store.queryItems('materials', { projectId, type: 'worldview' });
        existingKeys = [...new Set([...kvRows.map(r => r.entityKey), ...mats.map(m => m.name)])].filter(Boolean);
    } catch (e) { logger.warn('materialItem', 'worldview topic keys load failed:', e.message); }
    const seen = new Set(existingKeys);

    for (const wc of organizingPlan.worldviewChanges) {
        if (!wc.name) continue;
        try {
            const key = resolveTopicKey(wc.name, seen);
            if (key !== wc.name) operations.push({ type: 'worldviewTopicMerged', scope: 'worldview', entityKey: key, data: { incoming: wc.name }, status: 'success' });
            seen.add(key);
            await stateKVIndex.set(projectId, 'worldview', key, 'evolution', { type: wc.type, detail: wc.detail, chapter: chapter.chapterNumber }, chapter.chapterNumber);
            operations.push({ type: 'updateWorldview', scope: 'worldview', entityKey: key, data: { type: wc.type, detail: wc.detail }, status: 'success' });
        } catch (e) { errors.push(`Failed to update worldview ${wc.name}: ${e.message}`); }
    }
}

module.exports = { processNewMaterials, processArchiveCandidates, processForeshadowProgress, processWorldviewChanges, findMaterialByName, findForeshadowByName };
