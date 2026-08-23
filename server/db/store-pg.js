const { trimItemData } = require('./storeCommon');
const { acquireLock, releaseLock, _lockQueues } = require('./store-pg-lock');
const { listItems, getItem } = require('./store-pg-core');
const { _writeItemUnlocked, deleteItem, IMMEDIATE_SAVE_TYPES } = require('./store-pg-writer');
const { queryItems, isFoundationMaterial, queryMaterialsByProject, queryChaptersByProject } = require('./store-pg-query');
const { countItemsByType } = require('./database-pg');
const logger = require('../shared/logger');

async function setItem(type, id, data, options = {}) {
    const release = await acquireLock(type, id);
    try {
        return await _writeItemUnlocked(type, id, data, options);
    } finally {
        releaseLock(type, id, release);
    }
}

async function updateItem(type, id, updateFn) {
    const release = await acquireLock(type, id);
    try {
        const current = await getItem(type, id);
        if (!current) return null;
        const updated = updateFn(current);
        if (!updated) return current;
        return _writeItemUnlocked(type, id, updated);
    } finally {
        releaseLock(type, id, release);
    }
}

async function countItems(type, filter) {
    if (!filter || typeof filter === 'function') {
        const items = await listItems(type);
        return items.filter(typeof filter === 'function' ? filter : () => true).length;
    }
    try {
        return await countItemsByType(type);
    } catch (_) {
        logger.warn('store-pg', 'countItemsByType DB query failed, falling back', { type, error: _.message || _ });
        const items = await listItems(type);
        return items.length;
    }
}

module.exports = {
    listItems,
    getItem,
    setItem,
    updateItem,
    deleteItem,
    queryItems,
    isFoundationMaterial,
    queryMaterialsByProject,
    queryChaptersByProject,
    countItems,
    trimItemData,
    _lockQueues
};
