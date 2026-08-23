const store = require('../store');
const { getDataContext } = require('./dataContext');

async function resolveReference(value, type, projectId) {
    if (!value) return { resolved: null, original: value, method: 'empty' };

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        const mat = await store.getItem('materials', value);
        if (mat && mat.projectId === projectId && (!type || mat.type === type)) {
            return { resolved: value, original: value, method: 'direct-id', name: mat.name };
        }
    }

    const allMats = (await store.listItems('materials')).filter(m => m.projectId === projectId && !m.archived);
    const candidates = type ? allMats.filter(m => m.type === type) : allMats;

    const exactMatch = candidates.find(m => m.name === value);
    if (exactMatch) {
        return { resolved: exactMatch.id, original: value, method: 'exact-name', name: exactMatch.name };
    }

    const lowerVal = value.toLowerCase().replace(/[\s\-_·]/g, '');
    const fuzzyMatch = candidates.find(m => {
        const lowerName = m.name.toLowerCase().replace(/[\s\-_·]/g, '');
        return lowerName === lowerVal;
    });
    if (fuzzyMatch) {
        return { resolved: fuzzyMatch.id, original: value, method: 'fuzzy-name', name: fuzzyMatch.name };
    }

    const partialMatch = candidates.find(m => {
        const lowerName = m.name.toLowerCase().replace(/[\s\-_·]/g, '');
        return lowerName.includes(lowerVal) || lowerVal.includes(lowerName);
    });
    if (partialMatch) {
        return { resolved: partialMatch.id, original: value, method: 'partial-name', name: partialMatch.name };
    }

    return { resolved: null, original: value, method: 'unresolved' };
}

function resolveParentPlane(parentPlane, projectId) {
    if (parentPlane === null || parentPlane === undefined || parentPlane === 'null') {
        return { resolved: null, original: parentPlane, method: 'main-world' };
    }
    return resolveReference(parentPlane, 'sub-plane', projectId);
}

async function resolveParentFaction(parentFaction, projectId) {
    if (parentFaction === null || parentFaction === undefined || parentFaction === 'null') {
        return { resolved: null, original: parentFaction, method: 'no-faction' };
    }
    return await resolveReference(parentFaction, 'faction', projectId);
}

async function normalizeMaterial(material, projectId) {
    const updates = {};

    if (material.parentPlane) {
        const result = await resolveParentPlane(material.parentPlane, projectId);
        if (result.resolved && result.method !== 'direct-id') {
            updates.parentPlane = result.resolved;
        }
    }

    if (material.parentFaction) {
        const result = await resolveParentFaction(material.parentFaction, projectId);
        if (result.resolved && result.method !== 'direct-id') {
            updates.parentFaction = result.resolved;
        }
    }

    return Object.keys(updates).length > 0 ? updates : null;
}

async function getProtagonistName(projectId) {
    try {
        const _miCtx = await getDataContext(projectId);
        const project = await _miCtx.getProject();
        return project?.styleProfile?.protagonistName || '主角';
    } catch (_) {
        return '主角';
    }
}

module.exports = {
    resolveReference,
    resolveParentPlane,
    resolveParentFaction,
    normalizeMaterial,
    getProtagonistName
};
