const logger = require('./shared/logger');
const { SERVER_DEFAULTS } = require('./config/systemConfig');
const USE_PG = process.env.USE_PG === 'true';
const USE_SQLITE = process.env.USE_SQLITE === 'true';

let _backend = null;
let _initPromise = null;

// 降级状态记录：任何 fallback 都会写入，供 health 路由暴露给前端
// 陷阱#19：之前 PG 失败静默回退 JSON 只 warn 一行，前端完全无感知
// 导致"前端 UI 没有项目数据"但没有任何告警，错误码定位机制形同虚设
const _backendStatus = {
    type: 'unknown',           // 'pg' | 'sqlite' | 'json' | 'unknown'
    degraded: false,           // 是否发生了非预期降级
    degradedReason: null,      // 降级原因（错误消息）
    requestedBackend: null,    // 配置期望的后端类型
    initializedAt: null
};

function getBackendStatus() {
    return { ..._backendStatus };
}

async function ensureBackend() {
    if (_backend) return _backend;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
        _backendStatus.requestedBackend = USE_PG ? 'pg' : (USE_SQLITE ? 'sqlite' : 'json');

        if (USE_PG) {
            try {
                const { initPgPool, healthCheck } = require('./db/pgPool');
                const connectionString = process.env.DATABASE_URL || SERVER_DEFAULTS.DEFAULT_PG_CONNECTION;
                await initPgPool(connectionString);
                const healthy = await healthCheck();
                if (!healthy || healthy.status !== 'ok') throw new Error('PG health check failed');
                const { initDatabaseAsync } = require('./db/database-pg');
                await initDatabaseAsync();
                _backend = require('./db/store-pg');
                _backendStatus.type = 'pg';
                _backendStatus.initializedAt = new Date().toISOString();
                logger.info('store', '[STORE] Using PostgreSQL backend');
                // P2-2: 启动时自动同步JSON到PG
                await _syncJsonToPgIfNeeded();
                return _backend;
            } catch (err) {
                // 陷阱#19修复：PG 降级必须 ERROR 级别 + 记录降级状态，供 health 暴露
                _backendStatus.type = 'json';
                _backendStatus.degraded = true;
                _backendStatus.degradedReason = `PostgreSQL unavailable: ${err.message}`;
                _backendStatus.initializedAt = new Date().toISOString();
                logger.error('store', `[STORE] DEGRADED MODE: PostgreSQL unavailable (${err.message}), falling back to JSON files. Data in PG will not be visible!`);
            }
        }

        if (USE_SQLITE) {
            try {
                const { initDatabaseAsync } = require('./db/database');
                await initDatabaseAsync();
                const dbStore = require('./db/store');
                _backend = dbStore;
                _backendStatus.type = 'sqlite';
                _backendStatus.initializedAt = new Date().toISOString();
                logger.info('store', '[STORE] Using SQLite backend');
                return _backend;
            } catch (err) {
                // 陷阱#19修复：SQLite 降级同样必须 ERROR 级别
                _backendStatus.type = 'json';
                _backendStatus.degraded = true;
                _backendStatus.degradedReason = `SQLite unavailable: ${err.message}`;
                _backendStatus.initializedAt = new Date().toISOString();
                logger.error('store', `[STORE] DEGRADED MODE: SQLite unavailable (${err.message}), falling back to JSON files`);
            }
        }

        _backend = require('./db/jsonStore');
        if (!_backendStatus.type || _backendStatus.type === 'unknown') {
            _backendStatus.type = 'json';
            _backendStatus.initializedAt = new Date().toISOString();
        }
        logger.info('store', '[STORE] Using JSON file backend');
        return _backend;
    })();

    return _initPromise;
}

// P2-2: 启动时检查PG是否有数据，如果没有则从JSON同步
async function _syncJsonToPgIfNeeded() {
    try {
        const projectCount = await _backend.queryItems('projects', () => true);
        if (projectCount.length > 0) {
            logger.info('store', `[STORE] PG已有 ${projectCount.length} 个项目，跳过同步`);
            return;
        }

        logger.info('store', '[STORE] PG项目表为空，从JSON文件同步...');
        const fs = require('fs');
        const path = require('path');
        const dataDir = path.join(__dirname, '..', 'data');

        // 从数据源注册中心读取需要同步的目录名（标准名+别名）
        const { getSyncableDirNames } = require('./config/dataStoreRegistry');
        const tablesToSync = getSyncableDirNames();

        let totalSynced = 0;
        for (const table of tablesToSync) {
            const dir = path.join(dataDir, table);
            try {
                const files = fs.readdirSync(dir);
                let count = 0;
                for (const f of files) {
                    try {
                        const filePath = path.join(dir, f);
                        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        if (data.id) {
                            await _backend.setItem(table, data.id, data);
                            count++;
                        }
                    } catch (_) { logger.warn('store', _.message || _); }
                }
                if (count > 0) {
                    logger.info('store', `  [SYNC] ${table}: ${count} 条`);
                    totalSynced += count;
                }
            } catch (_) {
                // 目录不存在，跳过
            }
        }
        logger.info('store', `[STORE] 同步完成，共 ${totalSynced} 条数据`);
    } catch (err) {
        logger.warn('store', `[STORE] 同步失败: ${err.message}`);
    }
}

async function getBackend() {
    await ensureBackend();
    return _backend;
}

async function listItems(type) { return await (await getBackend()).listItems(type); }
async function getItem(type, id) { return await (await getBackend()).getItem(type, id); }
const VALIDATED_TYPES = new Set(['materials']);
const { validateRequired, fillDefaults } = require('./db/fieldValidator');

async function setItem(type, id, data) {
    if (VALIDATED_TYPES.has(type) && data) {
        const filled = fillDefaults(type, data);
        const validation = validateRequired(type, filled);
        if (!validation.valid) {
            logger.warn('store', '[VALIDATE] {type} {id} missing required: {missing}', { type, id, missing: validation.missing.join(', ') });
        }
        return await (await getBackend()).setItem(type, id, filled);
    }
    return await (await getBackend()).setItem(type, id, data);
}
async function updateItem(type, id, updateFn) { return await (await getBackend()).updateItem(type, id, updateFn); }
async function deleteItem(type, id) { return await (await getBackend()).deleteItem(type, id); }
async function queryItems(type, filter) { return await (await getBackend()).queryItems(type, filter); }
async function isFoundationMaterial(mat) { return await (await getBackend()).isFoundationMaterial(mat); }

const DATA_DIR = require('path').join(__dirname, '..', 'data');

module.exports = { listItems, getItem, setItem, updateItem, deleteItem, queryItems, isFoundationMaterial, DATA_DIR, ensureBackend, getBackendStatus };
