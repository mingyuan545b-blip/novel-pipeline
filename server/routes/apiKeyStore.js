const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../shared/logger');

const API_KEYS_DIR = path.join(__dirname, '../../data/api-keys');
const API_KEYS_FILE = path.join(API_KEYS_DIR, 'keys.json');

function _ensureDir() {
    if (!fs.existsSync(API_KEYS_DIR)) {
        fs.mkdirSync(API_KEYS_DIR, { recursive: true });
    }
}

function loadKeys() {
    _ensureDir();
    try {
        if (fs.existsSync(API_KEYS_FILE)) {
            const raw = fs.readFileSync(API_KEYS_FILE, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) {
        logger.warn('admin', 'Failed to load API keys, using empty list:', e.message);
    }
    return { keys: [], lastModified: null };
}

function saveKeys(data) {
    _ensureDir();
    data.lastModified = new Date().toISOString();
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(API_KEYS_FILE, json, 'utf-8');
    return data;
}

function hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

function generateKey() {
    return 'npk_' + crypto.randomBytes(32).toString('hex');
}

function redactKey(key) {
    if (key.length <= 8) return '***';
    return key.substring(0, 6) + '...' + key.substring(key.length - 4);
}

module.exports = { loadKeys, saveKeys, hashKey, generateKey, redactKey };
