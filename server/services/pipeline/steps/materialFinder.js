const logger = require('../../../shared/logger');
const store = require('../../../store');

function findMaterialByName(materials, name, type) {
    if (!name) return null;
    const trimmed = name.trim();
    let match = materials.find(m => m.name === trimmed && (!type || m.type === type));
    if (match) return match;
    match = materials.find(m => m.name?.includes(trimmed) && (!type || m.type === type));
    if (match) return match;
    match = materials.find(m => trimmed.includes(m.name) && (!type || m.type === type) && m.name.length >= 2);
    return match || null;
}

function findMaterialById(materials, id) {
    return materials.find(m => m.id === id) || null;
}

function findMaterialsByType(materials, type) {
    return materials.filter(m => m.type === type && !m.archived);
}

function findCharacterMaterial(materials, name) {
    return findMaterialByName(materials, name, 'character');
}

function findEquipmentMaterial(materials, name) {
    return findMaterialByName(materials, name, 'equipment');
}

function findLocationMaterial(materials, name) {
    return findMaterialByName(materials, name, 'location');
}

function findFactionMaterial(materials, name) {
    return findMaterialByName(materials, name, 'faction');
}

function findRuleMaterial(materials, name) {
    return findMaterialByName(materials, name, 'rule');
}

function findPowerSystemMaterial(materials, name) {
    return findMaterialByName(materials, name, 'power-system');
}

function findOrCreateMaterial(materials, name, type, projectId, defaults = {}) {
    let mat = findMaterialByName(materials, name, type);
    if (mat) return { material: mat, created: false };
    const { v4: uuidv4 } = require('uuid');
    const id = defaults.id || uuidv4();
    mat = {
        id, projectId, type, name,
        initialContent: defaults.initialContent || '',
        currentContent: defaults.currentContent || '',
        sourceChapter: defaults.sourceChapter || 0,
        roleLevel: defaults.roleLevel || 'npc',
        parentPlane: defaults.parentPlane || '',
        isLocked: false, archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...defaults
    };
    return { material: mat, created: true };
}

module.exports = {
    findMaterialByName, findMaterialById, findMaterialsByType,
    findCharacterMaterial, findEquipmentMaterial, findLocationMaterial,
    findFactionMaterial, findRuleMaterial, findPowerSystemMaterial,
    findOrCreateMaterial
};
