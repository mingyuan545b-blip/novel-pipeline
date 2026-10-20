const store = require('../store');
const { parseFile } = require('./fileParserCore');

const TYPE_MAP = {
    character: 'character',
    relationship: 'relationship',
    worldview: 'worldview',
    location: 'location',
    equipment: 'equipment',
    'power-system': 'power-system',
    plot: 'plot',
    other: 'other'
};

function importParsedToProject(projectId, parsed, selectedCategories) {
    const importCounts = {};
    const allTypes = selectedCategories && selectedCategories.length > 0
        ? selectedCategories
        : Object.keys(parsed.categories);

    for (const type of allTypes) {
        const items = parsed.categories[type];
        if (!items || items.length === 0) continue;

        for (const item of items) {
            const id = 'mat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
            const material = {
                id,
                projectId,
                type: TYPE_MAP[type] || type,
                name: item.name,
                initialContent: item.content || '',
                currentContent: item.content || '',
                version: 1,
                status: 'active',
                sourceFile: parsed.fileName,
                changeLog: [{
                    action: 'import',
                    from: parsed.fileName,
                    chapterNumber: 0,
                    timestamp: new Date().toISOString(),
                    reason: `从文件 ${parsed.fileName} 导入`
                }],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            store.setItem('materials', material.id, material);
            importCounts[type] = (importCounts[type] || 0) + 1;
        }
    }

    return importCounts;
}

function importParsedToFranchise(franchiseId, parsed, selectedCategories) {
    const importCounts = {};
    const allTypes = selectedCategories && selectedCategories.length > 0
        ? selectedCategories
        : Object.keys(parsed.categories);

    for (const type of allTypes) {
        const items = parsed.categories[type];
        if (!items || items.length === 0) continue;

        for (const item of items) {
            const id = 'fs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
            const summary = {
                id,
                franchiseId,
                type: TYPE_MAP[type] || type,
                name: item.name,
                content: item.content || '',
                sourceFile: parsed.fileName,
                importedAt: new Date().toISOString()
            };
            importCounts[type] = (importCounts[type] || 0) + 1;
        }
    }

    return importCounts;
}

module.exports = { importParsedToProject, importParsedToFranchise };
