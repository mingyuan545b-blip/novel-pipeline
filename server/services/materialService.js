const store = require('../store');

async function getMaterialsByProject(projectId, options = {}) {
    if (!projectId) return [];
    let materials = await store.queryItems('materials', { projectId });
    if (options.type) materials = materials.filter(m => m.type === options.type);
    if (!options.includeArchived) materials = materials.filter(m => !m.archived);
    if (!options.includeLocked) materials = materials.filter(m => !m.isLocked);
    return materials;
}

async function getActiveMaterials(projectId, type = null) {
    return getMaterialsByProject(projectId, { type, includeArchived: false });
}

async function getUnlockedMaterials(projectId, type = null) {
    return getMaterialsByProject(projectId, { type, includeArchived: false, includeLocked: false });
}

async function getCharacters(projectId) {
    return getActiveMaterials(projectId, 'character');
}

async function getWorldviews(projectId) {
    return getActiveMaterials(projectId, 'worldview');
}

async function getForeshadowing(projectId) {
    return getActiveMaterials(projectId, 'foreshadowing');
}

async function getNarrativeBridges(projectId) {
    return getActiveMaterials(projectId, 'narrative-bridge');
}

async function getMaterial(materialId) {
    if (!materialId) return null;
    return await store.getItem('materials', materialId);
}

async function updateMaterial(materialId, updates) {
    const material = await getMaterial(materialId);
    if (!material) return null;
    const updated = { ...material, ...updates, updatedAt: new Date().toISOString() };
    await store.setItem('materials', material.projectId || 'unknown', updated.id, updated);
    return updated;
}

async function getMaterialByName(projectId, type, name) {
    const materials = await getActiveMaterials(projectId, type);
    return materials.find(m => m.name === name) || null;
}

module.exports = {
    getMaterialsByProject,
    getActiveMaterials,
    getUnlockedMaterials,
    getCharacters,
    getWorldviews,
    getForeshadowing,
    getNarrativeBridges,
    getMaterial,
    updateMaterial,
    getMaterialByName,
};
