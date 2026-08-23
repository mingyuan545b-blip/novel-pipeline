const logger = require('../shared/logger');
const store = require('../store');

async function queryItemsByType(projectId, type, options = {}) {
    const { includeArchived = false, sortBy = 'createdAt', sortOrder = 'desc', limit = 0 } = options;
    let items = await store.queryItems('materials', { projectId, type });
    if (!includeArchived) items = items.filter(m => !m.archived);
    items.sort((a, b) => {
        const va = a[sortBy] || '';
        const vb = b[sortBy] || '';
        return sortOrder === 'desc' ? (va > vb ? -1 : 1) : (va < vb ? -1 : 1);
    });
    return limit > 0 ? items.slice(0, limit) : items;
}

async function queryItemsByParentPlane(projectId, parentPlane, options = {}) {
    const items = await store.queryItems('materials', { projectId, parentPlane });
    const { includeArchived = false } = options;
    return includeArchived ? items : items.filter(m => !m.archived);
}

async function queryActiveCharacters(projectId) {
    return queryItemsByType(projectId, 'character', { includeArchived: false });
}

async function queryActiveFactions(projectId) {
    return queryItemsByType(projectId, 'faction', { includeArchived: false });
}

async function queryActiveEquipment(projectId) {
    return queryItemsByType(projectId, 'equipment', { includeArchived: false });
}

async function queryActiveLocations(projectId) {
    return queryItemsByType(projectId, 'location', { includeArchived: false });
}

async function queryActiveForeshadowing(projectId) {
    return queryItemsByType(projectId, 'foreshadowing', { includeArchived: false });
}

async function queryActiveRules(projectId) {
    return queryItemsByType(projectId, 'rule', { includeArchived: false });
}

async function queryActivePowerSystems(projectId) {
    return queryItemsByType(projectId, 'power-system', { includeArchived: false });
}

async function queryAllActive(projectId) {
    const items = await store.queryItems('materials', { projectId });
    return items.filter(m => !m.archived);
}

async function countByType(projectId) {
    const items = await queryAllActive(projectId);
    const counts = {};
    for (const item of items) {
        counts[item.type] = (counts[item.type] || 0) + 1;
    }
    return counts;
}

module.exports = {
    queryItemsByType, queryItemsByParentPlane,
    queryActiveCharacters, queryActiveFactions, queryActiveEquipment,
    queryActiveLocations, queryActiveForeshadowing, queryActiveRules,
    queryActivePowerSystems, queryAllActive, countByType
};
