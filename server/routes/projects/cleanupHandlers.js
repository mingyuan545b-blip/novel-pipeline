/**
 * cleanupHandlers - 各target清理逻辑
 */
const store = require('../../store');
const fs = require('fs');
const path = require('path');

async function deleteStoreItemsAndFiles(type, projectId) {
    let del = 0;
    const items = await store.queryItems(type, { projectId });
    for (const item of items) { if (item.id) { await store.deleteItem(type, item.id); del++; } }
    const dataDir = store.DATA_DIR;
    const dir = path.join(dataDir, type);
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).filter(f => f.includes(projectId) && f.endsWith('.json')).forEach(f => {
            fs.unlinkSync(path.join(dir, f)); del++;
        });
    }
    return del;
}

async function cleanupChapters(id, project) {
    const del = await deleteStoreItemsAndFiles('chapters', id);
    const delRev = await deleteStoreItemsAndFiles('reviews', id);
    project.currentChapter = 0;
    project.status = 'draft';
    return { chapters: del, reviews: delRev };
}

async function cleanupTimelines(id) {
    const del = await deleteStoreItemsAndFiles('timelines', id);
    const delQ = await deleteStoreItemsAndFiles('quests', id);
    return { timelines: del, quests: delQ };
}

async function cleanupMaterials(id, shouldKeepLocked) {
    let del = 0; let keptFoundation = 0;
    const materials = await store.queryItems('materials', { projectId: id });
    for (const mat of materials) {
        if (shouldKeepLocked && mat.isLocked) continue;
        if (await store.isFoundationMaterial(mat)) { keptFoundation++; continue; }
        await store.deleteItem('materials', mat.id); del++;
    }
    return {
        materials: del,
        keptLocked: shouldKeepLocked ? materials.filter(m => m.isLocked).length : 0,
        keptFoundation
    };
}

async function cleanupKnowledge(id) {
    const del = await deleteStoreItemsAndFiles('memory-layers', id);
    const delS = await deleteStoreItemsAndFiles('state-snapshots', id);
    const delR = await deleteStoreItemsAndFiles('consistency-reports', id);
    return { memoryLayers: del, snapshots: delS, consistencyReports: delR };
}

async function cleanupOutlines(id) {
    let del = 0;
    const materials = await store.queryItems('materials', { projectId: id });
    for (const mat of materials) {
        if (mat.type === 'chapter-outline') { await store.deleteItem('materials', mat.id); del++; }
    }
    return { outlines: del };
}

async function cleanupLogs(id) {
    let del = 0;
    const outputDir = path.join(__dirname, '..', '..', '..', 'output', id);
    if (fs.existsSync(outputDir)) { fs.rmSync(outputDir, { recursive: true, force: true }); del++; }
    const dataDir = store.DATA_DIR;
    const exportDir = path.join(dataDir, id, 'export');
    if (fs.existsSync(exportDir)) { fs.rmSync(exportDir, { recursive: true, force: true }); del++; }
    return { outputDirs: del };
}

function cleanupRemediation(project) {
    project.writerPromptAdditions = [];
    project.reviewPromptAdditions = [];
    if (project.styleGuidance) { delete project.styleGuidance; delete project.styleGuidanceUpdatedAt; }
    return { remediation: true };
}

module.exports = { cleanupChapters, cleanupTimelines, cleanupMaterials, cleanupKnowledge, cleanupOutlines, cleanupLogs, cleanupRemediation };
