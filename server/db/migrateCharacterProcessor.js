const logger = require('../../shared/logger');
const store = require('../../store');
const {
    estimateTokens, createItemDefinition, createCharacterBind,
    createCharacterRelation, markMaterialMigrated,
    parseSectionItems, parseRelations
} = require('./migrateEntityHelpers');

async function migrateCharacterEquipment(ch, content, allMats, counts) {
    const items = parseSectionItems(content, /【(?:装备|法宝|持有物|武器)】(.+)/, /[、,，]/);
    for (const itemName of items) {
        const defId = `def-equip-${Buffer.from(itemName).toString('base64').substring(0, 20)}`;
        const created = await createItemDefinition(store, defId, ch.projectId, 'equipment', itemName, itemName, ch.sourceChapter);
        if (created) counts.defCount++;
        const bindId = `bind-${ch.id}-${defId}-equipment`;
        await createCharacterBind(store, bindId, ch.projectId, ch.id, defId, 'equipment', ch.sourceChapter);
        counts.bindCount++;
    }
}

async function migrateCharacterTechnique(ch, content, allMats, counts) {
    const items = parseSectionItems(content, /【(?:功法|武技|技能|修炼)】(.+)/, /[、,，]/);
    for (const itemName of items) {
        const defId = `def-tech-${Buffer.from(itemName).toString('base64').substring(0, 20)}`;
        const created = await createItemDefinition(store, defId, ch.projectId, 'technique', itemName, itemName, ch.sourceChapter);
        if (created) counts.defCount++;
        const bindId = `bind-${ch.id}-${defId}-technique`;
        await createCharacterBind(store, bindId, ch.projectId, ch.id, defId, 'technique', ch.sourceChapter);
        counts.bindCount++;
    }
}

async function migrateCharacterRelations(ch, content, allMats, counts) {
    const relations = parseRelations(content, /【(?:关系|人际)】(.+)/);
    for (const { targetName, relLabel } of relations) {
        const relId = `rel-${ch.id}-${Buffer.from(targetName).toString('base64').substring(0, 16)}`;
        const targetChar = allMats.find(mat =>
            mat.projectId === ch.projectId && mat.type === 'character' && !mat.archived && mat.name === targetName
        );
        const toCharacterId = targetChar ? targetChar.id : targetName;
        await createCharacterRelation(store, relId, ch.projectId, ch.id, toCharacterId, relLabel, ch.sourceChapter);
        counts.relCount++;
    }
}

async function migrateCharacter(ch, allMats, counts) {
    const content = ch.currentContent || ch.initialContent || '';
    await store.setItem('entity-registry', ch.id, {
        id: ch.id, projectId: ch.projectId, entityType: 'character',
        name: ch.name, briefName: ch.name.substring(0, 4),
        roleLevel: ch.roleLevel || 'npc', isActive: true,
        firstAppearChapter: ch.sourceChapter || null,
        lastAppearChapter: ch.sourceChapter || null,
        appearCount: 0, parentPlane: ch.parentPlane || null,
        parentFaction: ch.parentFaction || null, tags: []
    });
    counts.regCount++;

    await migrateCharacterEquipment(ch, content, allMats, counts);
    await migrateCharacterTechnique(ch, content, allMats, counts);
    await migrateCharacterRelations(ch, content, allMats, counts);
    await markMaterialMigrated(store, ch.id);
}

module.exports = { migrateCharacter };
