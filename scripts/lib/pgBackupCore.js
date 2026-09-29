'use strict';

/**
 * pgBackupCore — PostgreSQL 备份/恢复核心逻辑（无 CLI 副作用，可单测）
 *
 * 背景：2026-09-30 外部评审指出"1700 章成果零备份"。此前 backups/ 只有一份
 * 2026-05-21 的目录，全仓库无任何 pg_dump 调用。
 *
 * 关键设计：
 *   1) pg_dump 自动发现：PATH 里没有时，扫描各平台标准安装目录
 *      （实测本机 PostgreSQL 17 装在 C:/Program Files/PostgreSQL/17/bin 但不在 PATH）。
 *   2) 口令只经环境变量 PGPASSWORD 传递，绝不进命令行（进程列表可见）。
 *   3) 一律用 -w（--no-password），避免自动化脚本卡在交互式口令提示上。
 *   4) 自定义格式（-Fc）：可压缩、可 pg_restore 选择性恢复、可校验。
 *   5) 备份产物 + manifest.json（sha256/表行数）落地，供 --verify 与恢复演练核对。
 *
 * 文件位置：scripts/lib/pgBackupCore.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const BACKUP_PREFIX = 'backup-';
const MANIFEST_NAME = 'manifest.json';
const DUMP_NAME = 'dump.pgc';
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

/** 各平台 PostgreSQL 安装目录的父目录（其下按版本号子目录存放 bin） */
function binParentDirs() {
    if (process.platform === 'win32') {
        // 用正斜杠：Node 的 fs/path 在 Windows 上同样接受，且免去反斜杠转义问题
        return ['C:/Program Files/PostgreSQL', 'C:/Program Files (x86)/PostgreSQL'];
    }
    if (process.platform === 'darwin') {
        return ['/opt/homebrew/opt', '/usr/local/opt', '/Applications/Postgres.app/Contents/Versions'];
    }
    return ['/usr/lib/postgresql', '/usr/pgsql', '/usr/local/pgsql'];
}

function exeName(base) {
    return process.platform === 'win32' ? base + '.exe' : base;
}

/** 在 PATH 中查找可执行文件 */
function findInPath(exe) {
    const raw = process.env.PATH || '';
    for (const dir of raw.split(path.delimiter)) {
        if (!dir) continue;
        const full = path.join(dir, exe);
        try { if (fs.existsSync(full) && fs.statSync(full).isFile()) return full; } catch (_) { /* 目录不可读则跳过 */ }
    }
    return null;
}

/** 在标准安装目录里按版本号倒序找 bin 下的可执行文件 */
function findInInstallDirs(exe) {
    for (const parent of binParentDirs()) {
        let versions = [];
        try { versions = fs.readdirSync(parent); } catch (_) { continue; }
        for (const v of versions.sort().reverse()) {
            const full = path.join(parent, v, 'bin', exe);
            try { if (fs.existsSync(full)) return full; } catch (_) { /* 忽略不可读项 */ }
        }
    }
    return null;
}

/**
 * 定位 pg_dump / pg_restore。
 * 优先级：显式环境变量 > PATH > 标准安装目录。
 * @param {string} base 工具名（pg_dump | pg_restore）
 */
function resolvePgTool(base) {
    const envKey = base === 'pg_dump' ? 'PG_DUMP_PATH' : 'PG_RESTORE_PATH';
    const explicit = process.env[envKey];
    if (explicit && fs.existsSync(explicit)) return explicit;
    const exe = exeName(base);
    return findInPath(exe) || findInInstallDirs(exe);
}

