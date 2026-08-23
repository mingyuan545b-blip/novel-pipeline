const { getDatabase, getTableForType, safeParse, queryAll, queryOne } = require('./database-pg');

async function listItems(type) {
    const pool = getDatabase();
    const table = getTableForType(type);
    let rows;
    if (table === 'kv_store') {
        rows = await queryAll(pool, 'SELECT data FROM kv_store WHERE type = ?', [type]);
    } else if (table === 'api_keys') {
        const keyRows = await queryAll(pool, 'SELECT data FROM api_keys');
        const bindingRows = await queryAll(pool, 'SELECT data FROM agent_bindings');
        rows = [...keyRows, ...bindingRows];
    } else {
        rows = await queryAll(pool, `SELECT data FROM ${table}`);
    }
    return rows.map(r => safeParse(r.data)).filter(Boolean);
}

async function getItem(type, id) {
    const pool = getDatabase();
    const table = getTableForType(type);
    let row;
    if (table === 'kv_store') {
        row = await queryOne(pool, 'SELECT data FROM kv_store WHERE type = ? AND id = ?', [type, id]);
    } else {
        row = await queryOne(pool, `SELECT data FROM ${table} WHERE id = ?`, [id]);
    }
    if (!row) return null;
    return safeParse(row.data);
}

module.exports = { listItems, getItem };
