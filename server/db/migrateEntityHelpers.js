const logger = require('../../shared/logger');
const store = require('../../store');

function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 2);
}

function buildBriefDesc(content, maxLen) {
    if (!content) return '';
    const lines = content.split('\n').filter(l => l.trim());
    const brief = lines.slice(0, 2).join('。');
    return brief.substring(0, maxLen || 100);
}

function buildSummaryDesc(content, maxLen) {
    if (!content) return '';
    return content.substring(0, maxLen || 300);
}

function buildDetailDesc(content, maxLen) {
    if (!content) return '';
    return content.substring(0, maxLen || 800);
}

function buildLoreDesc(content, maxLen) {
    if (!content) return '';
    return content.substring(0, maxLen || 2000);
}

async function createItemDefinition(store, defId, projectId, defType, name, content, sourceChapter) {
    const existing = await store.getItem('item-definitions', defId);
    if (existing) return false;
    await store.setItem('item-definitions', defId, {
        id: defId, projectId, defType, name,
        rarity: 'common',
        briefDesc: buildBriefDesc(content),
        summaryDesc: buildSummaryDesc(content),
        detailDesc: buildDetailDesc(content),
        loreDesc: buildLoreDesc(content),
        briefTokens: estimateTokens(buildBriefDesc(content)),
        summaryTokens: estimateTokens(buildSummaryDesc(content)),
        detailTokens: estimateTokens(buildDetailDesc(content)),
        loreTokens: estimateTokens(buildLoreDesc(content)),
        propertiesJson: {}, constraintsJson: {},
        sourceChapter: sourceChapter || null, tags: []
    });
    return true;
}

async function createCharacterBind(store, bindId, projectId, characterId, defId, bindType, acquiredChapter) {
    await store.setItem('character-binds', bindId, {
        id: bindId, projectId, characterId, defId, bindType,
        bindStatus: 'active', acquiredChapter: acquiredChapter || 0,
        masteryLevel: '初学', masteryProgress: 0,
        personalNotes: '', customName: '', slotPosition: '', bindOrder: 0
    });
}

async function createCharacterRelation(store, relId, projectId, fromId, toId, relLabel, startChapter) {
    await store.setItem('character-relations', relId, {
        id: relId, projectId, fromCharacterId: fromId,
        toCharacterId: toId, relType: 'other', relLabel,
        strength: 50, trustLevel: 50,
        startChapter: startChapter || 0, isSecret: false, notes: ''
    });
}

async function markMaterialMigrated(store, matId) {
    const mat = await store.getItem('materials', matId);
    if (mat && !mat.migrated) {
        mat.migrated = true;
        mat.migratedAt = new Date().toISOString();
        await store.setItem('materials', matId, mat);
    }
}

function parseSectionItems(content, sectionPattern, delimiter) {
    const match = content.match(sectionPattern);
    if (!match) return [];
    return match[1].split(delimiter).map(s => s.trim()).filter(Boolean);
}

function parseRelations(content, sectionPattern) {
    const match = content.match(sectionPattern);
    if (!match) return [];
    const parts = match[1].split(/[;；]/).map(s => s.trim()).filter(Boolean);
    const relations = [];
    for (const part of parts) {
        const m = part.match(/(.+?)[：:](.+)/);
        if (m) relations.push({ targetName: m[1].trim(), relLabel: m[2].trim() });
    }
    return relations;
}

module.exports = {
    estimateTokens, buildBriefDesc, buildSummaryDesc, buildDetailDesc, buildLoreDesc,
    createItemDefinition, createCharacterBind, createCharacterRelation,
    markMaterialMigrated, parseSectionItems, parseRelations
};
