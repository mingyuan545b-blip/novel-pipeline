/**
 * _querySettings.js — 临时查询项目settings（验证后删除）
 */
require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
    const r = await p.query("SELECT id, data FROM projects WHERE id = 'fee2bcd3-d73a-4ce9-8899-12b2e1350724'");
    if (r.rows.length === 0) { console.log('项目不存在'); await p.end(); return; }
    const proj = JSON.parse(r.rows[0].data);
    console.log('项目名:', proj.name);
    console.log('settings:', JSON.stringify(proj.settings || {}, null, 2));
    console.log('styleProfile:', proj.styleProfile);
    console.log('genre:', proj.genre);
    await p.end();
})().catch(e => { console.log('ERR:', e.message); process.exit(1); });
