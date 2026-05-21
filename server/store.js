const USE_SQLITE = process.env.USE_SQLITE !== 'false';

let _backend = null;
let _initPromise = null;

async function ensureBackend() {
    if (_backend) return _backend;

    if (USE_SQLITE) {
        try {
            const { initDatabaseAsync } = require('./db/database');
            const path = require('path');
            const dbPath = path.join(__dirname, '..', 'data', 'novel-pipeline.db');
            await initDatabaseAsync(dbPath);
            _backend = require('./db/store');
            console.log('[STORE] Using SQLite backend');
            return _backend;
        } catch (err) {
            console.warn(`[STORE] SQLite not available (${err.message}), falling back to JSON files`);
        }
    }

    _backend = require('./db/jsonStore');
    console.log('[STORE] Using JSON file backend');
    return _backend;
}

function getBackend() {
    if (_backend) return _backend;
    return require('./db/jsonStore');
}

function listItems(type) { return getBackend().listItems(type); }
function getItem(type, id) { return getBackend().getItem(type, id); }
async function setItem(type, id, data) { return await getBackend().setItem(type, id, data); }
async function updateItem(type, id, updateFn) { return await getBackend().updateItem(type, id, updateFn); }
function deleteItem(type, id) { return getBackend().deleteItem(type, id); }
function queryItems(type, filter) { return getBackend().queryItems(type, filter); }
function isFoundationMaterial(mat) { return getBackend().isFoundationMaterial(mat); }

const DATA_DIR = require('path').join(__dirname, '..', 'data');

module.exports = { listItems, getItem, setItem, updateItem, deleteItem, queryItems, isFoundationMaterial, DATA_DIR, ensureBackend };
