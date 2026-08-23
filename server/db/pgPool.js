const { Pool } = require('pg');
const logger = require('../shared/logger');
const { SERVER_DEFAULTS } = require('../config/systemConfig');

let _pool = null;
let _initPromise = null;

function getPool() {
    if (_pool) return _pool;
    throw new Error('[PG] Pool not initialized. Call initPgPool() first.');
}

async function initPgPool(connectionString) {
    if (_pool) return _pool;
    if (_initPromise) return _initPromise;

    const connStr = connectionString || process.env.DATABASE_URL || SERVER_DEFAULTS.DEFAULT_PG_CONNECTION;

    _initPromise = (async () => {
        _pool = new Pool({
            connectionString: connStr,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
        });

        _pool.on('error', (err) => {
            logger.error('pgPool', 'Unexpected pool error:', err.message);
        });

        try {
            const client = await _pool.connect();
            await client.query('SELECT 1');
            client.release();
            logger.info('pgPool', `Connected to PostgreSQL: ${connStr.replace(/:[^:@]+@/, ':****@')}`);
        } catch (err) {
            _pool = null;
            _initPromise = null;
            logger.error('pgPool', 'Connection test failed:', err.message);
            throw err;
        }

        return _pool;
    })();

    return _initPromise;
}

async function closePgPool() {
    if (_pool) {
        try { await _pool.end(); } catch (_) { /* ignore */ }
        _pool = null;
        _initPromise = null;
        logger.info('pgPool', 'PostgreSQL pool closed and reset');
    }
}

async function healthCheck() {
    if (!_pool) return { status: 'not_initialized' };
    try {
        const result = await _pool.query('SELECT 1 as ok');
        return { status: 'ok', totalCount: _pool.totalCount, idleCount: _pool.idleCount, waitingCount: _pool.waitingCount };
    } catch (err) {
        return { status: 'error', message: err.message };
    }
}

module.exports = { getPool, initPgPool, closePgPool, healthCheck };
