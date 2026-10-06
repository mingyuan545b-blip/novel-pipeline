const logger = require('../../../shared/logger');
const store = require('../../../store');
const stateKVIndex = require('../../stateKVIndex');
const entityCenter = require('../../entityCenter');
const { normalizeDeltaKeys, getFieldsForRoleLevel } = require('../../../config/characterStateSchemas');
const { processRelationshipChanges } = require('./materialRelationProcessor');
const { processBindChanges } = require('./materialBindProcessor');

async function processCharacterUpdates(organizingPlan, chapter, projectId, materials, schema, operations, errors, warnings = []) {
    if (!organizingPlan.characters) return;

    for (const charUpdate of organizingPlan.characters) {
        if (!charUpdate.name) continue;

        // 陷阱#79修复：findCharacterMaterial此前只查materials表，但material-registrar创建角色到entityCenter
        // 导致existingMat=null，processTraitNotes的if(!existingMat) return跳过深度字段写入
        // 改为优先查materials表，fallback查entityCenter，确保charId能拿到
        let existingMat = findCharacterMaterial(projectId, materials, charUpdate.name);
        if (!existingMat) {
            try {
                const entity = await entityCenter.findEntityByName(projectId, 'character', charUpdate.name);
                if (entity) {
                    existingMat = { id: entity.id, name: entity.name, roleLevel: entity.roleLevel, _fromEntityCenter: true };
                }
            } catch (e) { logger.warn('materialCharProc', `[trap#79] entityCenter fallback failed for ${charUpdate.name}: ${e.message}`); }
        }

        // 修复陷阱#70：organizingPlan.characters[].roleLevel此前被丢弃，
        // 导致主角被标npc。material-organizer已输出roleLevel=protagonist/supporting/npc，需透传到实体。
        await processRoleLevelUpdate(charUpdate, chapter, projectId, operations, errors);

        await processStateChanges(charUpdate, existingMat, chapter, projectId, schema, operations, errors, warnings);
        await processTraitNotes(charUpdate, existingMat, chapter, projectId, schema, operations, errors);
        await processBindChanges(charUpdate, existingMat, chapter, projectId, operations, errors);
        await processRelationshipChanges(charUpdate, existingMat, chapter, projectId, materials, operations, errors);
        await processLifecycleTransition(charUpdate, existingMat, chapter, projectId, operations, errors, warnings);
    }
}

async function processRoleLevelUpdate(charUpdate, chapter, projectId, operations, errors) {
    if (!charUpdate.roleLevel) return;
    try {
        const entity = await entityCenter.findEntityByName(projectId, 'character', charUpdate.name);
        if (!entity) return;
        if (entity.roleLevel === charUpdate.roleLevel) return;
        await entityCenter.updateEntity(entity.id, { roleLevel: charUpdate.roleLevel });
        operations.push({
            type: 'updateRoleLevel', scope: 'character',
            entityKey: entity.id,
            data: { name: charUpdate.name, from: entity.roleLevel, to: charUpdate.roleLevel },
            status: 'success'
        });
        logger.info('materialCharProc', `[ch${chapter.chapterNumber}] ${charUpdate.name} roleLevel: ${entity.roleLevel} → ${charUpdate.roleLevel}`);
    } catch (e) {
        errors.push(`Failed to update roleLevel for ${charUpdate.name}: ${e.message}`);
    }
}

async function processLifecycleTransition(charUpdate, existingMat, chapter, projectId, operations, errors, warnings = []) {
    if (!charUpdate.lifecycleTransition) return;

    const { toState, reason } = charUpdate.lifecycleTransition;
    if (!toState) return;

    try {
        const entity = await entityCenter.findEntityByName(projectId, 'character', charUpdate.name);
        if (!entity) {
            warnings.push(`Lifecycle: entity not found for "${charUpdate.name}"`);
            return;
        }
        const { transitionLifecycle } = require('../../entityCenter/entityCRUD');
        const result = await transitionLifecycle(entity.id, toState, reason || `第${chapter.chapterNumber}章事件`);
        if (result) {
            operations.push({
                type: 'lifecycleTransition', scope: 'character',
                entityKey: entity.id,
                data: { name: charUpdate.name, toState, reason: reason || `第${chapter.chapterNumber}章事件` },
                status: 'success'
            });
        } else {
            warnings.push(`Lifecycle: invalid transition "${charUpdate.name}" → ${toState}`);
        }
    } catch (e) {
        errors.push(`Lifecycle transition failed for ${charUpdate.name}: ${e.message}`);
    }
}

// S2：KV 状态键统一为实体 id（此前写 material id、读 entity id → 深度字段永远读不到）
async function resolveCharacterEntityId(projectId, name) {
    try {
        const e = await entityCenter.findEntityByName(projectId, 'character', name);
        return e ? e.id : null;
    } catch (_) { return null; }
}

