/**
 * projectDataReader — 项目数据的权威读取（供只读体检脚本使用）
 *
 * 背景（G14）：verifyStyleProfileSchema 的 S2 / verifyWordConfigSchema 的 W4 只读
 *   data/projects/*.json（PG 化之后该目录为空），于是恒报「0 个项目」并打 ✅ —— 典型的空绿：
 *   门禁看起来在检查数据，实际上什么都没检查。
 * 统一读法：优先 PG（USE_PG=true 且有 DATABASE_URL），否则回退历史 JSON 目录；
 *   两者都读不到时返回 source='none'，由调用方显式报 SKIP（而不是 ✅）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function loadEnv() {
    try {
        // 不 override：显式传入的环境变量优先（便于测试与临时切换数据源）
        require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });
    } catch (_) { /* 无 dotenv 时按既有环境变量走 */ }
}

async function readProjects() {
    loadEnv();
    const usePg = String(process.env.USE_PG || '').toLowerCase() === 'true' && !!process.env.DATABASE_URL;
    if (usePg) {
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        try {
            const { rows } = await pool.query('SELECT id, data FROM projects');
            const projects = rows
                .map((r) => {
                    try { return typeof r.data === 'string' ? JSON.parse(r.data) : r.data; } catch (_) { return null; }
                })
                .filter(Boolean);
            return { source: projects.length ? 'pg' : 'none', projects };
        } finally {
            await pool.end();
        }
    }

    const dir = path.join(ROOT, 'data', 'projects');
    if (!fs.existsSync(dir)) return { source: 'none', projects: [] };
    const projects = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
        try { projects.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch (_) { /* 跳过坏文件 */ }
    }
    return { source: projects.length ? 'json' : 'none', projects };
}

module.exports = { readProjects };