/** 解析 DATABASE_URL / 连接串 → 连接参数（口令不落日志） */
function parseConn(connStr) {
    if (!connStr) throw new Error('缺少连接串（DATABASE_URL）');
    let u;
    try { u = new URL(connStr); } catch (_) { throw new Error('DATABASE_URL 不是合法 URL'); }
    if (!/^postgres(ql)?:$/.test(u.protocol)) throw new Error('不支持的协议: ' + u.protocol);
    const database = decodeURIComponent((u.pathname || '').replace(/^\//, ''));
    if (!database) throw new Error('DATABASE_URL 缺少数据库名');
    return {
        host: u.hostname || 'localhost',
        port: u.port || '5432',
        user: decodeURIComponent(u.username || ''),
        password: u.password ? decodeURIComponent(u.password) : '',
        database,
    };
}

/** 备份目录名：backup-YYYYMMDD-HHmmss（本地时间，便于人工识别） */
function makeBackupId(date) {
    const d = date || new Date();
    const p = (n) => String(n).padStart(2, '0');
    return BACKUP_PREFIX + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
        '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

function sha256File(file) {
    const h = crypto.createHash('sha256');
    h.update(fs.readFileSync(file));
    return h.digest('hex');
}

/** 执行 pg_dump（自定义格式）。返回 { ok, bytes, stderr, stdout } */
function runDump(params) {
    const { pgDumpPath, conn, outFile } = params;
    const timeoutMs = params.timeoutMs || DEFAULT_TIMEOUT_MS;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const args = [
        '-Fc', '-w', '--no-owner', '--no-privileges',
        '-h', conn.host, '-p', String(conn.port),
        '-d', conn.database,
        '-f', outFile,
    ];
    if (conn.user) args.push('-U', conn.user);
    const env = Object.assign({}, process.env);
    if (conn.password) env.PGPASSWORD = conn.password;
    const r = spawnSync(pgDumpPath, args, { env, timeout: timeoutMs, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    const ok = r.status === 0 && fs.existsSync(outFile);
    return {
        ok,
        bytes: ok ? fs.statSync(outFile).size : 0,
        stderr: (r.stderr || '').trim(),
        stdout: (r.stdout || '').trim(),
        signal: r.signal || null,
    };
}

/** 执行 pg_restore（导入到 targetDb，恢复演练用） */
function runRestore(params) {
    const { pgRestorePath, conn, dumpFile, targetDb } = params;
    const timeoutMs = params.timeoutMs || DEFAULT_TIMEOUT_MS;
    const args = [
        '-w', '--no-owner', '--no-privileges', '--clean', '--if-exists',
        '-h', conn.host, '-p', String(conn.port),
        '-d', targetDb,
        dumpFile,
    ];
    if (conn.user) args.push('-U', conn.user);
    const env = Object.assign({}, process.env);
    if (conn.password) env.PGPASSWORD = conn.password;
    const r = spawnSync(pgRestorePath, args, { env, timeout: timeoutMs, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    return { ok: r.status === 0, stderr: (r.stderr || '').trim(), stdout: (r.stdout || '').trim() };
}

function writeManifest(dir, manifest) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, MANIFEST_NAME), JSON.stringify(manifest, null, 2), 'utf8');
    return manifest;
}

function readManifest(dir) {
    try {
        return JSON.parse(fs.readFileSync(path.join(dir, MANIFEST_NAME), 'utf8'));
    } catch (_) { return null; }
}

/** 列出备份目录（新的在前）。无 manifest 的目录 valid=false，不参与校验 */
function listBackups(outDir) {
    let names = [];
    try { names = fs.readdirSync(outDir); } catch (_) { return []; }
    return names
        .filter(n => n.indexOf(BACKUP_PREFIX) === 0)
        .filter(n => {
            try { return fs.statSync(path.join(outDir, n)).isDirectory(); } catch (_) { return false; }
        })
        .sort()
        .reverse()
        .map(name => {
            const dir = path.join(outDir, name);
            const manifest = readManifest(dir);
            return { id: name, dir, manifest, valid: Boolean(manifest) };
        });
}

/**
 * 保留策略：仅保留最近 keep 份，其余整目录删除（含 manifest）。
 * @returns {{kept: string[], removed: string[]}}
 */
function applyRetention(outDir, keep) {
    const all = listBackups(outDir);
    const kept = [], removed = [];
    all.forEach((b, i) => {
        if (i < keep) { kept.push(b.id); return; }
        try {
            fs.rmSync(b.dir, { recursive: true, force: true });
            removed.push(b.id);
        } catch (_) { /* 删除失败不阻断备份流程 */ }
    });
    return { kept, removed };
}

/** 采集指定表行数（供恢复演练比对；表不存在记 null，不抛错） */
async function collectTableCounts(connStr, tables) {
    const { Client } = require('pg');
    const client = new Client({ connectionString: connStr });
    await client.connect();
    try {
        const counts = {};
        for (const t of (tables || [])) {
            try {
                const r = await client.query('SELECT count(*)::int AS n FROM "' + t + '"');
                counts[t] = r.rows[0].n;
            } catch (_) { counts[t] = null; }
        }
        return counts;
    } finally {
        await client.end().catch(() => { /* 关闭失败不影响结果 */ });
    }
}

/** 列出 public schema 下的基表名（manifest 采集行数用，避免硬编码表清单） */
async function listPublicTables(connStr) {
    const { Client } = require('pg');
    const client = new Client({ connectionString: connStr });
    await client.connect();
    try {
        const r = await client.query(
            "SELECT table_name FROM information_schema.tables " +
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
        );
        return r.rows.map(row => row.table_name);
    } finally {
        await client.end().catch(() => { /* 关闭失败不影响结果 */ });
    }
}

module.exports = {
    BACKUP_PREFIX, MANIFEST_NAME, DUMP_NAME, DEFAULT_TIMEOUT_MS,
    resolvePgTool, parseConn, makeBackupId, sha256File,
    runDump, runRestore, writeManifest, readManifest,
    listBackups, applyRetention, collectTableCounts, listPublicTables,
};