async function processStateChanges(charUpdate, existingMat, chapter, projectId, schema, operations, errors, warnings = []) {
    if (!charUpdate.stateChanges || Object.keys(charUpdate.stateChanges).length === 0) return;

    const charId = (await resolveCharacterEntityId(projectId, charUpdate.name)) || (existingMat ? existingMat.id : null);

    if (!charId && charUpdate.newMaterials) {
        warnings.push(`Character ${charUpdate.name} not found in materials, skipping state update`);
        return;
    }

    const delta = {};
    for (const [key, change] of Object.entries(charUpdate.stateChanges)) {
        if (change && change.to !== undefined) {
            delta[key] = change.to;
        }
    }

    const normalizedDelta = normalizeDeltaKeys(delta, schema.genreId);
    const charRoleLevel = charUpdate.roleLevel || existingMat?.roleLevel || 'npc';
    const allowedFields = getFieldsForRoleLevel(schema.genreId, charRoleLevel);
    const filteredDelta = {};
    for (const [key, value] of Object.entries(normalizedDelta)) {
        if (allowedFields.includes(key) || key === 'name' || key === 'roleLevel') {
            filteredDelta[key] = value;
        }
    }

    if (Object.keys(filteredDelta).length === 0) return;

    try {
        const stateRecord = await stateKVIndex.updateCharacterState(
            projectId, charId, charUpdate.name, chapter.chapterNumber, filteredDelta, schema.genreId
        );
        operations.push({
            type: 'updateCharacterState',
            scope: 'character',
            entityKey: charId,
            data: filteredDelta,
            status: 'success',
            stateRecordId: stateRecord.id
        });
        try {
            const entity = await entityCenter.findEntityByName(projectId, 'character', charUpdate.name);
            if (entity) {
                await entityCenter.recordAppearance(entity.id, chapter.chapterNumber);
            }
        } catch (appearErr) {
            logger.warn('materialCharProc', 'EntityCenter appear count update failed for', charUpdate.name, ':', appearErr.message);
        }
    } catch (e) {
        errors.push(`Failed to update state for ${charUpdate.name}: ${e.message}`);
    }
}

async function processTraitNotes(charUpdate, existingMat, chapter, projectId, schema, operations, errors) {
    // 陷阱#79修复：条件此前只检查4个字段，但delta映射了8个字段
    // 如果只传innerConflictNote/independentStanceNote/fateArcNote/protagonistMirrorNote而没有前4个，会误return
    const hasAnyTraitNote = charUpdate.personalityNote || charUpdate.speakingToneNote ||
        charUpdate.signatureDetailNote || charUpdate.catchphraseNote ||
        charUpdate.protagonistMirrorNote || charUpdate.independentStanceNote ||
        charUpdate.fateArcNote || charUpdate.innerConflictNote;
    if (!hasAnyTraitNote) return;

    const delta = {};
    if (charUpdate.personalityNote) delta.personality = charUpdate.personalityNote;
    if (charUpdate.speakingToneNote) delta.speakingTone = charUpdate.speakingToneNote;
    if (charUpdate.catchphraseNote) delta.catchphrases = [charUpdate.catchphraseNote];
    if (charUpdate.signatureDetailNote) delta.signatureDetail = charUpdate.signatureDetailNote;
    if (charUpdate.protagonistMirrorNote) delta.protagonistMirror = charUpdate.protagonistMirrorNote;
    if (charUpdate.independentStanceNote) delta.independentStance = charUpdate.independentStanceNote;
    if (charUpdate.fateArcNote) delta.fateArc = charUpdate.fateArcNote;
    if (charUpdate.innerConflictNote) delta.innerConflict = charUpdate.innerConflictNote;

    const charId = (await resolveCharacterEntityId(projectId, charUpdate.name)) || (existingMat ? existingMat.id : null);
    if (!charId || Object.keys(delta).length === 0) return;

    try {
        await stateKVIndex.updateCharacterState(
            projectId, charId, charUpdate.name, chapter.chapterNumber, delta, schema.genreId
        );
        operations.push({
            type: 'updateCharacterTraits',
            scope: 'character',
            entityKey: charId,
            data: delta,
            status: 'success'
        });
    } catch (e) {
        errors.push(`Failed to update traits for ${charUpdate.name}: ${e.message}`);
    }
}

// findCharacterMaterial 已提取到 materialCharacterFinder.js（行为不变，保持原导出签名）
const { findCharacterMaterial } = require('./materialCharacterFinder');

module.exports = { processCharacterUpdates, findCharacterMaterial };
