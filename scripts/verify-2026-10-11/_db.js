'use strict';
/** _db.js — 只读直连 PG（避开 server 单线程繁忙） */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env'), override: true });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function q(sql, params) { const r = await pool.query(sql, params); return r.rows; }
async function end() { await pool.end(); }
module.exports = { q, end, pool };
