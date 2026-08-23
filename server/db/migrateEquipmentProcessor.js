const store = require('../../store');
const { buildBriefDesc, buildSummaryDesc, buildDetailDesc, buildLoreDesc, estimateTokens, markMaterialMigrated } = require('./migrateEntityHelpers');

async function migrateEquipment(eq, counts) {
    const content = eq.currentContent || eq.initialContent || '';
    const defId = `def-equip-${eq.id}`;
    const existing = await store.getItem('item-definitions', defId);
    if (!existing) {
        await store.setItem('item-definitions', defId, {
            id: defId, projectId: eq.projectId, defType: 'equipment',
            name: eq.name, rarity: 'common',
            briefDesc: buildBriefDesc(content), summaryDesc: buildSummaryDesc(content),
            detailDesc: buildDetailDesc(content), loreDesc: buildLoreDesc(content),
            briefTokens: estimateTokens(buildBriefDesc(content)),
            summaryTokens: estimateTokens(buildSummaryDesc(content)),
            detailTokens: estimateTokens(buildDetailDesc(content)),
            loreTokens: estimateTokens(buildLoreDesc(content)),
            propertiesJson: {}, constraintsJson: {},
            sourceChapter: eq.sourceChapter || null, tags: []
        });
        counts.defCount++;
    }

    await store.setItem('entity-registry', eq.id, {
        id: eq.id, projectId: eq.projectId, entityType: 'equipment',
        name: eq.name, briefName: eq.name.substring(0, 4),
        roleLevel: 'npc', isActive: !eq.archived,
        firstAppearChapter: eq.sourceChapter || null,
        lastAppearChapter: eq.sourceChapter || null,
        appearCount: 0, parentPlane: eq.parentPlane || null,
        parentFaction: eq.parentFaction || null, tags: []
    });
    counts.regCount++;
    await markMaterialMigrated(store, eq.id);
}

module.exports = { migrateEquipment };
