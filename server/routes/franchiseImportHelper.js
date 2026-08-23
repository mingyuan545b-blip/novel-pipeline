const store = require('../store');

async function importFromProject(franchise, importFromProjectId, importCategories, importCounts) {
    const srcProject = await store.getItem('projects', importFromProjectId);
    if (!srcProject) return;

    if (!franchise.genre && srcProject.genre) franchise.genre = srcProject.genre;
    if (!franchise.description && srcProject.description) franchise.description = srcProject.description.substring(0, 500);
    franchise.sourceProjectId = importFromProjectId;
    franchise.updatedAt = new Date().toISOString();
    await store.setItem('franchises', franchise.id, franchise);

    const allMats = await store.queryItems('materials', { projectId: importFromProjectId });
    const typeMap = {
        characters: 'character', relationships: 'relationship', worldview: 'worldview',
        location: 'location', equipment: 'equipment', powerSystem: 'power-system',
        plot: 'plot', other: 'other'
    };

    for (const cat of importCategories) {
        const matType = typeMap[cat];
        if (!matType) continue;
        const mats = allMats.filter(m => m.type === matType);
        for (const m of mats) {
            const summary = {
                id: 'fs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                franchiseId: franchise.id, sourceProjectId: importFromProjectId,
                sourceMaterialId: m.id, type: m.type, name: m.name,
                content: m.currentContent || m.initialContent || '',
                importedAt: new Date().toISOString()
            };
            await store.setItem('franchise-materials', summary.id, summary);
            importCounts[cat] = (importCounts[cat] || 0) + 1;
        }
    }

    if (importCategories.includes('mapNodes')) {
        const srcMapNodes = await store.queryItems('map-nodes', { projectId: importFromProjectId });
        for (const node of srcMapNodes) {
            const summary = {
                id: 'fs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                franchiseId: franchise.id, sourceProjectId: importFromProjectId,
                type: 'map-node', name: node.name, level: node.level, parentId: node.parentId,
                content: node.description || '', factionName: node.factionName || '',
                importedAt: new Date().toISOString()
            };
            await store.setItem('franchise-materials', summary.id, summary);
            importCounts.mapNodes++;
        }
    }

    if (importCategories.includes('quests')) {
        const srcQuests = await store.queryItems('quests', { projectId: importFromProjectId });
        for (const q of srcQuests) {
            const summary = {
                id: 'fs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                franchiseId: franchise.id, sourceProjectId: importFromProjectId,
                type: 'quest', name: q.title, content: q.description || '',
                importedAt: new Date().toISOString()
            };
            await store.setItem('franchise-materials', summary.id, summary);
            importCounts.quests++;
        }
    }

    if (importCategories.includes('timelines')) {
        const srcTimelines = await store.queryItems('timelines', { projectId: importFromProjectId });
        for (const t of srcTimelines) {
            const summary = {
                id: 'fs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                franchiseId: franchise.id, sourceProjectId: importFromProjectId,
                type: 'timeline', name: t.title, content: t.description || '',
                importedAt: new Date().toISOString()
            };
            await store.setItem('franchise-materials', summary.id, summary);
            importCounts.timelines++;
        }
    }
}

module.exports = { importFromProject };
