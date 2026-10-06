const store = require('../../../store');
const { characterBind, inferPermanence } = require('../../characterBind');
const { buildItemProperties } = require('../../itemStageParser');
const { v4: uuidv4 } = require('uuid');

async function processBindChanges(charUpdate, existingMat, chapter, projectId, operations, errors) {
    if (!charUpdate.bindChanges || !Array.isArray(charUpdate.bindChanges)) return;

    for (const bc of charUpdate.bindChanges) {
        try {
            if (bc.action === 'acquire' && bc.itemName) {
                await handleBindAcquire(bc, existingMat, chapter, projectId, operations);
            } else if (bc.action === 'lose' && bc.itemName) {
                await handleBindLose(bc, existingMat, projectId, operations);
            } else if (bc.action === 'changePermanence' && bc.itemName) {
                await handleBindPermanenceChange(bc, existingMat, projectId, operations);
            }
        } catch (bindErr) {
            errors.push(`Failed to process bind change for ${charUpdate.name}: ${bindErr.message}`);
        }
    }
}

async function handleBindAcquire(bc, existingMat, chapter, projectId, operations) {
    const existingDefs = await store.queryItems('item-definitions', { projectId, name: bc.itemName });
    let defId = existingDefs.length > 0 ? existingDefs[0].id : null;
    if (!defId) {
        defId = `def-${uuidv4()}`;
        // P0-3 止血：不再把 bindChange 描述复制进定义（内容唯一存 materials），只留身份 + 回指素材
        const sameMats = await store.queryItems('materials', { projectId, name: bc.itemName });
        const srcContent = sameMats[0] ? (sameMats[0].currentContent || sameMats[0].initialContent || '') : '';
        await store.setItem('item-definitions', defId, {
            id: defId, projectId, defType: bc.bindType || 'equipment',
            name: bc.itemName, materialId: sameMats[0]?.id || null, rarity: 'common',
            briefDesc: '', summaryDesc: '', detailDesc: '', loreDesc: '',
            briefTokens: 0, summaryTokens: 0, detailTokens: 0, loreTokens: 0,
            propertiesJson: buildItemProperties(srcContent), constraintsJson: {}, sourceChapter: chapter.chapterNumber, tags: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
    }
    const charId = existingMat ? existingMat.id : null;
    if (charId) {
        await characterBind.bindItem(projectId, charId, defId, bc.bindType || 'equipment', {
            bindStatus: 'active',
            permanence: bc.permanence || inferPermanence(bc.description || '', bc.bindType || 'equipment'),
            acquiredChapter: chapter.chapterNumber,
            customName: bc.itemName
        });
        operations.push({ type: 'acquireBind', scope: 'bind', entityKey: charId, data: { itemName: bc.itemName, bindType: bc.bindType, permanence: bc.permanence }, status: 'success' });
    }
}

async function handleBindLose(bc, existingMat, projectId, operations) {
    const charId = existingMat ? existingMat.id : null;
    if (!charId) return;
    const binds = await characterBind.getBindsForCharacter(charId);
    const targetBind = binds.find(b => b.customName === bc.itemName || b.name === bc.itemName);
    if (targetBind) {
        await characterBind.unbindItem(targetBind.id, bc.reason || 'lost');
        operations.push({ type: 'loseBind', scope: 'bind', entityKey: charId, data: { itemName: bc.itemName, reason: bc.reason }, status: 'success' });
    }
}

async function handleBindPermanenceChange(bc, existingMat, projectId, operations) {
    const charId = existingMat ? existingMat.id : null;
    if (!charId || !bc.newPermanence) return;
    const binds = await characterBind.getBindsForCharacter(charId);
    const targetBind = binds.find(b => b.customName === bc.itemName || b.name === bc.itemName);
    if (targetBind) {
        await characterBind.updatePermanence(targetBind.id, bc.newPermanence);
        operations.push({ type: 'changePermanence', scope: 'bind', entityKey: charId, data: { itemName: bc.itemName, from: targetBind.permanence, to: bc.newPermanence }, status: 'success' });
    }
}

module.exports = { processBindChanges, handleBindAcquire, handleBindLose, handleBindPermanenceChange };
